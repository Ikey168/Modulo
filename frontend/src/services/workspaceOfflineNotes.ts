import { authService } from '../features/auth/authService';
import { Capacitor } from '@capacitor/core';
import { NoteHttpError, OfflineNotes, type NoteEdit } from './offlineNotes';
import { createNoteCachePersistence } from './offlineNoteCache';
import { LegacyNoteCacheMigration } from './legacyOfflineNotesImport';
import type { CoreNote } from '@modulo/core';
type WorkspaceNote = Omit<CoreNote, 'tags'> & { tags?: CoreNote['tags'] };
export const OFFLINE_NOTES_EVENT = 'modulo:offline-notes';
let current: { identity: string; client: OfflineNotes } | undefined;
export function offlineNotes(): OfflineNotes | undefined {
  // A browser without Web Locks cannot safely coordinate whole-snapshot offline
  // edits across tabs. Android uses a single WebView and serializes in-process.
  if (!navigator.locks && Capacitor.getPlatform() !== 'android') return undefined;
  const session = authService.stateSession?.();
  if (!session) { current = undefined; return; }
  const identity = JSON.stringify([window.location.origin, session.issuer, session.subject]);
  if (current?.identity === identity) return current.client;
  const valid = () => { const now = authService.stateSession(); return !!now && now.issuer === session.issuer && now.subject === session.subject; };
  const key = `modulo.offline-notes.v1:${identity}`;
  const request = async <T>(path: string, body?: NoteEdit): Promise<T> => {
    if (!valid()) throw new Error('Account changed.');
    const response = await fetch(`/api/notes${path}`, { method: body ? 'PUT' : 'GET',
      credentials: window.__MODULO_CONFIG__?.serverOrigin ? 'omit' : 'include', cache: 'no-store',
      headers: { Authorization: `Bearer ${authService.stateSession()!.accessToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!valid()) throw new Error('Account changed.');
    if (!response.ok) throw new NoteHttpError(response.status);
    return response.json() as Promise<T>;
  };
  let queue = Promise.resolve();
  const lock = <T>(work: () => Promise<T>): Promise<T> => {
    if (navigator.locks) return navigator.locks.request(key, work).then(value => value);
    // Older browsers serialize this tab; edits still retain server version checks.
    const result = queue.then(work); queue = result.then(() => {}, () => {}); return result;
  };
  const client = new OfflineNotes(key, new LegacyNoteCacheMigration(createNoteCachePersistence()), { list: () => request<WorkspaceNote[]>(''), get: id => request<WorkspaceNote>(`/${id}`), put: (id, body) => request<WorkspaceNote>(`/${id}`, body) }, valid, lock,
    () => window.dispatchEvent(new Event(OFFLINE_NOTES_EVENT)));
  current = { identity, client }; return client;
}
