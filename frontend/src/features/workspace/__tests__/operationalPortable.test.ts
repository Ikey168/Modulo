import { afterEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport } from '../../../services/pluginStateClient';
import { IndexedDbStatePersistence } from '../../../services/pluginStateTransport';
import { portableOperationalStores, restoreOperationalStores } from '../operationalPortable';

const clients: PluginStateClient[] = [];
afterEach(() => { clients.forEach(client => client.close()); clients.length = 0; });

function account() {
  const records = new Map<string, StateRecord>();
  const transport = (namespace: string): StateTransport => ({
    get: async key => records.get(`${namespace}/${key}`),
    list: async () => ({ records: [...records.entries()].filter(([id]) => id.startsWith(`${namespace}/`)).map(([, record]) => record) }),
    put: async (key, request) => {
      const previous = records.get(`${namespace}/${key}`);
      if ((previous?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'conflict', previous);
      const record: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion, value: request.value,
        version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(`${namespace}/${key}`, record);
      return record;
    },
    delete: async (key, expectedVersion) => {
      const previous = records.get(`${namespace}/${key}`)!;
      const record = { ...previous, version: expectedVersion + 1, deleted: true, value: null };
      records.set(`${namespace}/${key}`, record);
      return record;
    },
  });
  const factory = new IDBFactory();
  const open = async (namespace: string) => {
    const client = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice',
      workspace: 'personal', namespace, replica: 'r' }, new IndexedDbStatePersistence(factory), transport(namespace), { autoRetry: false });
    clients.push(client);
    return client;
  };
  return { records, open };
}

const todo = (id: string, title: string) => ({ id, title, list: 'Inbox', priority: 'MEDIUM', done: false });

it('restores backup records into the per-record plugin layout and exports them back unchanged', async () => {
  const { records, open } = account();
  const todos = await open('todo-lists');
  await todos.set('record.stale', todo('stale', 'Not in backup'), 'modulo.todo', 1);
  await todos.synchronize();

  const backup = {
    'modulo-todos': [todo('a', 'Review'), todo('b', 'Ship')],
    'modulo-pipeline-stages': ['inquiry', 'audit', 'report'],
    'modulo-invoice-seller': { name: 'Seller', address: 'Berlin' },
  };
  const restored = await restoreOperationalStores(backup, open);
  expect(restored.sort()).toEqual(['modulo-invoice-seller', 'modulo-pipeline-stages', 'modulo-todos']);
  expect(records.get('todo-lists/record.a')?.schemaId).toBe('modulo.todo');
  expect(records.get('todo-lists/record.stale')?.deleted).toBe(true);
  expect(records.get('kanban/stages')?.value).toEqual(['inquiry', 'audit', 'report']);

  const fresh = async (namespace: string) => { const client = await open(namespace); await client.refreshAll(); return client.list(); };
  expect(portableOperationalStores({
    'todo-lists': await fresh('todo-lists'), kanban: await fresh('kanban'), rechnung: await fresh('rechnung'),
  })).toEqual(backup);
});

it('rejects an invalid backup record before writing anything', async () => {
  const { records, open } = account();
  await expect(restoreOperationalStores({ 'modulo-todos': [{ id: 'bad id', title: 'x' }] }, open)).rejects.toThrow();
  expect(records.size).toBe(0);
});
