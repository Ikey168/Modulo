import { expect, it, vi } from 'vitest';
import { AndroidStatePersistence, androidStateReplica } from '../androidStatePersistence';
import type { StateSnapshot } from '../pluginStateClient';

const partition = '["https://modulo.example","issuer","subject","personal","notes","replica"]';
const snapshot: StateSnapshot = { format: 1, partition, sequence: 1, entries: [] };

it('round-trips the same partition through the native persistence contract', async () => {
  const values = new Map<string, string>();
  const cache = {
    load: vi.fn(async ({ partition: key }: { partition: string }) => ({ snapshot: values.get(key) ?? null })),
    save: vi.fn(async ({ partition: key, snapshot: value }: { partition: string; snapshot: string }) => {
      values.set(key, value);
    }),
  };
  const persistence = new AndroidStatePersistence(cache);
  expect(await persistence.load(partition)).toBeNull();
  await persistence.save(partition, snapshot);
  expect(await persistence.load(partition)).toEqual(snapshot);
  expect(await persistence.load('another-account')).toBeNull();
});

it('rejects a cross-account write before calling the native bridge', async () => {
  const cache = { load: vi.fn(async () => ({ snapshot: null })), save: vi.fn(async () => {}) };
  await expect(new AndroidStatePersistence(cache).save('another-account', snapshot)).rejects.toThrow('partition');
  expect(cache.save).not.toHaveBeenCalled();
});

it('propagates a failed native commit instead of reporting an edit saved', async () => {
  const cache = { load: vi.fn(async () => ({ snapshot: null })),
    save: vi.fn(async () => { throw new Error('SQLite full'); }) };
  await expect(new AndroidStatePersistence(cache).save(partition, snapshot)).rejects.toThrow('SQLite full');
});

it('reuses the native replica identity and rejects a missing identity', async () => {
  const cache = { replica: vi.fn(async () => ({ replica: 'stable-android-replica' })) };
  expect(await androidStateReplica(cache)).toBe('stable-android-replica');
  expect(await androidStateReplica(cache)).toBe('stable-android-replica');
  expect(cache.replica).toHaveBeenCalledTimes(2);
  await expect(androidStateReplica({ replica: async () => ({ replica: '' }) })).rejects.toThrow('unavailable');
});
