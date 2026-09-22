import { expect, it, vi } from 'vitest';
import { LegacySnapshotMigration } from '../legacyStateImport';
import type { StatePersistence, StateSnapshot } from '../pluginStateClient';

const partition = 'server:issuer:alice:personal:notes:replica';
const snapshot: StateSnapshot = { format: 1, partition, sequence: 1, entries: [] };

function setup() {
  const values = new Map<string, StateSnapshot>();
  const durable: StatePersistence = {
    load: async key => values.get(key) ?? null,
    save: async (key, value) => { values.set(key, structuredClone(value)); },
  };
  const storage = new Map<string, string>([[`modulo.plugin-state.v1:${partition}`, JSON.stringify(snapshot)]]);
  const legacy = {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => { storage.delete(key); },
  } as Storage;
  return { durable, storage, legacy };
}

it('moves a legacy offline queue to durable storage before deleting the source', async () => {
  const { durable, storage, legacy } = setup();
  const migration = new LegacySnapshotMigration(durable, legacy);
  expect(await migration.load(partition)).toMatchObject(snapshot);
  expect(await durable.load(partition)).toMatchObject(snapshot);
  expect(storage.size).toBe(0);
});

it('retains queued source edits until a matching server record is durable', async () => {
  const { durable, storage, legacy } = setup();
  const pending: StateSnapshot = { format: 1, partition, sequence: 1, entries: [{ key: 'draft',
    pending: { sequence: 1, value: { text: 'offline' }, schemaId: 'note', schemaVersion: 1, deleted: false } }] };
  storage.set(`modulo.plugin-state.v1:${partition}`, JSON.stringify(pending));
  const migration = new LegacySnapshotMigration(durable, legacy);
  const copied = await migration.load(partition);
  expect(storage.size).toBe(1);
  const reopened = await migration.load(partition);
  expect(reopened).toEqual(copied);
  await migration.save(partition, { ...copied!, entries: [{ ...pending.entries[0], pending: undefined }] });
  expect(storage.size).toBe(1);
  await migration.save(partition, { ...copied!, entries: [{ key: 'draft', remote: { key: 'draft',
    schemaId: 'note', schemaVersion: 1, version: 1, value: { text: 'offline' }, deleted: false,
    createdAt: '2026-09-13T00:00:00Z', updatedAt: '2026-09-13T00:00:00Z' } }] });
  expect(storage.size).toBe(0);
});

it('retains the old queue when the durable write fails or a newer queue differs', async () => {
  const { durable, storage, legacy } = setup();
  durable.save = vi.fn(async () => { throw new Error('Quota exceeded'); });
  await expect(new LegacySnapshotMigration(durable, legacy).load(partition)).rejects.toThrow('Quota exceeded');
  expect(storage.size).toBe(1);
  durable.save = async () => {};
  durable.load = async () => ({ ...snapshot, sequence: 2 });
  await expect(new LegacySnapshotMigration(durable, legacy).load(partition)).rejects.toThrow('differ');
  expect(storage.size).toBe(1);
});

it('never imports a legacy queue into another account partition', async () => {
  const { durable, storage, legacy } = setup();
  storage.set(`modulo.plugin-state.v1:${partition}`, JSON.stringify({ ...snapshot, partition: 'other-account' }));
  await expect(new LegacySnapshotMigration(durable, legacy).load(partition)).rejects.toThrow('invalid');
  expect(storage.size).toBe(1);
});

it('retains a malformed queue instead of deleting its only copy', async () => {
  const { durable, storage, legacy } = setup();
  storage.set(`modulo.plugin-state.v1:${partition}`, JSON.stringify({ ...snapshot, sequence: -1 }));
  await expect(new LegacySnapshotMigration(durable, legacy).load(partition)).rejects.toThrow('invalid');
  expect(await durable.load(partition)).toBeNull();
  expect(storage.size).toBe(1);
});

it('rejects non-finite values before copying or retiring browser data', async () => {
  const { durable, storage, legacy } = setup();
  storage.set(`modulo.plugin-state.v1:${partition}`, '{"format":1,"partition":"' + partition
    + '","sequence":1,"entries":[{"key":"draft","pending":{"sequence":1,"value":1e309,"schemaId":"note","schemaVersion":1,"deleted":false}}]}');
  await expect(new LegacySnapshotMigration(durable, legacy).load(partition)).rejects.toThrow('invalid');
  expect(await durable.load(partition)).toBeNull();
  expect(storage.size).toBe(1);
});
