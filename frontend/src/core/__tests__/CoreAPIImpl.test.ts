import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreAPIImpl } from '../CoreAPIImpl';
import type { CoreNote, CoreLink, CoreTag } from '../types';

// ── Mock workspace API (vi.hoisted ensures vars exist before vi.mock runs) ───

const { mockNotesApi, mockTagsApi, mockLinksApi } = vi.hoisted(() => ({
  mockNotesApi: {
    list:        vi.fn(),
    get:         vi.fn(),
    search:      vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
    remove:      vi.fn(),
    addTag:      vi.fn(),
    removeTag:   vi.fn(),
    uploadToIpfs: vi.fn(),
  },
  mockTagsApi:  { list: vi.fn() },
  mockLinksApi: {
    all:      vi.fn(),
    outgoing: vi.fn(),
    incoming: vi.fn(),
    create:   vi.fn(),
    remove:   vi.fn(),
  },
}));

vi.mock('../../features/workspace/workspaceApi', () => ({
  notesApi: mockNotesApi,
  tagsApi:  mockTagsApi,
  linksApi: mockLinksApi,
}));

vi.mock('../../features/blueprint/blueprintService', () => ({
  listBlueprints: vi.fn().mockResolvedValue([]),
}));

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeWsNote(id: number, title = 'T', tags: { id: string; name: string }[] = []) {
  return { id, title, content: 'body', tags, createdAt: '2026-01-01', version: 1 };
}

function makeWsLink(
  id: string,
  sourceNote: { id: number },
  targetNote: { id: number },
  linkType = 'RELATED',
) {
  return { id, linkType, sourceNote, targetNote };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CoreAPIImpl', () => {
  let api: CoreAPIImpl;

  beforeEach(() => {
    api = new CoreAPIImpl();
    vi.clearAllMocks();
  });

  // ── notes() ──────────────────────────────────────────────────────────────

  describe('notes()', () => {
    it('maps WorkspaceNote[] to CoreNote[]', async () => {
      mockNotesApi.list.mockResolvedValue([makeWsNote(1, 'Hello', [{ id: 'tag-1', name: 'draft' }])]);
      const result = await api.notes();
      expect(result).toHaveLength(1);
      const n = result[0] as CoreNote;
      expect(n.id).toBe(1);
      expect(n.title).toBe('Hello');
      expect(n.tags).toEqual([{ id: 'tag-1', name: 'draft' }]);
    });

    it('returns empty array when the backend returns an empty list', async () => {
      mockNotesApi.list.mockResolvedValue([]);
      expect(await api.notes()).toEqual([]);
    });
  });

  // ── getNote() ─────────────────────────────────────────────────────────────

  describe('getNote()', () => {
    it('returns the mapped note', async () => {
      mockNotesApi.get.mockResolvedValue(makeWsNote(7, 'Seven'));
      const n = await api.getNote(7);
      expect(n.id).toBe(7);
      expect(n.title).toBe('Seven');
      expect(n.tags).toEqual([]);
    });
  });

  // ── createNote() ──────────────────────────────────────────────────────────

  describe('createNote()', () => {
    it('calls notesApi.create and returns the mapped note', async () => {
      mockNotesApi.create.mockResolvedValue(makeWsNote(3, 'New'));
      const n = await api.createNote('New', 'content');
      expect(mockNotesApi.create).toHaveBeenCalledWith({ title: 'New', content: 'content', tagNames: undefined });
      expect(n.id).toBe(3);
    });

    it('emits note.saved after successful create', async () => {
      mockNotesApi.create.mockResolvedValue(makeWsNote(3, 'Ev'));
      const listener = vi.fn();
      api.on('note.saved', listener);
      await api.createNote('Ev', '');
      expect(listener).toHaveBeenCalledOnce();
      expect((listener.mock.calls[0][0] as CoreNote).id).toBe(3);
    });

    it('does not emit when create throws', async () => {
      mockNotesApi.create.mockRejectedValue(new Error('fail'));
      const listener = vi.fn();
      api.on('note.saved', listener);
      await expect(api.createNote('Bad', '')).rejects.toThrow('fail');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── updateNote() ──────────────────────────────────────────────────────────

  describe('updateNote()', () => {
    it('fetches existing note then updates and emits note.saved', async () => {
      const existing = makeWsNote(5, 'Old');
      mockNotesApi.get.mockResolvedValue(existing);
      mockNotesApi.update.mockResolvedValue({ ...existing, title: 'New' });
      const listener = vi.fn();
      api.on('note.saved', listener);
      const updated = await api.updateNote(5, { title: 'New' });
      expect(updated.title).toBe('New');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  // ── deleteNote() ──────────────────────────────────────────────────────────

  describe('deleteNote()', () => {
    it('calls remove and emits note.deleted', async () => {
      mockNotesApi.remove.mockResolvedValue(undefined);
      const listener = vi.fn();
      api.on('note.deleted', listener);
      await api.deleteNote(9);
      expect(mockNotesApi.remove).toHaveBeenCalledWith(9);
      expect(listener).toHaveBeenCalledWith({ id: 9 });
    });
  });

  // ── tags() ────────────────────────────────────────────────────────────────

  describe('tags()', () => {
    it('maps WorkspaceTag[] to CoreTag[]', async () => {
      mockTagsApi.list.mockResolvedValue([{ id: 'u1', name: 'alpha' }]);
      const tags = await api.tags();
      expect(tags).toEqual<CoreTag[]>([{ id: 'u1', name: 'alpha' }]);
    });
  });

  // ── addTag() / removeTag() ────────────────────────────────────────────────

  describe('addTag()', () => {
    it('emits tag.added and returns the updated note', async () => {
      const updated = makeWsNote(2, 'N', [{ id: 'tx', name: 'new-tag' }]);
      mockNotesApi.addTag.mockResolvedValue(updated);
      const listener = vi.fn();
      api.on('tag.added', listener);
      const note = await api.addTag(2, 'new-tag');
      expect(note.tags[0].name).toBe('new-tag');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('removeTag()', () => {
    it('emits tag.removed and returns the updated note', async () => {
      mockNotesApi.removeTag.mockResolvedValue(makeWsNote(2, 'N'));
      const listener = vi.fn();
      api.on('tag.removed', listener);
      await api.removeTag(2, 'tx');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  // ── links() ───────────────────────────────────────────────────────────────

  describe('links()', () => {
    it('normalizes and maps WorkspaceLink[] to CoreLink[]', async () => {
      mockLinksApi.all.mockResolvedValue([makeWsLink('l1', { id: 1 }, { id: 2 })]);
      const links = await api.links();
      expect(links).toHaveLength(1);
      const l = links[0] as CoreLink;
      expect(l.id).toBe('l1');
      expect(l.sourceNoteId).toBe(1);
      expect(l.targetNoteId).toBe(2);
      expect(l.linkType).toBe('RELATED');
    });

    it('drops links that cannot be normalized', async () => {
      // A link missing both sourceNote and sourceNoteId is unparseable
      mockLinksApi.all.mockResolvedValue([{ id: 'bad', linkType: 'X' }]);
      expect(await api.links()).toHaveLength(0);
    });
  });

  // ── createLink() ──────────────────────────────────────────────────────────

  describe('createLink()', () => {
    it('calls linksApi.create and emits link.created', async () => {
      mockLinksApi.create.mockResolvedValue(makeWsLink('l2', { id: 3 }, { id: 4 }));
      const listener = vi.fn();
      api.on('link.created', listener);
      const link = await api.createLink(3, 4);
      expect(link.sourceNoteId).toBe(3);
      expect(listener).toHaveBeenCalledOnce();
    });

    it('defaults linkType to RELATED', async () => {
      mockLinksApi.create.mockResolvedValue(makeWsLink('lx', { id: 1 }, { id: 2 }));
      await api.createLink(1, 2);
      expect(mockLinksApi.create).toHaveBeenCalledWith({
        sourceNoteId: 1,
        targetNoteId: 2,
        linkType: 'RELATED',
      });
    });
  });

  // ── removeLink() ──────────────────────────────────────────────────────────

  describe('removeLink()', () => {
    it('calls linksApi.remove and emits link.removed', async () => {
      mockLinksApi.remove.mockResolvedValue(undefined);
      const listener = vi.fn();
      api.on('link.removed', listener);
      await api.removeLink('abc');
      expect(mockLinksApi.remove).toHaveBeenCalledWith('abc');
      expect(listener).toHaveBeenCalledWith({ id: 'abc' });
    });
  });

  // ── graph() ───────────────────────────────────────────────────────────────

  describe('graph()', () => {
    it('returns nodes for each note and edges for each link', async () => {
      mockNotesApi.list.mockResolvedValue([makeWsNote(1, 'A'), makeWsNote(2, 'B')]);
      mockLinksApi.all.mockResolvedValue([makeWsLink('e1', { id: 1 }, { id: 2 })]);
      const g = await api.graph();
      expect(g.nodes).toHaveLength(2);
      expect(g.edges).toHaveLength(1);
      expect(g.edges[0].id).toBe('e1');
    });
  });

  // ── filterGraphByTags() ───────────────────────────────────────────────────

  describe('filterGraphByTags()', () => {
    it('returns only matching notes', async () => {
      mockNotesApi.list.mockResolvedValue([
        makeWsNote(1, 'A', [{ id: 't1', name: 'rust' }]),
        makeWsNote(2, 'B', [{ id: 't2', name: 'python' }]),
      ]);
      mockLinksApi.all.mockResolvedValue([]);
      const g = await api.filterGraphByTags(['rust']);
      expect(g.nodes.map((n) => n.noteId)).toEqual([1]);
    });
  });

  // ── neighbours() ─────────────────────────────────────────────────────────

  describe('neighbours()', () => {
    it('returns direct neighbours in both directions', async () => {
      mockNotesApi.list.mockResolvedValue([makeWsNote(1), makeWsNote(2), makeWsNote(3)]);
      mockLinksApi.all.mockResolvedValue([
        makeWsLink('e1', { id: 1 }, { id: 2 }),
        makeWsLink('e2', { id: 3 }, { id: 2 }),
      ]);
      const result = await api.neighbours(2);
      expect(result.map((n) => n.noteId).sort()).toEqual([1, 3]);
    });
  });

  // ── subgraph() ────────────────────────────────────────────────────────────

  describe('subgraph()', () => {
    it('returns the reachable subgraph within depth hops', async () => {
      mockNotesApi.list.mockResolvedValue([makeWsNote(1), makeWsNote(2), makeWsNote(3)]);
      mockLinksApi.all.mockResolvedValue([
        makeWsLink('e1', { id: 1 }, { id: 2 }),
        makeWsLink('e2', { id: 2 }, { id: 3 }),
      ]);
      const g = await api.subgraph(1, 1);
      expect(g.nodes.map((n) => n.noteId).sort()).toEqual([1, 2]);
    });
  });

  // ── on() / unsubscribe ────────────────────────────────────────────────────

  describe('on()', () => {
    it('returns an unsubscribe function that stops future events', async () => {
      mockNotesApi.remove.mockResolvedValue(undefined);
      const listener = vi.fn();
      const unsub = api.on('note.deleted', listener);
      await api.deleteNote(1);
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      await api.deleteNote(2);
      expect(listener).toHaveBeenCalledTimes(1); // still 1 — not called again
    });

    it('handles a throwing listener without crashing the caller', async () => {
      mockNotesApi.remove.mockResolvedValue(undefined);
      api.on('note.deleted', () => { throw new Error('boom'); });
      await expect(api.deleteNote(1)).resolves.toBeUndefined();
    });
  });

  // ── capability awareness ──────────────────────────────────────────────────

  describe('requestCapabilities() / hasCapability()', () => {
    it('hasCapability returns false before requesting', async () => {
      expect(await api.hasCapability('notes:write')).toBe(false);
    });

    it('hasCapability returns true after requesting', async () => {
      await api.requestCapabilities(['notes:write']);
      expect(await api.hasCapability('notes:write')).toBe(true);
    });

    it('requestCapabilities returns the full list as ungranted on first call', async () => {
      const ungranted = await api.requestCapabilities(['notes:write', 'ai:invoke']);
      expect(ungranted).toEqual(['notes:write', 'ai:invoke']);
    });

    it('requestCapabilities returns empty list on second call (already granted)', async () => {
      await api.requestCapabilities(['notes:write']);
      const ungranted = await api.requestCapabilities(['notes:write']);
      expect(ungranted).toEqual([]);
    });
  });
});
