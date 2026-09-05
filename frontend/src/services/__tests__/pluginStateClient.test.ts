import { describe, expect, it, vi } from 'vitest';
import {
  PluginStateClient, StateRequestError, type StatePersistence, type StateRecord,
  type StateScope, type StateSnapshot, type StateTransport,
} from '../pluginStateClient';
import { BrowserStatePersistence, createStateTransport } from '../pluginStateTransport';

const scope: StateScope = { origin: 'https://modulo.example', issuer: 'https://identity.example',
  subject: 'alice', workspace: 'personal', namespace: 'canvas', replica: 'device-a' };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function persistence(): StatePersistence {
  const values = new Map<string, StateSnapshot>();
  return { load: async key => values.has(key) ? clone(values.get(key)!) : null,
    save: async (key, value) => { values.set(key, clone(value)); } };
}
function server(): StateTransport {
  const records = new Map<string, StateRecord>();
  return {
    get: vi.fn(async key => records.has(key) ? clone(records.get(key)!) : undefined),
    put: vi.fn(async (key, request) => {
      const current = records.get(key);
      if ((current?.version ?? 0) !== request.expectedVersion) {
        throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', current && clone(current));
      }
      const record: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion,
        version: request.expectedVersion + 1, value: clone(request.value), deleted: false,
        createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z' };
      records.set(key, record); return clone(record);
    }),
    delete: vi.fn(async (key, version) => {
      const current = records.get(key);
      if (!current || current.version !== version) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', current);
      const deleted = { ...current, version: version + 1, deleted: true, value: null };
      records.set(key, deleted); return clone(deleted);
    }),
  };
}
const open = (storage = persistence(), transport = server(), selectedScope = scope) =>
  PluginStateClient.open(selectedScope, storage, transport, { autoRetry: false });

describe('plugin state offline client', () => {
  it('persists an offline edit before reporting success and replays after restart', async () => {
    const storage = persistence(); const remote = server();
    const client = await open(storage, remote);
    await client.set('board', { cards: [1] }, 'board', 1);
    expect(client.get('board')).toMatchObject({ value: { cards: [1] }, pending: true });
    client.close();
    const resumed = await open(storage, remote);
    expect(resumed.get('board')?.pending).toBe(true);
    await resumed.synchronize();
    expect(resumed.get('board')).toMatchObject({ value: { cards: [1] }, pending: false });
    expect(remote.put).toHaveBeenCalledTimes(1);
  });
  it('retains pending data when the network fails', async () => {
    const remote = server(); vi.mocked(remote.put).mockRejectedValueOnce(new TypeError('Network down'));
    const client = await open(persistence(), remote);
    await client.set('a', 1, 'number', 1); await client.synchronize();
    expect(client.status).toBe('offline'); expect(client.get('a')?.pending).toBe(true);
    await client.synchronize();
    expect(client.status).toBe('idle'); expect(client.get('a')?.pending).toBe(false);
  });
  it('preserves both conflicting edits while independent keys synchronize', async () => {
    const remote = server(); const a = await open(persistence(), remote);
    await a.set('board', 0, 'number', 1); await a.synchronize();
    const b = await open(persistence(), remote, { ...scope, replica: 'device-b' });
    await b.refresh('board');
    await a.set('board', 1, 'number', 1); await a.synchronize();
    await b.set('board', 2, 'number', 1); await b.set('other', 3, 'number', 1); await b.synchronize();
    expect(b.status).toBe('conflict');
    expect(b.get('board')).toMatchObject({ value: 2, pending: true,
      conflict: { base: { value: 0 }, remote: { value: 1 } } });
    expect(b.get('other')?.pending).toBe(false);
    await b.resolve('board', 'local'); await b.synchronize();
    expect(b.get('board')).toMatchObject({ value: 2, pending: false });
  });
  it('remote conflict resolution discards only the explicitly rejected local edit', async () => {
    const remote = server(); const a = await open(persistence(), remote); const b = await open(persistence(), remote);
    await a.set('a', 1, 'number', 1); await a.synchronize();
    await b.set('a', 2, 'number', 1); await b.synchronize();
    await b.resolve('a', 'remote');
    expect(b.get('a')).toMatchObject({ value: 1, pending: false });
  });
  it('an edit made while an earlier request is in flight survives acknowledgement', async () => {
    const remote = server(); const original = remote.put;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started!: () => void;
    const requested = new Promise<void>(resolve => { started = resolve; });
    remote.put = vi.fn(async (...args: Parameters<StateTransport['put']>) => { started(); await gate; return original(...args); });
    const client = await open(persistence(), remote);
    await client.set('a', 1, 'number', 1);
    const sync = client.synchronize(); await requested;
    await client.set('a', 2, 'number', 1); release(); await sync;
    expect(client.get('a')).toMatchObject({ value: 2, pending: false });
    expect(remote.put).toHaveBeenCalledTimes(2);
  });
  it('an uncertain successful response is reconciled without duplicating the write', async () => {
    const remote = server(); const original = remote.put;
    remote.put = vi.fn(async (...args: Parameters<StateTransport['put']>) => {
      const result = await original(...args);
      if (result.version === 1) throw new TypeError('Response lost');
      return result;
    });
    const client = await open(persistence(), remote);
    await client.set('a', { z: 1, a: 2 }, 'object', 1);
    await client.synchronize(); expect(client.status).toBe('offline');
    await client.synchronize(); expect(client.get('a')?.pending).toBe(false);
    expect((await remote.get('a', new AbortController().signal))?.version).toBe(1);
  });
  it('a refresh cannot silently rebase a pending create over another device', async () => {
    const remote = server(); const a = await open(persistence(), remote); const b = await open(persistence(), remote);
    await b.set('a', 2, 'number', 1);
    await a.set('a', 1, 'number', 1); await a.synchronize();
    await b.refresh('a'); await b.set('a', 3, 'number', 1); await b.synchronize();
    expect(b.status).toBe('conflict'); expect(b.get('a')?.value).toBe(3);
  });
  it('account partitions prevent another user from inheriting pending work', async () => {
    const storage = persistence(); const remote = server(); const a = await open(storage, remote);
    await a.set('private', 'alice data', 'text', 1); a.close();
    const b = await open(storage, remote, { ...scope, subject: 'bob' });
    expect(b.list()).toEqual([]); await b.synchronize(); expect(remote.put).not.toHaveBeenCalled();
  });
  it('closing during a request prevents delayed responses from restoring the old view', async () => {
    const remote = server(); let release!: (record: StateRecord | undefined) => void;
    remote.get = vi.fn(() => new Promise<StateRecord | undefined>(resolve => { release = resolve; }));
    const client = await open(persistence(), remote);
    const refresh = client.refresh('a'); client.close(); release(undefined);
    await expect(refresh).rejects.toThrow('closed');
    expect(client.status).toBe('closed'); expect(() => client.list()).toThrow('closed');
  });
  it('storage exhaustion rejects the edit without reporting a successful save', async () => {
    const storage = persistence(); const client = await open(storage);
    storage.save = vi.fn(async () => { throw new Error('Quota exceeded'); });
    await expect(client.set('a', 'unsaved', 'text', 1)).rejects.toThrow('Quota exceeded');
    expect(client.get('a')).toBeUndefined();
  });
  it('non-JSON values cannot be silently converted to different saved values', async () => {
    const client = await open();
    await expect(client.set('a', NaN, 'number', 1)).rejects.toThrow('finite JSON');
    await expect(client.set('a', Infinity, 'number', 1)).rejects.toThrow('finite JSON');
    expect(client.list()).toEqual([]);
  });
  it('a failing observer cannot invalidate a durable save or stop other observers', async () => {
    const client = await open(); const observer = vi.fn();
    client.watch(() => { throw new Error('Plugin observer failed'); }); client.watch(observer);
    await client.set('a', 1, 'number', 1);
    expect(observer).toHaveBeenCalled(); expect(client.get('a')?.value).toBe(1);
  });
  it('deletion survives restart and never resets server versions', async () => {
    const storage = persistence(); const remote = server(); const client = await open(storage, remote);
    await client.set('a', 1, 'number', 1); await client.synchronize();
    await client.delete('a'); client.close();
    const resumed = await open(storage, remote); await resumed.synchronize();
    expect(resumed.list()).toEqual([]);
    await resumed.set('a', 2, 'number', 1); await resumed.synchronize();
    expect((await remote.get('a', new AbortController().signal))?.version).toBe(3);
  });
  it('authentication failures stop replay and preserve queued work', async () => {
    const remote = server(); vi.mocked(remote.put).mockRejectedValue(new StateRequestError(401, 'expired'));
    const client = await open(persistence(), remote);
    await client.set('a', 1, 'number', 1); await client.synchronize();
    expect(client.status).toBe('error'); expect(client.get('a')?.pending).toBe(true);
  });
  it('invalid cache versions are preserved instead of reset', async () => {
    const storage = persistence(); storage.load = vi.fn(async () => ({ format: 99 } as unknown as StateSnapshot));
    storage.save = vi.fn();
    await expect(open(storage)).rejects.toThrow('Unsupported'); expect(storage.save).not.toHaveBeenCalled();
  });
  it('browser persistence reports corruption and storage errors to callers', async () => {
    const storage = { getItem: vi.fn(() => '{invalid'), setItem: vi.fn(() => { throw new Error('full'); }) };
    const adapter = new BrowserStatePersistence(storage as unknown as Storage);
    await expect(adapter.load('scope')).rejects.toThrow();
    await expect(adapter.save('scope', { format: 1, partition: 'scope', sequence: 0, entries: [] })).rejects.toThrow('full');
  });
  it('transport refuses to send an old account queue using a new account token', async () => {
    const fetcher = vi.fn();
    const transport = createStateTransport(scope,
      async () => ({ issuer: scope.issuer, subject: 'bob', accessToken: 'bob-token' }), fetcher);
    await expect(transport.get('a', new AbortController().signal)).rejects.toThrow('STATE_SESSION_CHANGED');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
