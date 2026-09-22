import {
  PluginStateClient,
  StateRequestError,
  type StateRecord,
  type StateTransport,
} from '../../services/pluginStateClient';

/**
 * In-memory stand-in for the server plugin-state API. Real PluginStateClients
 * run against it, so hooks exercise the same cache/outbox/sync path as in the app.
 * Use with: vi.mock('<path>/plugins/PluginProvider', () => ({ usePlugins: () => memory.api }))
 */
export function createMemoryWorkspace(session = 'alice') {
  const server = new Map<string, Map<string, StateRecord>>();
  const clients = new Map<string, Promise<PluginStateClient>>();
  const table = (namespace: string) => {
    let records = server.get(namespace);
    if (!records) server.set(namespace, (records = new Map()));
    return records;
  };
  const transport = (namespace: string): StateTransport => ({
    get: async (key) => table(namespace).get(key),
    list: async () => ({ records: [...table(namespace).values()] }),
    put: async (key, request) => {
      const records = table(namespace);
      const old = records.get(key);
      if ((old?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', old);
      const record: StateRecord = { key, ...request, version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record);
      return record;
    },
    delete: async (key, expectedVersion) => {
      const records = table(namespace);
      const old = records.get(key);
      if (!old || old.version !== expectedVersion) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', old);
      const record: StateRecord = { ...old, value: null, deleted: true, version: old.version + 1 };
      records.set(key, record);
      return record;
    },
  });
  const open = (namespace: string) => {
    let client = clients.get(namespace);
    if (!client) {
      client = PluginStateClient.open(
        { origin: 'https://app', issuer: 'https://id', subject: session, workspace: 'personal', namespace, replica: 'test' },
        { load: async () => null, save: async () => {} },
        transport(namespace),
        { autoRetry: false },
      ).then(async (opened) => { await opened.refreshAll(); return opened; });
      clients.set(namespace, client);
    }
    return client;
  };
  const api = {
    stateSessionKey: session,
    isEnabled: () => true,
    isInstalled: () => true,
    state: open,
    workspaceState: open,
  };
  return {
    api,
    /** Server-side value of a record (after sync), or undefined. */
    value: (namespace: string, key: string): unknown => {
      const record = table(namespace).get(key);
      return record && !record.deleted ? record.value : undefined;
    },
    /** Every live server record in a namespace (for per-item stores such as the media library). */
    records: (namespace: string): StateRecord[] => [...table(namespace).values()].filter((record) => !record.deleted),
    /** Seed a server record before rendering. */
    seed: (namespace: string, key: string, value: unknown, schemaId: string) => {
      table(namespace).set(key, {
        key, value: JSON.parse(JSON.stringify(value)), schemaId, schemaVersion: 1, version: 1, deleted: false, createdAt: '', updatedAt: '',
      } as StateRecord);
    },
    /** Push every client's pending writes to the in-memory server. */
    flush: async () => {
      // A synchronize() already in flight may predate the newest edit, so repeat until nothing is pending.
      for (let round = 0; round < 20; round++) {
        const opened = await Promise.all(clients.values());
        await Promise.all(opened.map((client) => client.synchronize()));
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!opened.some((client) => client.list().some((record) => record.pending) || client.recoverySnapshot().entries.some((entry) => entry.pending))) return;
      }
    },
    reset: () => { server.clear(); clients.clear(); },
  };
}
