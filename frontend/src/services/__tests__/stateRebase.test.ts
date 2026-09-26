import { afterEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { PluginStateClient, StateRequestError, type StateJson, type StateRecord, type StateTransport } from '../pluginStateClient';
import { IndexedDbStatePersistence } from '../pluginStateTransport';

const generation = '00000000-0000-0000-0000-000000000001';
const clients: PluginStateClient[] = [];
afterEach(() => { clients.forEach(client => client.close()); clients.length = 0; });

function server() {
  const records = new Map<string, StateRecord>();
  const transport = (): StateTransport => ({
    generation: async () => generation,
    get: async key => records.get(key),
    list: async () => ({ records: [...records.values()] }),
    put: async (key, request) => {
      const previous = records.get(key);
      if ((previous?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', previous);
      const record: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion, value: request.value,
        version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record);
      return record;
    },
    delete: async () => { throw new Error('unused'); },
  });
  const open = async (replica: string) => {
    const client = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice',
      workspace: 'personal', namespace: 'para', replica }, new IndexedDbStatePersistence(new IDBFactory()), transport(), { autoRetry: false });
    clients.push(client);
    return client;
  };
  return { records, open };
}

const doc = (areas: Array<Record<string, StateJson>>) => ({ version: 1, areas });

it('rebases concurrent edits to different records instead of raising a conflict', async () => {
  const { records, open } = server();
  const desktop = await open('desktop');
  await desktop.set('data', doc([{ id: 'home', title: 'Home' }, { id: 'health', title: 'Health' }]), 'modulo.workspace.para', 1);
  await desktop.synchronize();
  const phone = await open('phone');
  await phone.refreshAll();

  await desktop.set('data', doc([{ id: 'home', title: 'Home', icon: 'house' }, { id: 'health', title: 'Health' }]), 'modulo.workspace.para', 1);
  await phone.set('data', doc([{ id: 'home', title: 'Home' }, { id: 'health', title: 'Health', checked: ['sleep'] }]), 'modulo.workspace.para', 1);
  await desktop.synchronize();
  await phone.synchronize();

  expect(phone.conflicts()).toEqual([]);
  expect(records.get('data')?.value).toEqual(doc([
    { id: 'home', title: 'Home', icon: 'house' }, { id: 'health', title: 'Health', checked: ['sleep'] }]));
  expect(records.get('data')?.version).toBe(3);
});

it('never replaces an existing server document with a device default created before hydration', async () => {
  const { records, open } = server();
  const desktop = await open('desktop');
  await desktop.set('data', doc([{ id: 'desk', title: 'Created on desktop' }]), 'modulo.workspace.para', 1);
  await desktop.synchronize();

  const phone = await open('phone'); // no refresh: the phone edits its empty default
  await phone.set('data', doc([{ id: 'phone', title: 'Captured offline' }]), 'modulo.workspace.para', 1);
  await phone.synchronize();

  // A local addition without a surviving predecessor is placed first, as new records are prepended.
  expect(records.get('data')?.value).toEqual(doc([
    { id: 'phone', title: 'Captured offline' }, { id: 'desk', title: 'Created on desktop' }]));
});

it('keeps a real same-field conflict for review', async () => {
  const { records, open } = server();
  const desktop = await open('desktop');
  await desktop.set('data', doc([{ id: 'home', title: 'Home' }]), 'modulo.workspace.para', 1);
  await desktop.synchronize();
  const phone = await open('phone');
  await phone.refreshAll();
  await desktop.set('data', doc([{ id: 'home', title: 'House' }]), 'modulo.workspace.para', 1);
  await phone.set('data', doc([{ id: 'home', title: 'Household' }]), 'modulo.workspace.para', 1);
  await desktop.synchronize();
  await phone.synchronize();

  expect(phone.conflicts().map(entry => entry.key)).toEqual(['data']);
  expect(records.get('data')?.value).toEqual(doc([{ id: 'home', title: 'House' }]));
  expect(phone.get('data')?.value).toEqual(doc([{ id: 'home', title: 'Household' }]));
});

it('does not merge schemas outside the workspace document family', async () => {
  const { open } = server();
  const desktop = await open('desktop');
  await desktop.set('config', { a: 1 }, 'plugin.config', 1);
  await desktop.synchronize();
  const phone = await open('phone');
  await phone.set('config', { b: 2 }, 'plugin.config', 1);
  await phone.synchronize();
  expect(phone.conflicts().map(entry => entry.key)).toEqual(['config']);
});
