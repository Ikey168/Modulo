import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { NoteDraft, noteDraftKey } from '../noteDrafts';
import type { DeviceDocuments } from '../../../services/deviceDocuments';
import {
  createLifeOsBackup,
  LIFE_OS_STORE_KEY,
  collectLifeOsEntities,
} from '../lifeOs';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { restoreWorkspaceBackup } from '../restoreWorkspace';
import { entityPath } from '../entityNavigation';
import { WorkspaceCommandPalette } from '../WorkspaceCommandPalette';
import { WorkspaceRecordView } from '../WorkspaceRecordView';
import type { WorkspaceData } from '../useCoreWorkspace';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));

const note = (id = 7, title = 'Original', content = 'Body'): CoreNote => ({
  id,
  title,
  content,
  tags: [],
});
beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

class MemoryDocuments implements DeviceDocuments {
  values = new Map<string, string>();
  failWrites = false;
  async get<T>(key: string) { const raw = this.values.get(key); return raw === undefined ? undefined : JSON.parse(raw) as T; }
  async set(key: string, value: unknown) { if (this.failWrites) throw new Error('quota'); this.values.set(key, JSON.stringify(value)); }
  async remove(key: string) { this.values.delete(key); }
  async removeIfEqual(key: string, expected: unknown) {
    if (this.values.get(key) !== JSON.stringify(expected)) return false;
    this.values.delete(key); return true;
  }
}

describe('note save queue and device drafts', () => {
  it('does not acknowledge newer text when an older save completes', async () => {
    vi.useFakeTimers();
    const documents = new MemoryDocuments();
    let finish!: (value: boolean) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }))
      .mockResolvedValue(true);
    const draft = new NoteDraft(7, { title: 'Original', content: 'Body' }, save, documents);
    draft.change({ content: 'First' });
    const pending = draft.flush();
    draft.change({ content: 'Second' });
    expect(draft.snapshot.status).toBe('Unsaved');
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(documents.values.get(noteDraftKey(7))!)).toMatchObject({ content: 'Second' });
    finish(true);
    await pending;
    expect(save.mock.calls.map(([text]) => text.content)).toEqual(['First', 'Second']);
    expect(draft.snapshot.status).toBe('Saved');
    expect(documents.values.has(noteDraftKey(7))).toBe(false);
  });
  it('retains failed text across a new editor instance and retries', async () => {
    const documents = new MemoryDocuments();
    const failed = new NoteDraft(8, { title: 'A', content: '' }, async () => false, documents);
    failed.change({ content: 'Recovered text' });
    await failed.flush();
    expect(failed.snapshot.status).toBe('Save failed');
    const save = vi.fn().mockResolvedValue(true);
    const recovered = new NoteDraft(8, { title: 'A', content: '' }, save, documents);
    await recovered.loaded;
    expect(recovered.snapshot).toMatchObject({ content: 'Recovered text', status: 'Unsaved' });
    await recovered.flush();
    expect(save).toHaveBeenCalledWith({ title: 'A', content: 'Recovered text' });
  });
  it('keeps an independent tab draft when this tab finishes saving', async () => {
    const documents = new MemoryDocuments();
    let finish!: (value: boolean) => void;
    const draft = new NoteDraft(7, { title: 'A', content: '' }, () => new Promise((resolve) => { finish = resolve; }), documents);
    draft.change({ content: 'This tab' });
    const pending = draft.flush();
    await Promise.resolve();
    await documents.set(noteDraftKey(7), { title: 'A', content: 'Other tab' });
    finish(true);
    await pending;
    expect(documents.values.get(noteDraftKey(7))).toContain('Other tab');
  });
  it('reports a draft that device storage could not keep and still saves remotely', async () => {
    const documents = new MemoryDocuments();
    documents.failWrites = true;
    const draft = new NoteDraft(7, { title: 'A', content: '' }, async () => true, documents);
    draft.change({ content: 'Keep me' });
    await vi.waitFor(() => expect(draft.snapshot.local).toBe(false));
    await draft.flush();
    expect(draft.snapshot.status).toBe('Saved');
  });
  it('moves an older browser-profile draft into device storage once', async () => {
    const documents = new MemoryDocuments();
    localStorage.setItem(noteDraftKey(9), JSON.stringify({ title: 'Old', content: 'From an older build' }));
    const draft = new NoteDraft(9, { title: 'Old', content: '' }, async () => true, documents);
    await draft.loaded;
    expect(draft.snapshot).toMatchObject({ content: 'From an older build', status: 'Unsaved' });
    expect(localStorage.getItem(noteDraftKey(9))).toBeNull();
    expect(documents.values.get(noteDraftKey(9))).toContain('From an older build');
  });
});

describe('portable relationships', () => {
  it('round-trips source note references, note links, tags, and hierarchy onto new IDs', async () => {
    const a = { ...note(7), tags: [{ id: 'tag', name: 'science' }] },
      b = note(9, 'Target');
    const key = 'modulo-life-flashcards-spaced-repetition-v1';
    const stores = {
      [key]: { version: 1, records: [{ id: 'card', title: 'Question', values: { sourceNoteId: '7', source: 'note:7' } }] },
      [LIFE_OS_STORE_KEY]: {
        version: 1,
        relations: [{ id: 'r', fromUid: 'core:notes:7', toUid: `${key}:records:card`, type: 'Cites', label: '' }],
        reviews: [],
      },
      'modulo-note-tree': { 9: { parent: 7, order: 0 } },
    };
    const backup = createLifeOsBackup(
      [a, b],
      [{ id: 'l', sourceNoteId: 7, targetNoteId: 9, linkType: 'RELATED' }],
      [],
      stores,
    );
    let next = 100;
    const create = vi.fn(async (title: string, content: string) =>
      note(next++, title, content),
    );
    const operations = {
      links: [],
      createLink: vi.fn().mockResolvedValue(true),
      addTag: vi.fn().mockResolvedValue(true),
      trashNote: vi.fn().mockResolvedValue(true),
    };
    let restored: Record<string, unknown> = {};
    const result = await restoreWorkspaceBackup(backup, [], create, false, operations, {
      current: {},
      restoreServer: async (planned) => { restored = planned; return Object.keys(planned); },
    });
    expect(result.importedNotes).toBe(2);
    expect((restored[key] as { records: { values: unknown }[] }).records[0].values).toMatchObject({ sourceNoteId: '100', source: 'note:100' });
    expect(JSON.stringify(restored[LIFE_OS_STORE_KEY])).toContain('core:notes:100');
    expect(restored['modulo-note-tree']).toEqual({ 101: { parent: 100, order: 0 } });
    expect(operations.createLink).toHaveBeenCalledWith(100, 101, 'RELATED');
    expect(operations.addTag).toHaveBeenCalledWith(100, 'science');
  });
  it('reuses matching notes and does not duplicate existing links on retry', async () => {
    const backup = createLifeOsBackup(
      [note(7), note(9, 'Target')],
      [{ id: 'x', sourceNoteId: 7, targetNoteId: 9, linkType: 'RELATED' }],
    );
    const create = vi.fn();
    const operations = {
      links: [
        {
          id: 'existing',
          sourceNoteId: 100,
          targetNoteId: 101,
          linkType: 'RELATED',
        },
      ],
      createLink: vi.fn(),
      addTag: vi.fn(),
      trashNote: vi.fn(),
    };
    await restoreWorkspaceBackup(
      backup,
      [note(100), note(101, 'Target')],
      create,
      false,
      operations,
    );
    expect(create).not.toHaveBeenCalled();
    expect(operations.createLink).not.toHaveBeenCalled();
  });
  it('rejects unmappable references before creating notes', async () => {
    const backup = createLifeOsBackup([note()]);
    backup.stores[LIFE_OS_STORE_KEY] = {
      relations: [{ fromUid: 'core:notes:999' }],
    };
    const create = vi.fn();
    await expect(restoreWorkspaceBackup(backup, [], create)).rejects.toThrow(
      /without a matching/,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects malformed stores before any remote note creation', async () => {
    const backup = createLifeOsBackup([note()]);
    backup.stores['modulo-media-library-v2'] = { items: 'invalid' };
    const create = vi.fn();
    await expect(restoreWorkspaceBackup(backup, [], create)).rejects.toThrow(/Invalid collection/);
    expect(create).not.toHaveBeenCalled();
  });
  it('names untitled notes in portable exports', () => {
    const backup = createLifeOsBackup([note(7, '', 'Body')]);
    expect(backup.notes[0]).toMatchObject({ title: 'Untitled Note', content: 'Body', originalId: 7 });
  });
  it('reports a failed server restore instead of claiming success', async () => {
    const backup = createLifeOsBackup([], [], [], { 'modulo-workout-planner-v1': { version: 1, workouts: [{ id: 'new' }] } });
    await expect(restoreWorkspaceBackup(backup, [], vi.fn(), true, undefined, {
      current: {},
      restoreServer: async () => { throw new Error('Server restore did not finish synchronizing.'); },
    })).rejects.toThrow(/did not finish/);
  });
});

describe('workspace search and exact navigation', () => {
  it('resolves IDs containing colons and root-array records', () => {
    const entity = collectLifeOsEntities([], { 'modulo-media-library-v2': { items: [{ id: 'a:b', title: 'Exact' }] } })[0];
    expect(entityPath(entity)).toContain('record=modulo-media-library-v2%3Aitems%3Aa%3Ab');
    const time = collectLifeOsEntities([], { 'modulo-time-entries': [{ id: 'time', description: 'Work' }] });
    expect(time.map((item) => item.uid)).toContain('modulo-time-entries:$root:time');
  });
  it('opens the exact result and reports missing records explicitly', () => {
    const navigate = vi.fn();
    render(
      <WorkspaceCommandPalette
        open
        onOpenChange={vi.fn()}
        data={{} as WorkspaceData}
        views={[]}
        entities={collectLifeOsEntities([note(7, 'Find me')])}
        navigate={navigate}
      />,
    );
    fireEvent.change(
      screen.getByPlaceholderText('Search notes, records, or views…'),
      { target: { value: 'Find me' } },
    );
    fireEvent.click(screen.getByText('Find me'));
    expect(navigate).toHaveBeenCalledWith('notes?note=7');
    cleanup();
    render(
      <WorkspaceRecordView
        uid="gone:records:missing"
        entities={[]}
        onClose={vi.fn()}
        navigate={navigate}
      />,
    );
    expect(screen.getByText('Record unavailable')).toBeTruthy();
  });
  it('retains quick capture text after failure and prevents duplicate submits', async () => {
    let finish!: (value: CoreNote | null) => void;
    const createNote = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(note(10, 'Capture'));
    const navigate = vi.fn();
    render(
      <WorkspaceCommandPalette
        open
        onOpenChange={vi.fn()}
        data={{ createNote } as unknown as WorkspaceData}
        views={[]}
        entities={[]}
        navigate={navigate}
      />,
    );
    await act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    fireEvent.click(screen.getByText('Quick capture a note'));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Capture' },
    });
    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'Keep this text' },
    });
    fireEvent.click(screen.getByText('Create note'));
    expect(screen.getByText('Saving…')).toHaveProperty('disabled', true);
    await act(async () => finish(null));
    expect(screen.getByLabelText('Note')).toHaveProperty(
      'value',
      'Keep this text',
    );
    fireEvent.click(screen.getByText('Create note'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('notes?note=10'));
    expect(createNote).toHaveBeenCalledTimes(2);
  });
});
