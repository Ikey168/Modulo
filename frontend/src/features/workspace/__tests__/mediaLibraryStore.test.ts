import { describe, expect, it } from 'vitest';
import { PluginStateClient } from '../../../services/pluginStateClient';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { MEDIA_LIBRARY_STORE_KEY, type MediaItem } from '../mediaLibrary';
import {
  MEDIA_ITEM_SCHEMA,
  importLegacyMediaLibrary,
  mediaLibraryFromRecords,
  planMediaWrites,
} from '../mediaLibraryStore';
import { revisionsFromRecords, NOTE_REVISION_SCHEMA } from '../noteRevisionsStore';

const item = (id: string, title = id): MediaItem => ({
  id, title, type: 'Movie', status: 'Backlog', currentProgress: 0, totalProgress: 0,
  progressUnit: 'minutes', rating: 0, favorite: false, tags: [],
});
const record = (key: string, position: number, value = item(key)) =>
  ({ key, deleted: false, schemaId: MEDIA_ITEM_SCHEMA, value: { position, item: value } as never });

describe('per-item media library storage', () => {
  it('orders items by position and ignores foreign or broken records', () => {
    const view = mediaLibraryFromRecords([
      record('b', 2), record('a', 1),
      { key: 'migration.media-items', deleted: false, schemaId: 'modulo.migration', value: {} as never },
      { key: 'x', deleted: false, schemaId: MEDIA_ITEM_SCHEMA, value: { position: 3, item: item('other') } as never },
    ]);
    expect(view.data.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('writes only the changed item for an edit', () => {
    const current = mediaLibraryFromRecords([record('a', 1), record('b', 2), record('c', 3)]);
    const next = current.data.items.map((i) => (i.id === 'b' ? { ...i, rating: 5 } : i));
    const plan = planMediaWrites(current, next);
    expect(plan.set.map((w) => w.key)).toEqual(['b']);
    expect(plan.set[0].value.position).toBe(2);
    expect(plan.remove).toEqual([]);
  });

  it('prepends and appends without rewriting existing items, and deletes removed ones', () => {
    const current = mediaLibraryFromRecords([record('a', 1), record('b', 2)]);
    const plan = planMediaWrites(current, [item('new-first'), item('a'), item('new-last')]);
    expect(plan.set.map((w) => [w.key, w.value.position])).toEqual([['new-first', 0], ['new-last', 2]]);
    expect(plan.remove).toEqual(['b']);
  });

  it('moves an item between neighbours with one write', () => {
    const current = mediaLibraryFromRecords([record('a', 1), record('b', 2), record('c', 3)]);
    const plan = planMediaWrites(current, [item('a'), item('c'), item('b')]);
    expect(plan.set).toHaveLength(1);
    const after = mediaLibraryFromRecords([
      record('a', 1), record('b', 2), record('c', 3),
      ...plan.set.map((w) => record(w.key, w.value.position)),
    ].filter((r, i, all) => all.findLastIndex((x) => x.key === r.key) === i));
    expect(after.data.items.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('rejects duplicate or invalid ids', () => {
    const current = mediaLibraryFromRecords([]);
    expect(() => planMediaWrites(current, [item('a'), item('a')])).toThrow(/duplicate/);
    expect(() => planMediaWrites(current, [item('bad id/x')])).toThrow(/Invalid/);
  });

  it('imports browser-only media without replacing server items, then clears the browser copy', async () => {
    const memory = createMemoryWorkspace();
    memory.seed('media-library', 'kept', { position: 1, item: item('kept', 'Server title') }, MEDIA_ITEM_SCHEMA);
    const client: PluginStateClient = await memory.api.workspaceState('media-library');
    localStorage.setItem(MEDIA_LIBRARY_STORE_KEY, JSON.stringify({ version: 2, items: [item('kept', 'Browser title'), item('only-local')] }));
    expect(await importLegacyMediaLibrary(client)).toBe(1);
    const view = mediaLibraryFromRecords(memory.records('media-library'));
    expect(view.data.items.map((i) => [i.id, i.title])).toEqual([['kept', 'Server title'], ['only-local', 'only-local']]);
    expect(localStorage.getItem(MEDIA_LIBRARY_STORE_KEY)).toBeNull();
  });

  it('keeps the browser copy when the import cannot reach the server', async () => {
    const memory = createMemoryWorkspace();
    const client = await memory.api.workspaceState('media-library');
    localStorage.setItem(MEDIA_LIBRARY_STORE_KEY, JSON.stringify({ version: 2, items: [item('a')] }));
    (client as unknown as { transport: { put: () => Promise<never> } }).transport.put = async () => { throw new Error('offline'); };
    await expect(importLegacyMediaLibrary(client)).rejects.toThrow();
    expect(localStorage.getItem(MEDIA_LIBRARY_STORE_KEY)).not.toBeNull();
    localStorage.clear();
  });
});

describe('note revisions', () => {
  it('lists valid revisions newest first', () => {
    const rev = (id: string, date: string) => ({ key: id, deleted: false, schemaId: NOTE_REVISION_SCHEMA,
      value: { id, noteId: 1, title: 't', content: 'c', date } as never });
    expect(revisionsFromRecords([rev('a', '2026-01-01'), rev('b', '2026-02-01'),
      { key: 'x', deleted: false, schemaId: NOTE_REVISION_SCHEMA, value: { id: 'x' } as never }]).map((r) => r.id)).toEqual(['b', 'a']);
  });
});
