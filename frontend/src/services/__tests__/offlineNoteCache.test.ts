import { expect, it, vi } from 'vitest';
import { AndroidNoteCache } from '../offlineNoteCache';
import type { OfflineNoteSnapshot } from '../offlineNotes';

const snapshot: OfflineNoteSnapshot = { version: 1, notes: [], pending: {}, resources: {} };

it('partitions Android offline notes and waits for a native save', async () => {
  const values = new Map<string, string>();
  const bridge = { load: vi.fn(async ({ partition }: { partition: string }) => ({ snapshot: values.get(partition) ?? null })),
    save: vi.fn(async ({ partition, snapshot: value }: { partition: string; snapshot: string }) => {
      values.set(partition, value);
    }) };
  const cache = new AndroidNoteCache(bridge);
  expect(await cache.load('alice')).toBeNull();
  await cache.save('alice', snapshot);
  expect(await cache.load('alice')).toEqual(snapshot);
  expect(await cache.load('bob')).toBeNull();
  values.set('bob', JSON.stringify({ format: 1, partition: 'alice', document: snapshot }));
  await expect(cache.load('bob')).rejects.toThrow('partition');
});
