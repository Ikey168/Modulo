import { offlineNotes } from '../../services/workspaceOfflineNotes';
import { NoteHttpError } from '../../services/offlineNotes';
// Typed REST client for the workspace. Uses relative `/api` paths so the Vite
// dev proxy (and the nginx prod config) route to the backend, and attaches the
// OIDC bearer token when one is available.
import { authService } from '../auth/authService';
import type { WorkspaceNote, WorkspaceTag, WorkspaceLink } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = authService.stateSession?.();
  let token: string | null = null;
  try {
    token = await authService.getAccessToken();
  } catch {
    token = null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    credentials: window.__MODULO_CONFIG__?.serverOrigin ? 'omit' : 'include',
    ...init,
    headers,
  });

  const current = authService.stateSession?.();
  if (session && (!current || current.issuer !== session.issuer || current.subject !== session.subject)) throw new Error('Account changed during request.');
  if (!res.ok) {
    throw new NoteHttpError(res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface NoteCreatePayload {
  title: string;
  content: string;
  markdownContent?: string;
  tagNames?: string[];
}

export interface NoteUpdatePayload extends NoteCreatePayload {
  version?: number;
  editor?: string;
  expectedLocal?: { title: string; content: string; markdownContent?: string };
}

export const notesApi = {
  list: () => offlineNotes()?.list() ?? request<WorkspaceNote[]>('/notes'),
  get: (id: number) => offlineNotes()?.get(id) ?? request<WorkspaceNote>(`/notes/${id}`),
  create: (body: NoteCreatePayload) =>
    request<WorkspaceNote>('/notes', { method: 'POST', body: JSON.stringify(body) }).then(note => offlineNotes()?.remember(note) ?? note),
  update: (id: number, body: NoteUpdatePayload) => {
    const offline = offlineNotes();
    if (offline) return offline.update(id, body);
    const remoteBody = { ...body };
    delete remoteBody.expectedLocal;
    return request<WorkspaceNote>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(remoteBody) });
  },
  remove: (id: number) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  search: (query: string) =>
    request<WorkspaceNote[]>(`/notes/search?query=${encodeURIComponent(query)}`),
  addTag: (id: number, tagName: string) =>
    request<WorkspaceNote>(`/notes/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagName }),
    }),
  removeTag: (id: number, tagId: string) =>
    request<WorkspaceNote>(`/notes/${id}/tags/${tagId}`, { method: 'DELETE' }),
  uploadToIpfs: (id: number) =>
    request<Record<string, unknown>>(`/notes/${id}/upload-to-ipfs`, { method: 'POST' }),
};

export const tagsApi = {
  list: () => offlineNotes()?.resource('tags', () => request<WorkspaceTag[]>('/tags')) ?? request<WorkspaceTag[]>('/tags'),
};

export interface LinkCreatePayload {
  sourceNoteId: number;
  targetNoteId: number;
  linkType: string;
}

export const linksApi = {
  all: () => offlineNotes()?.resource('links', () => request<WorkspaceLink[]>('/note-links')) ?? request<WorkspaceLink[]>('/note-links'),
  outgoing: (noteId: number) => request<WorkspaceLink[]>(`/note-links/note/${noteId}/outgoing`),
  incoming: (noteId: number) => request<WorkspaceLink[]>(`/note-links/note/${noteId}/incoming`),
  create: (body: LinkCreatePayload) =>
    request<WorkspaceLink>('/note-links', { method: 'POST', body: JSON.stringify(body) }),
  remove: (linkId: string) => request<void>(`/note-links/${linkId}`, { method: 'DELETE' }),
};
