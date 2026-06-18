import { useCallback, useEffect, useMemo, useState } from 'react';
import { notesApi, tagsApi, linksApi, type NoteUpdatePayload } from './workspaceApi';
import {
  normalizeLink,
  type WorkspaceNote,
  type WorkspaceTag,
  type NormalizedLink,
} from './types';

export interface WorkspaceData {
  notes: WorkspaceNote[];
  links: NormalizedLink[];
  tags: WorkspaceTag[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNote: () => Promise<WorkspaceNote | null>;
  updateNote: (id: number, patch: Partial<NoteUpdatePayload>) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
  anchorNote: (id: number) => Promise<void>;
  addTag: (id: number, tagName: string) => Promise<void>;
  removeTag: (id: number, tagId: string) => Promise<void>;
  createLink: (sourceId: number, targetId: number, linkType?: string) => Promise<void>;
  removeLink: (linkId: string) => Promise<void>;
}

export function useWorkspaceData(): WorkspaceData {
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [rawLinks, setRawLinks] = useState<NormalizedLink[]>([]);
  const [tags, setTags] = useState<WorkspaceTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [noteList, tagList] = await Promise.all([notesApi.list(), tagsApi.list()]);
      setNotes(Array.isArray(noteList) ? noteList : []);
      setTags(Array.isArray(tagList) ? tagList : []);
      // Links are best-effort: the graph degrades gracefully without them.
      try {
        const linkList = await linksApi.all();
        const normalized = (Array.isArray(linkList) ? linkList : [])
          .map(normalizeLink)
          .filter((l): l is NormalizedLink => l !== null);
        setRawLinks(normalized);
      } catch {
        setRawLinks([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
      setNotes([]);
      setTags([]);
      setRawLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertNote = useCallback((note: WorkspaceNote) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [note, ...prev];
      const next = prev.slice();
      next[idx] = note;
      return next;
    });
  }, []);

  const createNote = useCallback(async (): Promise<WorkspaceNote | null> => {
    try {
      const created = await notesApi.create({
        title: 'Untitled Note',
        content: '# Untitled Note\n\n',
        markdownContent: '# Untitled Note\n\n',
        tagNames: [],
      });
      upsertNote(created);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create note');
      return null;
    }
  }, [upsertNote]);

  const updateNote = useCallback(
    async (id: number, patch: Partial<NoteUpdatePayload>) => {
      const current = notes.find((n) => n.id === id);
      if (!current) return;
      const body: NoteUpdatePayload = {
        title: patch.title ?? current.title,
        content: patch.content ?? current.markdownContent ?? current.content,
        markdownContent: patch.markdownContent ?? current.markdownContent ?? current.content,
        tagNames: patch.tagNames ?? (current.tags ?? []).map((t) => t.name),
        version: current.version,
        editor: patch.editor,
      };
      try {
        const updated = await notesApi.update(id, body);
        if (updated && typeof updated.id === 'number') upsertNote(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save note');
      }
    },
    [notes, upsertNote],
  );

  const deleteNote = useCallback(async (id: number) => {
    try {
      await notesApi.remove(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setRawLinks((prev) => prev.filter((l) => l.sourceId !== id && l.targetId !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete note');
    }
  }, []);

  const anchorNote = useCallback(
    async (id: number) => {
      try {
        await notesApi.uploadToIpfs(id);
        const fresh = await notesApi.get(id);
        if (fresh) upsertNote(fresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to anchor note');
      }
    },
    [upsertNote],
  );

  const addTag = useCallback(
    async (id: number, tagName: string) => {
      try {
        const updated = await notesApi.addTag(id, tagName);
        if (updated) upsertNote(updated);
        const tagList = await tagsApi.list();
        if (Array.isArray(tagList)) setTags(tagList);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add tag');
      }
    },
    [upsertNote],
  );

  const removeTag = useCallback(
    async (id: number, tagId: string) => {
      try {
        const updated = await notesApi.removeTag(id, tagId);
        if (updated) upsertNote(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove tag');
      }
    },
    [upsertNote],
  );

  const createLink = useCallback(
    async (sourceId: number, targetId: number, linkType = 'RELATED') => {
      try {
        const created = await linksApi.create({ sourceNoteId: sourceId, targetNoteId: targetId, linkType });
        const normalized = normalizeLink(created);
        if (normalized) setRawLinks((prev) => [...prev, normalized]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create link');
      }
    },
    [],
  );

  const removeLink = useCallback(async (linkId: string) => {
    try {
      await linksApi.remove(linkId);
      setRawLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove link');
    }
  }, []);

  const links = useMemo(() => rawLinks, [rawLinks]);

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
