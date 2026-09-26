import { afterEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport } from '../../../services/pluginStateClient';
import { IndexedDbStatePersistence } from '../../../services/pluginStateTransport';
import { MemoryStorage } from '../../../services/legacy/browserLegacyStorage';
import { replayLegacyStorage } from '../legacyReplay';

const clients: PluginStateClient[] = [];
afterEach(() => { clients.forEach(client => client.close()); clients.length = 0; });

function account(enabled: string[]) {
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
    delete: async () => { throw new Error('unused'); },
  });
  const factory = new IDBFactory();
  const open = async (namespace: string) => {
    const client = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice', workspace: 'personal',
      namespace, replica: 'r' }, new IndexedDbStatePersistence(factory), transport(namespace), { autoRetry: false });
    clients.push(client);
    return client;
  };
  return {
    records,
    targets: {
      workspace: (namespace: string) => open(`workspace-${namespace}`),
      plugin: (id: string) => enabled.includes(id) ? open(id) : Promise.reject(new Error('Plugin is not enabled')),
      catalog: [],
    },
  };
}

const todo = { id: 't1', title: 'Review', list: 'Inbox', priority: 'HIGH', done: false };

it('replays an export into each owner and is a no-op the second time', async () => {
  const { records, targets } = account(['todo-lists']);
  const values = {
    'modulo-modified-para-v1': JSON.stringify({ version: 1, areas: [{ id: 'home' }] }),
    'modulo-life-home-maintenance-v1': JSON.stringify({ version: 1, records: [] }),
    'modulo-todos': JSON.stringify([todo]),
  };
  const first = await replayLegacyStorage(new MemoryStorage(values), targets);
  expect(first.imported.sort()).toEqual(['modulo-life-home-maintenance-v1', 'modulo-modified-para-v1', 'modulo-todos']);
  expect(records.get('workspace-para/data')?.value).toEqual({ version: 1, areas: [{ id: 'home' }] });
  expect(records.get('workspace-life-collections/home-maintenance')?.schemaId).toBe('modulo.workspace.life-collection');
  expect(records.get('todo-lists/record.t1')?.value).toEqual(todo);
  const dataVersions = () => Object.fromEntries([...records.entries()].filter(([id]) => !id.includes('/migration'))
    .map(([id, record]) => [id, record.version]));
  const before = dataVersions();

  const second = await replayLegacyStorage(new MemoryStorage(values), targets);
  expect(second.skipped).toEqual([]);
  expect(dataVersions()).toEqual(before); // no data record was rewritten
});

it('explains every key it does not replay', async () => {
  const { targets } = account([]);
  const result = await replayLegacyStorage(new MemoryStorage({
    'unrelated-app-key': '1',
    'modulo-information-intake-v1': '{}',
    'modulo:audit-onboarding-events:v1': '[]',
    'modulo-euer-expenses': '[]',
  }), targets);
  expect(result.imported).toEqual([]);
  expect(Object.fromEntries(result.skipped.map(item => [item.key, item.reason]))).toEqual({
    'modulo-euer-expenses': 'Enable euer-datev to replay this data.',
    'modulo-information-intake-v1': 'Open Information Intake to review and import these research records.',
    'modulo:audit-onboarding-events:v1': 'transient data is not replayed.',
    'unrelated-app-key': 'Unknown key; it is not part of any Modulo store.',
  });
});
