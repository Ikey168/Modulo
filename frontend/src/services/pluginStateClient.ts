export type StateJson = null | boolean | number | string | StateJson[] | { [key: string]: StateJson };

export interface StateRecord {
  key: string;
  schemaId: string;
  schemaVersion: number;
  version: number;
  value: StateJson;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface StateScope {
  origin: string;
  issuer: string;
  subject: string;
  workspace: string;
  namespace: string;
  /** Stable identifier for this local replica, distinct between simultaneous browser tabs. */
  replica: string;
}
export interface StateMutation {
  sequence: number;
  base?: StateRecord;
  value: StateJson;
  schemaId: string;
  schemaVersion: number;
  deleted: boolean;
}
export interface StateEntry {
  key: string;
  remote?: StateRecord;
  pending?: StateMutation;
  conflict?: { base?: StateRecord; remote?: StateRecord };
}
export interface StateSnapshot {
  format: 1;
  partition: string;
  sequence: number;
  entries: StateEntry[];
}
export interface StatePersistence {
  load(partition: string): Promise<StateSnapshot | null>;
  save(partition: string, snapshot: StateSnapshot): Promise<void>;
}
export interface StateTransport {
  list?(cursor: string | undefined, signal: AbortSignal): Promise<{ records: StateRecord[]; nextCursor?: string | null }>;
  get(key: string, signal: AbortSignal): Promise<StateRecord | undefined>;
  put(key: string, request: { expectedVersion: number; schemaId: string; schemaVersion: number; value: StateJson },
    signal: AbortSignal): Promise<StateRecord>;
  delete(key: string, expectedVersion: number, signal: AbortSignal): Promise<StateRecord>;
}
export class StateRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string,
    public readonly current?: StateRecord) { super(code); }
}
export type StateSyncStatus = 'idle' | 'syncing' | 'offline' | 'conflict' | 'error' | 'closed';
export interface StateView {
  key: string;
  schemaId?: string;
  schemaVersion?: number;
  value?: StateJson;
  deleted: boolean;
  pending: boolean;
  conflict?: StateEntry['conflict'];
}

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function validateJson(value: StateJson, depth = 0, seen = new Set<object>()): void {
  if (depth > 63) throw new Error('State JSON is too deeply nested');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || seen.has(value)) throw new Error('State must contain finite JSON values');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
    && Object.getPrototypeOf(value) !== null) throw new Error('State must contain plain JSON objects');
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) validateJson(value[index], depth + 1, seen);
  } else for (const child of Object.values(value)) validateJson(child, depth + 1, seen);
  seen.delete(value);
}
function canonical(value: StateJson): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function matches(record: StateRecord | undefined, mutation: StateMutation): boolean {
  return !!record && record.deleted === mutation.deleted && (mutation.deleted || (
    record.schemaId === mutation.schemaId && record.schemaVersion === mutation.schemaVersion
    && canonical(record.value) === canonical(mutation.value)));
}
const segment = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/;
function validRecord(record: StateRecord | undefined, key: string): boolean {
  return record === undefined || (!!record && record.key === key && typeof record.schemaId === 'string'
    && Number.isSafeInteger(record.version) && record.version > 0
    && Number.isSafeInteger(record.schemaVersion) && record.schemaVersion > 0
    && typeof record.deleted === 'boolean' && Object.prototype.hasOwnProperty.call(record, 'value'));
}

/** A single replica's durable queue. The host supplies authenticated transport and closes it on logout. */
export class PluginStateClient {
  readonly partition: string;
  private snapshot: StateSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly abort = new AbortController();
  private writes: Promise<void> = Promise.resolve();
  private flushing?: Promise<void>;
  private refreshing?: Promise<void>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private _status: StateSyncStatus = 'idle';
  private _error?: string;

  private constructor(scope: StateScope, private readonly persistence: StatePersistence,
    private readonly transport: StateTransport, private readonly autoRetry: boolean) {
    if (!scope.origin || !scope.issuer || !scope.subject || !scope.replica
      || !segment.test(scope.workspace) || !segment.test(scope.namespace)) throw new Error('Invalid state scope');
    this.partition = JSON.stringify([scope.origin, scope.issuer, scope.subject,
      scope.workspace, scope.namespace, scope.replica]);
    this.snapshot = { format: 1, partition: this.partition, sequence: 0, entries: [] };
  }

  static async open(scope: StateScope, persistence: StatePersistence, transport: StateTransport,
    options: { autoRetry?: boolean } = {}): Promise<PluginStateClient> {
    const client = new PluginStateClient(scope, persistence, transport, options.autoRetry ?? true);
    const stored = await persistence.load(client.partition);
    if (stored) {
      if (stored.format !== 1 || stored.partition !== client.partition || !Array.isArray(stored.entries)
        || !Number.isSafeInteger(stored.sequence) || stored.sequence < 0
        || stored.entries.some(entry => !entry || typeof entry.key !== 'string' || !segment.test(entry.key)
          || !validRecord(entry.remote, entry.key)
          || (entry.pending && (!Number.isSafeInteger(entry.pending.sequence) || entry.pending.sequence < 1
            || entry.pending.sequence > stored.sequence || !validRecord(entry.pending.base, entry.key)
            || !Object.prototype.hasOwnProperty.call(entry.pending, 'value') || typeof entry.pending.deleted !== 'boolean'))
          || (entry.conflict && (!validRecord(entry.conflict.base, entry.key)
            || !validRecord(entry.conflict.remote, entry.key))))
        || new Set(stored.entries.map(entry => entry.key)).size !== stored.entries.length) {
        throw new Error('Unsupported or malformed state cache; preserve it for recovery');
      }
      client.snapshot = copy(stored);
      if (stored.entries.some(entry => entry.conflict)) client._status = 'conflict';
      if (stored.entries.some(entry => entry.pending)) client.scheduleSync();
    }
    return client;
  }

  get status(): StateSyncStatus { return this._status; }
  get error(): string | undefined { return this._error; }

  get(key: string): StateView | undefined {
    this.ensureOpen();
    const entry = this.snapshot.entries.find(item => item.key === key);
    if (!entry) return undefined;
    const current = entry.pending ?? entry.remote;
    return copy({ key, value: current?.value, deleted: current?.deleted ?? true,
      schemaId: current?.schemaId, schemaVersion: current?.schemaVersion,
      pending: !!entry.pending, conflict: entry.conflict });
  }

  /** Cached records, including pending local writes. Remote discovery belongs to the host's paginated refresh. */
  list(): StateView[] {
    this.ensureOpen();
    return this.snapshot.entries.map(entry => this.get(entry.key)!).filter(entry => !entry.deleted);
  }

  conflicts(): StateView[] {
    this.ensureOpen(); return this.snapshot.entries.filter(entry => entry.conflict).map(entry => this.get(entry.key)!);
  }

  recoverySnapshot(): StateSnapshot { this.ensureOpen(); return copy(this.snapshot); }

  watch(listener: () => void): () => void {
    this.ensureOpen(); this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async set(key: string, value: StateJson, schemaId: string, schemaVersion: number): Promise<void> {
    if (!segment.test(key) || !schemaId || !Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error('Invalid state record');
    }
    validateJson(value);
    if (new TextEncoder().encode(JSON.stringify(value)).length > 1_048_576) throw new Error('State record is too large');
    await this.change(snapshot => {
      const entry = this.entry(snapshot, key);
      entry.pending = { sequence: ++snapshot.sequence, base: entry.pending ? entry.pending.base : entry.remote,
        value: copy(value), schemaId, schemaVersion, deleted: false };
    });
    this.scheduleSync();
  }

  async create(key: string, value: StateJson, schemaId: string, schemaVersion: number): Promise<void> {
    if (!segment.test(key) || !schemaId || !Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
      throw new Error('Invalid state record');
    }
    validateJson(value);
    if (new TextEncoder().encode(JSON.stringify(value)).length > 1_048_576) throw new Error('State record is too large');
    await this.change(snapshot => {
      const entry = this.entry(snapshot, key);
      if (entry.pending || entry.remote) throw new StateRequestError(409, 'STATE_ALREADY_EXISTS', entry.remote);
      entry.pending = { sequence: ++snapshot.sequence, value: copy(value), schemaId, schemaVersion, deleted: false };
    });
    this.scheduleSync();
  }

  async delete(key: string): Promise<void> {
    if (!segment.test(key)) throw new Error('Invalid state key');
    await this.change(snapshot => {
      const entry = snapshot.entries.find(item => item.key === key);
      if (!entry) return;
      const source = entry.pending ?? entry.remote;
      if (!source) return;
      entry.pending = { sequence: ++snapshot.sequence, base: entry.pending ? entry.pending.base : entry.remote,
        value: null, schemaId: source.schemaId, schemaVersion: source.schemaVersion, deleted: true };
    });
    this.scheduleSync();
  }

  async refresh(key: string): Promise<void> {
    this.ensureOpen();
    if (!segment.test(key)) throw new Error('Invalid state key');
    const remote = await this.transport.get(key, this.abort.signal);
    this.ensureOpen();
    await this.change(snapshot => {
      const entry = this.entry(snapshot, key);
      // A refresh must not change the base of a pending local edit.
      entry.remote = remote;
    });
  }

  /** Discover server records without replacing pending edits or acknowledgements newer than this refresh. */
  refreshAll(): Promise<void> {
    this.ensureOpen();
    if (!this.transport.list) return Promise.resolve();
    if (!this.refreshing) this.refreshing = this.pull().finally(() => { this.refreshing = undefined; });
    return this.refreshing;
  }

  private async pull(): Promise<void> {
    const before = new Map(this.snapshot.entries.map(entry => [entry.key, entry.remote?.version]));
    const records = new Map<string, StateRecord>();
    let cursor: string | undefined;
    const cursors = new Set<string>();
    try {
      do {
        const page = await this.transport.list!(cursor, this.abort.signal);
        this.ensureOpen();
        if (!Array.isArray(page.records) || page.records.some(record => !validRecord(record, record.key))) {
          throw new StateRequestError(502, 'STATE_INVALID_SERVER_RESPONSE');
        }
        for (const record of page.records) records.set(record.key, record);
        cursor = page.nextCursor ?? undefined;
        if (cursor && (cursors.has(cursor) || cursors.size >= 100)) {
          throw new StateRequestError(502, 'STATE_INVALID_SERVER_CURSOR');
        }
        if (cursor) cursors.add(cursor);
      } while (cursor);
      await this.change(snapshot => {
        for (const record of records.values()) {
          const entry = this.entry(snapshot, record.key);
          if (!entry.remote || entry.remote.version <= record.version) entry.remote = record;
        }
        for (const entry of snapshot.entries) {
          if (!records.has(entry.key) && !entry.pending && entry.remote?.version === before.get(entry.key)) {
            delete entry.remote;
          }
        }
      });
    } catch (error) {
      if (!this.abort.signal.aborted) this.setStatus(error instanceof StateRequestError && error.status < 500 ? 'error' : 'offline',
        error instanceof Error ? error.message : 'State refresh failed');
      throw error;
    }
  }

  async resolve(key: string, choice: 'remote' | 'local'): Promise<void> {
    await this.change(snapshot => {
      const entry = this.entry(snapshot, key);
      if (!entry.conflict) throw new Error('This record has no conflict');
      entry.remote = entry.conflict.remote;
      if (choice === 'remote') delete entry.pending;
      else if (entry.pending) {
        entry.pending.base = entry.conflict.remote;
        entry.pending.sequence = ++snapshot.sequence;
      }
      delete entry.conflict;
    });
    this.setStatus(this.snapshot.entries.some(entry => entry.conflict) ? 'conflict' : 'idle');
    this.scheduleSync();
  }

  synchronize(): Promise<void> {
    this.ensureOpen();
    if (!this.flushing) this.flushing = this.flush().finally(() => { this.flushing = undefined; });
    return this.flushing;
  }

  close(): void {
    if (this._status === 'closed') return;
    this.abort.abort();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.snapshot = { format: 1, partition: this.partition, sequence: 0, entries: [] };
    this.setStatus('closed'); this.listeners.clear();
  }

  private async flush(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setStatus('syncing');
    try {
      await this.writes;
      while (!this.abort.signal.aborted) {
        const entry = this.snapshot.entries.filter(item => item.pending && !item.conflict)
          .sort((a, b) => a.pending!.sequence - b.pending!.sequence)[0];
        if (!entry?.pending) break;
        const sent = copy(entry.pending);
        let acknowledged: StateRecord | undefined;
        try {
          const expected = sent.base?.version ?? 0;
          if (sent.deleted && expected === 0) {
            // Never drop an offline delete until a remote read confirms whether an uncertain create landed.
            const remote = await this.transport.get(entry.key, this.abort.signal);
            if (remote && !remote.deleted) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', remote);
            acknowledged = remote;
          } else {
            acknowledged = sent.deleted
              ? await this.transport.delete(entry.key, expected, this.abort.signal)
              : await this.transport.put(entry.key, { expectedVersion: expected, schemaId: sent.schemaId,
                schemaVersion: sent.schemaVersion, value: sent.value }, this.abort.signal);
          }
        } catch (error) {
          if (!(error instanceof StateRequestError) || error.status !== 409) throw error;
          if (matches(error.current, sent)) acknowledged = error.current;
          else {
            await this.change(snapshot => {
              const current = this.entry(snapshot, entry.key);
              current.conflict = { base: sent.base, remote: error.current };
              current.remote = error.current;
            });
            continue; // Independent keys can still synchronize.
          }
        }
        this.ensureOpen();
        await this.change(snapshot => {
          const current = this.entry(snapshot, entry.key);
          current.remote = acknowledged;
          if (current.pending?.sequence === sent.sequence) delete current.pending;
          else if (current.pending) current.pending.base = acknowledged;
        });
      }
      if (!this.abort.signal.aborted) {
        this.failures = 0;
        this.setStatus(this.snapshot.entries.some(entry => entry.conflict) ? 'conflict' : 'idle');
      }
    } catch (error) {
      if (this.abort.signal.aborted) return;
      const permanent = error instanceof StateRequestError && error.status >= 400 && error.status < 500
        && error.status !== 408 && error.status !== 429;
      this.setStatus(permanent ? 'error' : 'offline', error instanceof Error ? error.message : 'State synchronization failed');
      if (!permanent && this.autoRetry) {
        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(this.failures++, 6)) * (0.75 + Math.random() * 0.5);
        this.retryTimer = setTimeout(() => { if (!this.abort.signal.aborted) void this.synchronize(); }, delay);
      }
    }
  }

  private change(edit: (snapshot: StateSnapshot) => void): Promise<void> {
    const work = this.writes.then(async () => {
      this.ensureOpen();
      const next = copy(this.snapshot); edit(next);
      await this.persistence.save(this.partition, copy(next));
      this.ensureOpen();
      this.snapshot = next;
      this.notify();
    });
    this.writes = work.catch(() => {});
    return work;
  }
  private entry(snapshot: StateSnapshot, key: string): StateEntry {
    let entry = snapshot.entries.find(item => item.key === key);
    if (!entry) { entry = { key }; snapshot.entries.push(entry); }
    return entry;
  }
  private ensureOpen(): void { if (this.abort.signal.aborted) throw new Error('State client is closed'); }
  private setStatus(status: StateSyncStatus, error?: string): void {
    this._status = status; this._error = error; this.notify();
  }
  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* An observer cannot invalidate a persisted edit or stop other observers. */ }
    }
  }
  private scheduleSync(): void {
    if (!this.autoRetry || this.abort.signal.aborted) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { if (!this.abort.signal.aborted) void this.synchronize(); }, 250);
  }
}
