import { authService } from '../auth/authService';
import webSocketService from '../../services/websocket';
import { NOTE_TRASH_KEY, type NoteRevision } from './workspaceRecovery';
import { useServerWorkspaceStore } from './useWorkspaceStore';
import { useNoteRevisions } from './noteRevisionsStore';
import { noteText } from './noteDrafts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCoreAPI } from '@modulo/core';
import type { CoreLink, CoreNote, CoreTag } from '@modulo/core';

// Blockchain anchoring is not a core note-data operation — call the endpoint
// directly so we avoid importing workspaceApi here.
async function requestAnchor(id: number): Promise<void> {
  const res = await fetch(`/api/notes/${id}/upload-to-ipfs`, {
    method: 'POST',
  });
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
  ) => Promise<boolean | void>;
  trashedNotes?: CoreNote[];
  noteRevisions?: NoteRevision[];
  allLinks?: CoreLink[];
  restoreNote?: (id: number) => boolean;
  deleteNote: (id: number) => Promise<boolean | void>;
  anchorNote: (id: number) => Promise<void>;
  addTag: (id: number, tagName: string) => Promise<boolean | void>;
  removeTag: (id: number, tagId: string) => Promise<void>;
  createLink: (
    sourceId: number,
    targetId: number,
    linkType?: string,
  ) => Promise<boolean | void>;
  removeLink: (linkId: string) => Promise<void>;
}

export function useCoreWorkspace(): WorkspaceData {
  const api = useMemo(() => createCoreAPI(), []);

  const [allNotes, setNotes] = useState<CoreNote[]>([]);
  const latestNotes = useRef<CoreNote[]>([]);
  const noteRequests = useRef(new Map<number, Promise<boolean>>());
  const refreshSequence = useRef(0);
  const [links, setLinks] = useState<CoreLink[]>([]);
  const [tags, setTags] = useState<CoreTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trash, setTrash] = useServerWorkspaceStore<number[]>(
    'notes',
    'trash',
    'modulo.workspace.note-trash',
    [],
    parseNoteTrash,
    NOTE_TRASH_KEY,
    'Note trash',
  );
  const { revisions: noteRevisions, record: recordRevision } = useNoteRevisions();
  const notes = useMemo(
    () => allNotes.filter((note) => !trash.includes(note.id)),
    [allNotes, trash],
  );
  const trashedNotes = useMemo(
    () => allNotes.filter((note) => trash.includes(note.id)),
    [allNotes, trash],
  );
  const restoreNote = useCallback(
    (id: number) =>
      setTrash((previous) => previous.filter((value) => value !== id)),
    [setTrash],
  );

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setLoading(true);
    setError(null);
    const session = authService.stateSession?.();
    const identity = JSON.stringify(session ? [session.issuer, session.subject] : null);
    const active = () => {
      const now = authService.stateSession?.();
      return sequence === refreshSequence.current
        && identity === JSON.stringify(now ? [now.issuer, now.subject] : null);
    };
    try {
      const [noteList, tagList] = await Promise.all([api.notes(), api.tags().catch(() => [])]);
      if (!active()) return;
      latestNotes.current = noteList;
      setNotes(noteList);
      setTags(tagList);
      try {
        const incomingLinks = await api.links();
        if (active()) setLinks(incomingLinks);
      } catch {
        setLinks([]);
      }
    } catch (e) {
      if (active()) setError(e instanceof Error ? e.message : 'Failed to load workspace');
      // Keep the last readable workspace when refresh cannot reach the server.
    } finally {
      if (active()) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let session = authService.stateSession?.();
    let identity = JSON.stringify(session ? [session.issuer, session.subject] : null);
    const stop = authService.subscribeSession?.(() => {
      session = authService.stateSession?.();
      const next = JSON.stringify(session ? [session.issuer, session.subject] : null);
      if (next === identity) return;
      identity = next; latestNotes.current = []; setNotes([]); setTags([]); setLinks([]); noteRequests.current.clear();
      void refresh();
    });
    void refresh();
    return stop;
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = webSocketService.subscribe(() => {
      void refresh();
    });
    void webSocketService.connect();
    return unsubscribe;
  }, [refresh]);

  useEffect(()=>{const changed=()=>void refresh();window.addEventListener("modulo:properties-changed",changed);return()=>window.removeEventListener("modulo:properties-changed",changed);},[refresh]);

  const upsertNote = useCallback((note: CoreNote) => {
    latestNotes.current = [
      note,
      ...latestNotes.current.filter((item) => item.id !== note.id),
    ];
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx === -1) return [note, ...prev];
      const next = prev.slice();
      next[idx] = note;
      return next;
    });
  }, []);

  const createNote = useCallback(
    async (title = 'Untitled Note', content = ''): Promise<CoreNote | null> => {
      try {
        // A new note starts with an empty body; the title lives in its own field.
        const created = await api.createNote(title, content);
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
      const queued = (
        noteRequests.current.get(id) ?? Promise.resolve(true)
      ).then(async () => {
        try {
          const previous = latestNotes.current.find((note) => note.id === id);
          if (previous) {
            recordRevision({
              id: crypto.randomUUID(),
              noteId: id,
              ...noteText(previous),
              date: new Date().toISOString(),
            });
          }
          const updated = await api.updateNote(id, patch);
          upsertNote(updated);
          setError(null);
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to save note');
          return false;
        }
      });
      noteRequests.current.set(id, queued);
      void queued.finally(() => {
        if (noteRequests.current.get(id) === queued)
          noteRequests.current.delete(id);
      });
      return queued;
    },
    [api, upsertNote, recordRevision],
  );

  const deleteNote = useCallback(
    async (id: number) => {
      const saved = setTrash((previous) =>
        previous.includes(id) ? previous : [...previous, id],
      );
      if (!saved) setError('Could not move the note to Trash. Please retry.');
      return saved;
    },
    [setTrash],
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
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add tag');
        return false;
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
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create link');
        return false;
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
    trashedNotes,
    noteRevisions,
    allLinks: links,
    restoreNote,
    links: links.filter(
      (link) =>
        !trash.includes(link.sourceNoteId) &&
        !trash.includes(link.targetNoteId),
    ),
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

function parseNoteTrash(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
}
