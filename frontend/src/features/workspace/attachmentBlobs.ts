import { authenticatedRequest } from '../../services/authenticatedRequest';

/**
 * Attachment bytes live on the server (`/api/workspaces/personal/files/{id}`).
 * Files saved by older builds in this browser's IndexedDB are uploaded to the
 * server the first time they are read, then removed from the browser.
 */
const FILES = '/api/workspaces/personal/files';
const DB_NAME = 'modulo-attachments';
const STORE_NAME = 'files';
const DB_VERSION = 1;
// Types a blob: URL may render in the app origin; everything else is opened as a download.
const RENDERABLE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain|audio\/[a-z0-9.+-]+|video\/(mp4|webm))$/;

export interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
}

export const isStoredAttachmentLocation = (location: string): boolean =>
  location.startsWith('server://') || location.startsWith('indexeddb://');

async function upload(id: string, blob: Blob, name: string, type: string): Promise<StoredAttachment> {
  const response = await authenticatedRequest(`${FILES}/${encodeURIComponent(id)}?name=${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': type || 'application/octet-stream' },
    body: blob,
  });
  if (!response.ok) throw new Error(response.status === 413 ? 'File is larger than 25 MB.' : `Upload failed (${response.status}).`);
  const meta = await response.json() as { name: string; contentType: string; size: number; updatedAt: string };
  return { id, name: meta.name, type: meta.contentType, size: meta.size, updatedAt: meta.updatedAt, blob };
}

export async function putAttachment(id: string, file: File): Promise<StoredAttachment> {
  return upload(id, file, file.name, file.type);
}

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  const response = await authenticatedRequest(`${FILES}/${encodeURIComponent(id)}`);
  if (response.status === 404) return migrateLegacyAttachment(id);
  if (!response.ok) throw new Error(`Could not read attachment (${response.status}).`);
  const blob = await response.blob();
  const type = response.headers.get('X-File-Content-Type') ?? blob.type;
  const name = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get('Content-Disposition') ?? '')?.[1];
  return { id, name: name ? decodeURIComponent(name) : id, type, size: blob.size, updatedAt: '', blob };
}

export async function deleteAttachment(id: string): Promise<void> {
  const response = await authenticatedRequest(`${FILES}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`Could not delete attachment (${response.status}).`);
  await deleteLegacy(id).catch(() => undefined);
}

export async function attachmentUrl(id: string): Promise<string | undefined> {
  const stored = await getAttachment(id);
  if (!stored) return undefined;
  const type = RENDERABLE.test(stored.type) ? stored.type : 'application/octet-stream';
  return URL.createObjectURL(new Blob([stored.blob], { type }));
}

// ---- legacy browser storage (read + migrate only) ----

const legacyDatabase = (): Promise<IDBDatabase | undefined> => new Promise((resolve) => {
  if (typeof indexedDB === 'undefined') { resolve(undefined); return; }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(undefined);
});

async function readLegacy(id: string): Promise<StoredAttachment | undefined> {
  const db = await legacyDatabase();
  if (!db) return undefined;
  try {
    return await new Promise<StoredAttachment | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as StoredAttachment | undefined);
      request.onerror = () => reject(request.error ?? new Error('Could not read local attachment.'));
    });
  } finally { db.close(); }
}

async function deleteLegacy(id: string): Promise<void> {
  const db = await legacyDatabase();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not delete local attachment.'));
    });
  } finally { db.close(); }
}

/** Upload a browser-only file to the server; the local copy is removed only after the upload succeeds. */
export async function migrateLegacyAttachment(id: string): Promise<StoredAttachment | undefined> {
  const local = await readLegacy(id);
  if (!local) return undefined;
  const stored = await upload(id, local.blob, local.name, local.type);
  await deleteLegacy(id);
  return stored;
}
