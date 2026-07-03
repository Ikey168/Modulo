import { useCallback, useEffect, useMemo, useState } from 'react';
import { createCoreAPI } from '@modulo/core';
import type { CoreLink, CoreNote, CoreTag } from '@modulo/core';

// Blockchain anchoring is not a core note-data operation — call the endpoint
// directly so we avoid importing workspaceApi here.
async function requestAnchor(id: number): Promise<void> {
  const res = await fetch(`/api/notes/${id}/upload-to-ipfs`, { method: 'POST' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to anchor note: ${res.status}`);
  }
}

export interface WorkspaceData {
  notes: CoreNote[];
  links: CoreLink[];
  tags: CoreTag[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNote: (title?: string, content?: string) => Promise<CoreNote | null>;
  updateNote: (
    id: number,
    patch: { title?: string; content?: string; markdownContent?: string },
  ) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  anchorNote: (id: number) => Promise<void>;
  addTag: (id: number, tagName: string) => Promise<void>;
  removeTag: (id: number, tagId: string) => Promise<void>;
  createLink: (sourceId: number, targetId: number, linkType?: string) => Promise<void>;
  removeLink: (linkId: string) => Promise<void>;
}

export function useCoreWorkspace(): WorkspaceData {
  const api = useMemo(() => createCoreAPI(), []);

  const [notes, setNotes] = useState<CoreNote[]>([]);
  const [links, setLinks] = useState<CoreLink[]>([]);
  const [tags, setTags] = useState<CoreTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [noteList, tagList] = await Promise.all([api.notes(), api.tags()]);
      setNotes(noteList);
      setTags(tagList);
      try {
        setLinks(await api.links());
      } catch {
        setLinks([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
      setNotes([]);
      setTags([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertNote = useCallback((note: CoreNote) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [note, ...prev];
      const next = prev.slice();
      next[idx] = note;
      return next;
    });
  }, []);

  const createNote = useCallback(
    async (title = 'Untitled Note', content?: string): Promise<CoreNote | null> => {
      try {
        const created = await api.createNote(title, content ?? `# ${title}\n\n`);
        upsertNote(created);
        return created;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create note');
        return null;
      }
    },
    [api, upsertNote],
  );

  const updateNote = useCallback(
    async (
      id: number,
      patch: { title?: string; content?: string; markdownContent?: string },
    ) => {
      try {
        const updated = await api.updateNote(id, patch);
        upsertNote(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save note');
      }
    },
    [api, upsertNote],
  );

  const deleteNote = useCallback(
    async (id: number) => {
      try {
        await api.deleteNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setLinks((prev) => prev.filter((l) => l.sourceNoteId !== id && l.targetNoteId !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete note');
      }
    },
    [api],
  );

  const anchorNote = useCallback(
    async (id: number) => {
      try {
        await requestAnchor(id);
        const fresh = await api.getNote(id);
        upsertNote(fresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to anchor note');
      }
    },
    [api, upsertNote],
  );

  const addTag = useCallback(
    async (id: number, tagName: string) => {
      try {
        const updated = await api.addTag(id, tagName);
        upsertNote(updated);
        setTags(await api.tags());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add tag');
      }
    },
    [api, upsertNote],
  );

  const removeTag = useCallback(
    async (id: number, tagId: string) => {
      try {
        const updated = await api.removeTag(id, tagId);
        upsertNote(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove tag');
      }
    },
    [api, upsertNote],
  );

  const createLink = useCallback(
    async (sourceId: number, targetId: number, linkType = 'RELATED') => {
      try {
        const created = await api.createLink(sourceId, targetId, linkType);
        setLinks((prev) => [...prev, created]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create link');
      }
    },
    [api],
  );

  const removeLink = useCallback(
    async (linkId: string) => {
      try {
        await api.removeLink(linkId);
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove link');
      }
    },
    [api],
  );

  return {
    notes,
    links,
    tags,
    loading,
    error,
    refresh,
    createNote,
    updateNote,
    deleteNote,
    anchorNote,
    addTag,
    removeTag,
    createLink,
    removeLink,
  };
}
