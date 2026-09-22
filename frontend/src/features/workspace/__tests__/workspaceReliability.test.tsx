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
import { writeWorkspaceJson } from '../workspaceStorage';
import {
  readRecovery,
  recoverEntry,
  reverseChange,
} from '../workspaceRecovery';
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

describe('note save queue and recovery', () => {
  it('does not acknowledge newer text when an older save completes', async () => {
    vi.useFakeTimers();
    let finish!: (value: boolean) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(true);
    const draft = new NoteDraft(
      7,
      { title: 'Original', content: 'Body' },
      save,
    );
    draft.change({ content: 'First' });
    const pending = draft.flush();
    draft.change({ content: 'Second' });
    expect(draft.snapshot.status).toBe('Unsaved');
    expect(JSON.parse(localStorage.getItem(noteDraftKey(7))!)).toMatchObject({
      content: 'Second',
    });
    finish(true);
    await pending;
    expect(save.mock.calls.map(([text]) => text.content)).toEqual([
      'First',
      'Second',
    ]);
    expect(draft.snapshot.status).toBe('Saved');
    expect(localStorage.getItem(noteDraftKey(7))).toBeNull();
  });
  it('retains failed text across a new editor instance and retries', async () => {
    vi.useFakeTimers();
    const failed = new NoteDraft(
      8,
      { title: 'A', content: '' },
      async () => false,
    );
    failed.change({ content: 'Recovered text' });
    await failed.flush();
    expect(failed.snapshot.status).toBe('Save failed');
    const save = vi.fn().mockResolvedValue(true);
    const recovered = new NoteDraft(8, { title: 'A', content: '' }, save);
    expect(recovered.snapshot.content).toBe('Recovered text');
    await recovered.flush();
    expect(save).toHaveBeenCalledWith({
      title: 'A',
      content: 'Recovered text',
    });
  });
  it('keeps an independent tab draft when this tab finishes saving', async () => {
    vi.useFakeTimers();
    let finish!: (value: boolean) => void;
    const draft = new NoteDraft(
      7,
      { title: 'A', content: '' },
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    draft.change({ content: 'This tab' });
    const pending = draft.flush();
    localStorage.setItem(
      noteDraftKey(7),
      JSON.stringify({ title: 'A', content: 'Other tab' }),
    );
    finish(true);
    await pending;
    expect(localStorage.getItem(noteDraftKey(7))).toContain('Other tab');
  });
  it('can save remotely even when draft persistence fails', async () => {
    vi.useFakeTimers();
    const draft = new NoteDraft(
      7,
      { title: 'A', content: '' },
      async () => true,
    );
    const storage = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    draft.change({ content: 'Keep me' });
    expect(draft.snapshot.local).toBe(false);
    storage.mockRestore();
    await draft.flush();
    expect(draft.snapshot.status).toBe('Saved');
  });
});

describe('local change recovery', () => {
  it('restores a deleted record and its links while preserving a later unrelated edit', async () => {
    const records = {
      records: [
        { id: 'a', title: 'Deleted' },
        { id: 'b', title: 'Other' },
      ],
    };
    localStorage.setItem('records', JSON.stringify(records));
    localStorage.setItem(
      'links',
      JSON.stringify({ relations: [{ id: 'link', fromUid: 'a', toUid: 'b' }] }),
    );
    writeWorkspaceJson('records', { records: [records.records[1]] });
    writeWorkspaceJson('links', { relations: [] });
    const deletion = readRecovery()[0];
    expect(deletion.deleted).toBe(true);
    await Promise.resolve();
    writeWorkspaceJson('records', { records: [{ id: 'b', title: 'Later' }] });
    recoverEntry(deletion.id);
    expect(JSON.parse(localStorage.getItem('records')!).records).toEqual(
      expect.arrayContaining([
        { id: 'a', title: 'Deleted' },
        { id: 'b', title: 'Later' },
      ]),
    );
    expect(localStorage.getItem('links')).toContain('link');
  });
  it('refuses to overwrite a conflicting later edit', () => {
    expect(() =>
      reverseChange(
        { title: 'Before' },
        { title: 'After' },
        { title: 'Newer' },
      ),
    ).toThrow(/changed again/);
  });
  it('does not change the collection when journaling runs out of space', () => {
    localStorage.setItem('records', JSON.stringify({ records: [{ id: 'a' }] }));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === 'modulo-workspace-recovery-v1') throw new Error('quota');
      original.call(this, key, value);
    });
    expect(writeWorkspaceJson('records', { records: [] })).toBe(false);
    expect(localStorage.getItem('records')).toContain('a');
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
