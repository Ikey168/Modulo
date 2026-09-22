import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoreWorkspace } from '../useCoreWorkspace';
import { NotesView } from '../NotesView';
import { useNoteTree } from '../noteTree';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { noteDraftKey } from '../noteDrafts';

const api = vi.hoisted(() => ({
  notes: vi.fn(),
  tags: vi.fn(),
  links: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock('@modulo/core', () => ({ createCoreAPI: () => api }));
const socket = vi.hoisted(() => {
  const state = {
    callback: undefined as undefined | (() => void),
  };
  return {
    state,
    connect: vi.fn(async () => {}),
    subscribe: vi.fn((callback: () => void) => {
      state.callback = callback;
      return () => {
        if (state.callback === callback) state.callback = undefined;
      };
    }),
  };
});
vi.mock('../../../services/websocket', () => ({
  default: {
    connect: socket.connect,
    subscribe: socket.subscribe,
  },
}));
const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const notes = [
  { id: 901, title: 'First', content: 'Saved text', tags: [] },
  { id: 902, title: 'Second', content: '', tags: [] },
];
beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  socket.state.callback = undefined;
  vi.clearAllMocks();
  api.notes.mockResolvedValue(notes);
  api.tags.mockResolvedValue([]);
  api.links.mockResolvedValue([
    { id: 'link', sourceNoteId: 901, targetNoteId: 902, linkType: 'RELATED' },
  ]);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('note workspace reliability', () => {
  it('shows a note created through the API without remounting', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));

    api.notes.mockResolvedValueOnce([
      { id: 903, title: 'Created through MCP', content: '', tags: [] },
      ...notes,
    ]);
    act(() => socket.state.callback?.());

    await waitFor(() =>
      expect(result.current.notes.map((note) => note.id)).toContain(903),
    );
    expect(api.notes).toHaveBeenCalledTimes(2);
  });

  it('reports save failure to its caller and preserves the last confirmed note', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.updateNote.mockRejectedValueOnce(new Error('Offline'));
    await act(async () => {
      expect(await result.current.updateNote(901, { content: 'Unsaved' })).toBe(
        false,
      );
    });
    expect(result.current.notes[0].content).toBe('Saved text');
    api.updateNote.mockResolvedValueOnce({ ...notes[0], content: 'Retried' });
    await act(async () => {
      expect(await result.current.updateNote(901, { content: 'Retried' })).toBe(
        true,
      );
    });
    expect(result.current.notes[0].content).toBe('Retried');
    expect(result.current.error).toBeNull();
  });
  it('serializes direct updates with editor saves', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));
    let finish!: (value: typeof notes[number]) => void;
    api.updateNote.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...notes[0], content: 'Latest' });
    let first!: Promise<boolean | void>, second!: Promise<boolean | void>;
    await act(async () => {
      first = result.current.updateNote(901, { content: 'Earlier' });
      second = result.current.updateNote(901, { content: 'Latest' });
      await Promise.resolve();
    });
    expect(api.updateNote).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ...notes[0], content: 'Earlier' }); await Promise.all([first, second]); });
    expect(api.updateNote).toHaveBeenCalledTimes(2);
    expect(result.current.notes[0].content).toBe('Latest');
  });
  it('restores the same note ID and links from Trash after refresh', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await settle();
    await act(async () => {
      await result.current.deleteNote(901);
      await result.current.refresh();
    });
    expect(result.current.notes.map((note) => note.id)).toEqual([902]);
    expect(result.current.links).toEqual([]);
    expect(result.current.trashedNotes?.[0].id).toBe(901);
    expect(api.deleteNote).not.toHaveBeenCalled();
    await settle();
    expect(memory.current.value('notes', 'trash')).toEqual([901]);
    act(() => {
      expect(result.current.restoreNote?.(901)).toBe(true);
    });
    await settle();
    expect(memory.current.value('notes', 'trash')).toEqual([]);
    expect(result.current.notes.map((note) => note.id)).toEqual([901, 902]);
    expect(result.current.links[0].id).toBe('link');
  });
  it('preserves a draft when switching notes before the debounce fires', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.updateNote.mockRejectedValue(new Error('Offline'));
    const props = {
      data: result.current,
      selectedId: 901,
      editMode: true,
      searchQuery: '',
      onSelect: vi.fn(),
      onToggleEdit: vi.fn(),
      onSearch: vi.fn(),
      onNewNote: vi.fn(),
    };
    const editor = render(<NotesView {...props} />);
    fireEvent.change(screen.getByLabelText('Note content (Markdown)'), {
      target: { value: 'Do not lose this' },
    });
    editor.rerender(<NotesView {...props} selectedId={902} />);
    await waitFor(() =>
      expect(api.updateNote).toHaveBeenCalledWith(
        901,
        expect.objectContaining({ content: 'Do not lose this' }),
      ),
    );
    expect(JSON.parse(localStorage.getItem(noteDraftKey(901))!).content).toBe(
      'Do not lose this',
    );
    editor.rerender(<NotesView {...props} />);
    expect(screen.getByLabelText('Note content (Markdown)')).toHaveProperty(
      'value',
      'Do not lose this',
    );
    await waitFor(() => expect(screen.getByText('Save failed')).toBeTruthy());
  });
  it('stores note moves on the server and shows them on another device', async () => {
    const { result } = renderHook(() => useNoteTree(notes));
    await settle();
    act(() => result.current.move(902, 901, 'inside'));
    expect(result.current.forest[0].children[0].note.id).toBe(902);
    await settle();
    expect(memory.current.value('note-tree', 'tree')).toMatchObject({ 902: { parent: 901 } });
    const other = createMemoryWorkspace();
    other.seed('note-tree', 'tree', memory.current.value('note-tree', 'tree'), 'modulo.workspace.note-tree');
    memory.current = other;
    const second = renderHook(() => useNoteTree(notes));
    await settle();
    expect(second.result.current.forest[0].children[0].note.id).toBe(902);
  });
  it('keeps previous note versions on the server', async () => {
    const { result } = renderHook(useCoreWorkspace);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await settle();
    api.updateNote.mockResolvedValueOnce({ ...notes[0], content: 'New text' });
    await act(async () => { await result.current.updateNote(901, { content: 'New text' }); });
    await settle();
    expect(result.current.noteRevisions?.[0]).toMatchObject({ noteId: 901, content: 'Saved text' });
  });
});
