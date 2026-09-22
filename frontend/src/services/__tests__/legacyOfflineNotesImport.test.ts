import { expect, it, vi } from 'vitest';
import { LegacyNoteCacheMigration } from '../legacyOfflineNotesImport';
import type { NoteCachePersistence, OfflineNoteSnapshot } from '../offlineNotes';

const key = 'modulo.offline-notes.v1:["https://modulo.example","issuer","alice"]';
const old: OfflineNoteSnapshot = { version: 1, notes: [{ id: 1, title: 'Local', content: 'Draft', version: 1 }],
  pending: { '1': { body: { title: 'Local', content: 'Draft', version: 1 }, baseVersion: 1 } }, resources: {} };

function setup(snapshot: OfflineNoteSnapshot = old) {
  const values = new Map<string, OfflineNoteSnapshot>();
  const durable: NoteCachePersistence = { load: async name => structuredClone(values.get(name) ?? null),
    save: async (name, value) => { values.set(name, structuredClone(value)); } };
  const raw = JSON.stringify(snapshot);
  const source = new Map([[key, raw]]);
  const legacy = { getItem: vi.fn((name: string) => source.get(name) ?? null),
    removeItem: vi.fn((name: string) => { source.delete(name); }) } as unknown as Storage;
  return { durable, source, legacy, raw };
}

it('copies pending note edits before retiring browser bytes and resumes after reload', async () => {
  const { durable, source, legacy, raw } = setup();
  const migration = new LegacyNoteCacheMigration(durable, legacy);
  const copied = await migration.load(key);
  expect(copied?.legacySource).toBe(raw);
  expect(source.get(key)).toBe(raw);
  expect(await migration.load(key)).toEqual(copied);
  await migration.save(key, { ...copied!, notes: [{ id: 1, title: 'Local', content: 'Draft', version: 2 }], pending: {} });
  expect(source.has(key)).toBe(false);
});

it('retains source bytes when a different remote note wins or the cache write fails', async () => {
  const { durable, source, legacy } = setup();
  const migration = new LegacyNoteCacheMigration(durable, legacy);
  const copied = await migration.load(key);
  await migration.save(key, { ...copied!, notes: [{ id: 1, title: 'Remote', content: 'Changed', version: 2 }], pending: {} });
  expect(source.has(key)).toBe(true);
  durable.save = async () => { throw new Error('Disk full'); };
  await expect(migration.save(key, copied!)).rejects.toThrow('Disk full');
  expect(source.has(key)).toBe(true);
});

it('does not retire a pending tag edit when only the note text matches', async () => {
  const tagged = { ...old, pending: { '1': { ...old.pending['1'],
    body: { ...old.pending['1'].body, tagNames: ['Important'] } } } };
  const { durable, source, legacy } = setup(tagged);
  const migration = new LegacyNoteCacheMigration(durable, legacy);
  const copied = await migration.load(key);
  await migration.save(key, { ...copied!, notes: [{ id: 1, title: 'Local', content: 'Draft', version: 2 }], pending: {} });
  expect(source.has(key)).toBe(true);
});

it('preserves invalid or conflicting legacy caches for recovery', async () => {
  const { durable, source, legacy } = setup({ ...old, version: 2 as 1 });
  await expect(new LegacyNoteCacheMigration(durable, legacy).load(key)).rejects.toThrow('invalid');
  expect(source.has(key)).toBe(true);
  source.set(key, JSON.stringify(old));
  await durable.save(key, { ...old, notes: [{ id: 1, title: 'Other', content: 'Other', version: 2 }] });
  await expect(new LegacyNoteCacheMigration(durable, legacy).load(key)).rejects.toThrow('differ');
  expect(source.has(key)).toBe(true);
});
