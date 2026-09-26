import { PluginStateClient, StateRequestError, type StatePersistence, type StateScope, type StateTransport } from './pluginStateClient';
import { createStateTransport, type StateSession } from './pluginStateTransport';

export interface WorkspaceStateHostOptions {
  origin: string;
  replica: Promise<string>;
  persistence: StatePersistence;
  session: () => StateSession | null;
  transport?: (scope: StateScope) => StateTransport;
  autoRetry?: boolean;
}

/** Owns clients for one browser host and synchronously revokes them when the principal changes. */
export class WorkspaceStateHost {
  private readonly clients = new Map<string, PluginStateClient>();
  private readonly opening = new Map<string, Promise<PluginStateClient>>();
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private identity = '';
  private disposed = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly options: WorkspaceStateHostOptions) { this.sessionChanged(); }
  get sessionKey(): string { return this.identity; }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  sessionChanged(): void {
    const session = this.options.session();
    const next = session ? JSON.stringify([session.issuer, session.subject]) : '';
    if (next === this.identity) return;
    this.generation++; this.identity = next;
    for (const client of this.clients.values()) client.close();
    this.clients.clear(); this.opening.clear(); this.emit();
  }
  async open(namespace: string): Promise<PluginStateClient> {
    this.sessionChanged();
    if (this.disposed || !this.identity) throw new StateRequestError(401, 'STATE_SESSION_UNAVAILABLE');
    const existing = this.clients.get(namespace);
    if (existing) return existing;
    const pending = this.opening.get(namespace);
    if (pending) return pending;
    const generation = this.generation;
    const session = this.options.session()!;
    const promise = (async () => {
      const replica = await this.options.replica;
      if (generation !== this.generation || this.disposed) throw new StateRequestError(401, 'STATE_SESSION_CHANGED');
      const scope: StateScope = { origin: this.options.origin, issuer: session.issuer, subject: session.subject,
        workspace: 'personal', namespace, replica };
      const transport = this.options.transport?.(scope) ?? createStateTransport(scope, async () => this.options.session());
      const client = await PluginStateClient.open(scope, this.options.persistence, transport,
        { autoRetry: this.options.autoRetry });
      if (generation !== this.generation || this.disposed) {
        client.close(); throw new StateRequestError(401, 'STATE_SESSION_CHANGED');
      }
      this.clients.set(namespace, client); client.watch(() => this.emit());
      // Cached state is immediately available. Server failure must not prevent offline editing.
      void client.refreshAll().catch(() => {});
      return client;
    })();
    this.opening.set(namespace, promise);
    void promise.finally(() => { if (this.opening.get(namespace) === promise) this.opening.delete(namespace); }).catch(() => {});
    return promise;
  }
  revoke(namespace: string): void {
    this.clients.get(namespace)?.close(); this.clients.delete(namespace);
    // Invalidate in-flight opens too, including plugin-disable during cache loading.
    this.generation++; this.opening.clear(); this.emit();
  }
  async synchronize(): Promise<void> {
    this.sessionChanged();
    await Promise.allSettled([...this.clients.values()].map(async client => {
      await client.refreshAll(); await client.synchronize();
    }));
  }
  /** Refresh one record announced by the private owner-scoped state change feed. */
  async refresh(namespace: string, key: string): Promise<void> {
    this.sessionChanged();
    if (this.disposed || !this.identity) return;
    const client = this.clients.get(namespace);
    if (!client || client.status === 'closed') return;
    await client.refresh(key);
  }
  start(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void {
    const refresh = () => { void this.synchronize(); };
    target.addEventListener('online', refresh); target.addEventListener('focus', refresh);
    this.timer = setInterval(refresh, 30_000);
    return () => {
      target.removeEventListener('online', refresh); target.removeEventListener('focus', refresh);
      if (this.timer) clearInterval(this.timer);
    };
  }
  close(): void {
    this.disposed = true; this.generation++;
    if (this.timer) clearInterval(this.timer);
    for (const client of this.clients.values()) client.close();
    this.clients.clear(); this.opening.clear(); this.listeners.clear();
  }
  private emit(): void { for (const listener of this.listeners) { try { listener(); } catch { /* observer isolation */ } } }
}

export interface ReplicaPool { list(): Promise<string[]>; add(replica: string): Promise<void> }

/**
 * Web Locks give each open tab its own replica so cloned tabs never write the
 * same queue. Known replicas are reused first: a queue left behind by a closed
 * tab is adopted by the next tab. The lease is released on unload.
 */
export function acquireStateReplica(pool: ReplicaPool, locks: LockManager): { replica: Promise<string>; close: () => void } {
  const abort = new AbortController();
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const closed = () => new Error('State replica lease closed');
  const replica = new Promise<string>((resolve, reject) => {
    const tryLock = (id: string) => new Promise<boolean>((decided, failed) => {
      if (abort.signal.aborted) { failed(closed()); return; }
      locks.request(`modulo-state-replica:${id}`, { ifAvailable: true }, async lock => {
        if (!lock) { decided(false); return; }
        if (abort.signal.aborted) { failed(closed()); return; }
        decided(true); resolve(id); await held;
      }).catch(failed);
    });
    const acquire = async () => {
      // A React StrictMode setup can be disposed in this same task. The pool
      // read below yields first, so a cancelled setup never takes a lock.
      const known = await pool.list();
      for (const id of known) {
        if (abort.signal.aborted) throw closed();
        if (await tryLock(id)) return;
      }
      if (abort.signal.aborted) throw closed();
      const fresh = crypto.randomUUID();
      await pool.add(fresh);
      if (!(await tryLock(fresh))) throw new Error('Could not lock a new offline queue identity');
    };
    void Promise.resolve().then(acquire).catch(reject);
  });
  return { replica, close: () => { abort.abort(); release?.(); } };
}
