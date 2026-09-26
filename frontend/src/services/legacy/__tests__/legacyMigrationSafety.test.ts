import { afterEach, beforeEach, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport } from '../../pluginStateClient';
import { IndexedDbStatePersistence } from '../../pluginStateTransport';
import { MemoryStorage } from '../browserLegacyStorage';
import { importLegacyState } from '../legacyStateImport';
import {
  IndexedDbLegacyRecovery, accountOfPartition, legacyRecoveryFile, setLegacyRecoveryStore, storageFromRecoveryFile,
} from '../legacyRecovery';

const clients: PluginStateClient[] = [];
let recovery: IndexedDbLegacyRecovery;
beforeEach(() => { recovery = new IndexedDbLegacyRecovery(new IDBFactory()); setLegacyRecoveryStore(recovery); });
afterEach(() => { clients.forEach(client => client.close()); clients.length = 0; setLegacyRecoveryStore(undefined); });

function server(options: { online?: () => boolean; conflict?: StateRecord } = {}) {
  const records = new Map<string, StateRecord>(options.conflict ? [[options.conflict.key, options.conflict]] : []);
  let puts = 0;
  const transport: StateTransport = {
    get: async key => records.get(key),
    list: async () => { if (options.online && !options.online()) throw new TypeError('offline'); return { records: [...records.values()] }; },
    put: async (key, request) => {
      if (options.online && !options.online()) throw new TypeError('offline');
      puts++;
      const previous = records.get(key);
      if ((previous?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'conflict', previous);
      const record: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion, value: request.value,
        version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record);
      return record;
    },
    delete: async () => { throw new Error('unused'); },
  };
  return { records, transport, puts: () => puts };
}
async function open(transport: StateTransport, subject = 'alice') {
  const client = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject, workspace: 'personal',
    namespace: 'workspace-para', replica: 'r' }, new IndexedDbStatePersistence(new IDBFactory()), transport, { autoRetry: false });
  clients.push(client);
  return client;
}
const areas = JSON.stringify({ version: 1, areas: [{ id: 'home', title: 'Home', checked: ['sleep'] }] });
const validate = (value: unknown) => value as never;

it('preserves a recovery copy before writing and keeps it when the import fails', async () => {
  const existing: StateRecord = { key: 'data', schemaId: 'modulo.workspace.para', schemaVersion: 1, version: 3,
    value: { version: 1, areas: [] }, deleted: false, createdAt: '', updatedAt: '' };
  const { transport, puts } = server({ conflict: existing });
  const client = await open(transport);
  const storage = new MemoryStorage({ 'modulo-modified-para-v1': areas });

  await expect(importLegacyState(client, storage, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate))
    .rejects.toThrow('Browser settings are preserved');
  expect(puts()).toBe(0);
  expect(storage.getItem('modulo-modified-para-v1')).toBe(areas);
  const copies = await recovery.list(accountOfPartition(client.partition));
  expect(copies.map(copy => [copy.key, copy.value])).toEqual([['modulo-modified-para-v1', areas]]);
});

it('verifies the acknowledged value, retires the key, and replays from the export without duplicates', async () => {
  const { records, transport, puts } = server();
  const client = await open(transport);
  const storage = new MemoryStorage({ 'modulo-modified-para-v1': areas });
  await importLegacyState(client, storage, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate);
  expect(storage.getItem('modulo-modified-para-v1')).toBeNull();
  expect(records.get('data')?.value).toEqual(JSON.parse(areas));
  const writes = puts();

  // The browser key is gone; the durable export still restores the same data idempotently.
  const file = JSON.parse(JSON.stringify(await legacyRecoveryFile(accountOfPartition(client.partition))));
  const replay = storageFromRecoveryFile(file, accountOfPartition(client.partition));
  await importLegacyState(client, replay, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate);
  expect(records.get('data')?.version).toBe(1);
  expect(puts()).toBe(writes + 1); // only the migration marker is rewritten
});

it('refuses to replay an export into another account', async () => {
  const { transport } = server();
  const alice = await open(transport, 'alice');
  const storage = new MemoryStorage({ 'modulo-modified-para-v1': areas });
  await importLegacyState(alice, storage, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate);
  const file = await legacyRecoveryFile(accountOfPartition(alice.partition));
  const bob = await open(transport, 'bob');
  expect(() => storageFromRecoveryFile(file, accountOfPartition(bob.partition))).toThrow('another account');
});

it('cannot deliver or retire data after the account changes mid-migration', async () => {
  let online = false;
  const { records, transport } = server({ online: () => online });
  const client = await open(transport);
  const storage = new MemoryStorage({ 'modulo-modified-para-v1': areas });
  // Observe the outcome at once: the offline refresh may reject before the client is closed.
  const migration = importLegacyState(client, storage, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate)
    .then(() => undefined, (error: unknown) => error);
  await new Promise(resolve => setTimeout(resolve, 0));
  client.close(); // sign-out or account switch closes every client of the old principal
  online = true;
  expect(await migration).toBeInstanceOf(Error);
  expect(records.size).toBe(0);
  expect(storage.getItem('modulo-modified-para-v1')).toBe(areas);
});

it('names the key of invalid browser data and leaves it untouched', async () => {
  const { transport } = server();
  const client = await open(transport);
  const storage = new MemoryStorage({ 'modulo-modified-para-v1': '{not json' });
  await expect(importLegacyState(client, storage, 'modulo-modified-para-v1', 'data', 'modulo.workspace.para', validate))
    .rejects.toThrow('Browser data “modulo-modified-para-v1” could not be imported');
  expect(storage.getItem('modulo-modified-para-v1')).toBe('{not json');
});
