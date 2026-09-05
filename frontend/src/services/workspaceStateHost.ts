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

/** Web Locks prevent cloned tabs from writing the same local queue. The lease is released on unload. */
export function acquireStateReplica(storage: Storage, locks: LockManager): { replica: Promise<string>; close: () => void } {
  const abort = new AbortController();
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const replica = new Promise<string>((resolve, reject) => {
    const acquire = async (id: string): Promise<void> => {
      if (abort.signal.aborted) throw new Error('State replica lease closed');
      await locks.request(`modulo-state-replica:${id}`, { ifAvailable: true }, async lock => {
        if (abort.signal.aborted) throw new Error('State replica lease closed');
        if (!lock) { await acquire(crypto.randomUUID()); return; }
        storage.setItem('modulo.state.replica', id); resolve(id); await held;
      });
    };
    void acquire(storage.getItem('modulo.state.replica') || crypto.randomUUID()).catch(reject);
  });
  return { replica, close: () => { abort.abort(); release?.(); } };
}
