import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { StatePersistence, StateSnapshot } from '../pluginStateClient';
import { IndexedDbStatePersistence } from '../pluginStateTransport';
import { AndroidStatePersistence } from '../androidStatePersistence';
import type { NativeStateCacheBridge } from '../nativeStateCacheBridge';

/**
 * Both device adapters hold the same offline queue contract. The Android
 * adapter is exercised through a fake of the native SQLite bridge that, like
 * ModuloStateCachePlugin, stores the serialized snapshot per partition and
 * only resolves after the write committed.
 */
function fakeNativeBridge(options: { failWrites?: boolean } = {}): Pick<NativeStateCacheBridge, 'load' | 'save'> {
  const rows = new Map<string, string>();
  return {
    load: async ({ partition }) => ({ snapshot: rows.get(partition) ?? null }),
    save: async ({ partition, snapshot }) => {
      if (options.failWrites) throw new Error('SQLITE_FULL: database or disk is full');
      rows.set(partition, snapshot);
    },
  };
}

type Adapter = { name: string; create: () => { open: () => StatePersistence; failing: () => StatePersistence } };
const adapters: Adapter[] = [
  { name: 'IndexedDB (web, Electron)', create: () => {
    const factory = new IDBFactory();
    return { open: () => new IndexedDbStatePersistence(factory), failing: () => new IndexedDbStatePersistence({
      open: () => { throw new DOMException('quota', 'QuotaExceededError'); } } as unknown as IDBFactory) };
  } },
  { name: 'SQLite bridge (Android)', create: () => {
    const bridge = fakeNativeBridge();
    return { open: () => new AndroidStatePersistence(bridge), failing: () => new AndroidStatePersistence(fakeNativeBridge({ failWrites: true })) };
  } },
];

const snapshot = (partition: string, sequence = 1): StateSnapshot => ({ format: 1, partition, sequence, generation: '00000000-0000-0000-0000-000000000001',
  entries: [{ key: 'data', pending: { sequence, value: { areas: [{ id: 'home', checked: ['sleep'] }], note: 'ä ✓ 🧭' },
    schemaId: 'modulo.workspace.para', schemaVersion: 1, deleted: false } }] });

describe.each(adapters)('state persistence contract: $name', ({ create }) => {
  it('returns nothing for an unknown partition', async () => {
    expect(await create().open().load('["https://a","issuer","alice","personal","para","r1"]')).toBeNull();
  });

  it('round-trips a pending queue losslessly and survives reopening (process death)', async () => {
    const device = create();
    const partition = '["https://a","issuer","alice","personal","para","r1"]';
    await device.open().save(partition, snapshot(partition, 3));
    expect(await device.open().load(partition)).toEqual(snapshot(partition, 3));
  });

  it('keeps accounts, servers and namespaces in separate partitions', async () => {
    const device = create();
    const alice = '["https://a","issuer","alice","personal","para","r1"]';
    const bob = '["https://a","issuer","bob","personal","para","r1"]';
    const otherServer = '["https://b","issuer","alice","personal","para","r1"]';
    const persistence = device.open();
    await persistence.save(alice, snapshot(alice, 1));
    await persistence.save(bob, snapshot(bob, 2));
    expect(await persistence.load(otherServer)).toBeNull();
    expect((await persistence.load(alice))?.sequence).toBe(1);
    expect((await persistence.load(bob))?.sequence).toBe(2);
  });

  it('replaces the partition atomically on each save', async () => {
    const device = create();
    const partition = '["https://a","issuer","alice","personal","para","r1"]';
    const persistence = device.open();
    await persistence.save(partition, snapshot(partition, 1));
    await persistence.save(partition, { ...snapshot(partition, 2), entries: [] });
    expect(await persistence.load(partition)).toMatchObject({ sequence: 2, entries: [] });
  });

  it('rejects a snapshot addressed to another partition', async () => {
    const partition = '["https://a","issuer","alice","personal","para","r1"]';
    await expect(create().open().save(partition, snapshot('["other"]'))).rejects.toThrow('partition mismatch');
  });

  it('rejects the write when the device store cannot commit it', async () => {
    const partition = '["https://a","issuer","alice","personal","para","r1"]';
    await expect(create().failing().save(partition, snapshot(partition))).rejects.toThrow();
  });
});
