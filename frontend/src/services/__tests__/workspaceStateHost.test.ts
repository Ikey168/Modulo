import { describe, expect, it, vi, afterEach } from 'vitest';
import { WorkspaceStateHost, acquireStateReplica } from '../workspaceStateHost';
import { PluginStateClient, type StatePersistence, type StateRecord, type StateSnapshot, type StateTransport } from '../pluginStateClient';
import type { StateSession } from '../pluginStateTransport';
import { PluginRuntime } from '../../features/workspace/plugins/runtime';
import type { PluginContext } from '../../features/workspace/plugins/types';

const scope = { origin: 'https://modulo.example', issuer: 'https://id.example', subject: 'alice',
  workspace: 'personal', namespace: 'canvas', replica: 'replica' };
const record = (key: string, version = 1, value: number = version): StateRecord => ({ key, version, value,
  schemaId: 'number', schemaVersion: 1, deleted: false, createdAt: '', updatedAt: '' });
const memory = (): StatePersistence => {
  const values = new Map<string, StateSnapshot>();
  return { load: async key => values.get(key) ?? null,
    save: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))); } };
};
const transport = (): StateTransport => ({ get: vi.fn(async () => undefined),
  put: vi.fn(async (key, request) => ({ ...record(key, request.expectedVersion + 1), value: request.value })),
  delete: vi.fn(async (key, expected) => ({ ...record(key, expected + 1), value: null, deleted: true })),
  list: vi.fn(async () => ({ records: [] })) });
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('workspace state host', () => {
  it('provides one namespace-bound client and closes it immediately on account change', async () => {
    let session: StateSession | null = { issuer: scope.issuer, subject: 'alice', accessToken: 'a' };
    const host = new WorkspaceStateHost({ origin: scope.origin, replica: Promise.resolve('replica'),
      persistence: memory(), session: () => session, transport, autoRetry: false });
    const alice = await host.open('canvas'); expect(await host.open('canvas')).toBe(alice);
    await alice.set('a', 1, 'number', 1);
    session = { ...session, subject: 'bob', accessToken: 'b' }; host.sessionChanged();
    expect(alice.status).toBe('closed');
    const bob = await host.open('canvas'); expect(bob.list()).toEqual([]);
    session = null; host.sessionChanged(); expect(bob.status).toBe('closed');
    await expect(host.open('canvas')).rejects.toThrow('STATE_SESSION_UNAVAILABLE'); host.close();
  });
  it('does not open a stale account client after a delayed cache load', async () => {
    let session: StateSession | null = { issuer: scope.issuer, subject: 'alice', accessToken: 'a' };
    let loaded!: (value: StateSnapshot | null) => void;
    const persistence: StatePersistence = { load: () => new Promise(resolve => { loaded = resolve; }), save: vi.fn() };
    const host = new WorkspaceStateHost({ origin: scope.origin, replica: Promise.resolve('replica'),
      persistence, session: () => session, transport, autoRetry: false });
    const pending = host.open('canvas'); await Promise.resolve();
    session = null; host.sessionChanged(); loaded(null);
    await expect(pending).rejects.toThrow('STATE_SESSION_CHANGED'); host.close();
  });
  it('keeps clients through token renewal but uses the latest session for requests', async () => {
    let session: StateSession = { issuer: scope.issuer, subject: 'alice', accessToken: 'a' };
    const host = new WorkspaceStateHost({ origin: scope.origin, replica: Promise.resolve('replica'),
      persistence: memory(), session: () => session, transport, autoRetry: false });
    const client = await host.open('canvas');
    session = { ...session, accessToken: 'renewed' }; host.sessionChanged();
    expect(await host.open('canvas')).toBe(client); expect(client.status).not.toBe('closed'); host.close();
  });
  it('namespace capability is bound to the activating plugin and revoked on disable', async () => {
    let context!: PluginContext;
    const host = new WorkspaceStateHost({ origin: scope.origin, replica: Promise.resolve('replica'),
      persistence: memory(), session: () => ({ issuer: scope.issuer, subject: scope.subject, accessToken: 'token' }),
      transport, autoRetry: false });
    const runtime = new PluginRuntime([{ id: 'canvas', name: 'Canvas', category: 'test', description: '',
      builtin: true, icon: (() => null) as never, load: async () => ({ activate: ctx => { context = ctx; } }) }], host);
    await runtime.init(); const client = await context.state();
    expect(JSON.parse(client.partition)[4]).toBe('canvas');
    await expect(runtime.state('another-plugin')).rejects.toThrow('not enabled');
    await runtime.setEnabled('canvas', false); expect(client.status).toBe('closed');
    await expect(context.state()).rejects.toThrow('not enabled'); host.close();
  });
  it('refreshes on reconnect/focus and removes timers and listeners on teardown', async () => {
    vi.useFakeTimers(); const remote = transport();
    const host = new WorkspaceStateHost({ origin: scope.origin, replica: Promise.resolve('replica'),
      persistence: memory(), session: () => ({ issuer: scope.issuer, subject: scope.subject, accessToken: 'token' }),
      transport: () => remote, autoRetry: false });
    await host.open('canvas'); await host.synchronize(); vi.mocked(remote.list!).mockClear();
    const target = new EventTarget(); const stop = host.start(target as unknown as Window);
    target.dispatchEvent(new Event('online')); await host.synchronize(); expect(remote.list).toHaveBeenCalled();
    stop(); host.close(); expect(vi.getTimerCount()).toBe(0);
  });
  it('cloned tabs acquire different replica leases instead of overwriting a shared queue', async () => {
    const held = new Set<string>();
    const locks = { request: async (name: string, _options: unknown, callback: (lock: unknown) => Promise<void>) => {
      if (held.has(name)) return callback(null);
      held.add(name); try { await callback({ name }); } finally { held.delete(name); }
    } } as unknown as LockManager;
    const storage = new Map<string, string>();
    const adapter = { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) } as unknown as Storage;
    const first = acquireStateReplica(adapter, locks); const firstId = await first.replica;
    const second = acquireStateReplica(adapter, locks); const secondId = await second.replica;
    expect(firstId).not.toBe(secondId); first.close(); second.close();
  });
});

describe('remote state discovery', () => {
  it('fetches all pages and preserves a pending local edit against newer remote data', async () => {
    const remote = transport();
    remote.list = vi.fn(async cursor => cursor ? { records: [record('b')] } : { records: [record('a', 2)], nextCursor: 'a' });
    const client = await PluginStateClient.open(scope, memory(), remote, { autoRetry: false });
    await client.set('a', 99, 'number', 1); await client.refreshAll();
    expect(client.list().map(item => item.key)).toEqual(['a', 'b']);
    expect(client.get('a')).toMatchObject({ value: 99, pending: true });
    expect(remote.list).toHaveBeenCalledTimes(2); client.close();
  });
  it('removes cached records deleted remotely but retains offline local edits', async () => {
    const remote = transport(); vi.mocked(remote.list!).mockResolvedValueOnce({ records: [record('a'), record('b')] });
    const client = await PluginStateClient.open(scope, memory(), remote, { autoRetry: false });
    await client.refreshAll(); await client.set('b', 9, 'number', 1); await client.refreshAll();
    expect(client.list().map(item => item.key)).toEqual(['b']); expect(client.get('b')?.pending).toBe(true); client.close();
  });
  it('detects repeated cursors without looping or replacing the cache', async () => {
    const remote = transport(); vi.mocked(remote.list!).mockResolvedValue({ records: [], nextCursor: 'again' });
    const client = await PluginStateClient.open(scope, memory(), remote, { autoRetry: false });
    await client.set('local', 9, 'number', 1);
    await expect(client.refreshAll()).rejects.toThrow('STATE_INVALID_SERVER_CURSOR');
    expect(client.get('local')?.value).toBe(9); expect(remote.list).toHaveBeenCalledTimes(2); client.close();
  });
});
