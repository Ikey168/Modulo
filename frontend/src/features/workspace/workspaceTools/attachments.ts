import { authenticatedRequest } from '../../../services/authenticatedRequest';
import { request } from './shared';
export interface AttachmentInfo { id: number; originalFilename: string; contentType: string; fileSize: number }
export async function uploadFile(noteId: number, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.');
  const mime = file.type.split(';')[0].trim() || (/\.eml$/i.test(file.name) ? 'message/rfc822' : /\.md$/i.test(file.name) ? 'text/markdown' : /\.txt$/i.test(file.name) ? 'text/plain' : 'application/octet-stream');
  const form = new FormData(); form.set('noteId', String(noteId)); form.set('file', new File([file], file.name, { type: mime }));
  const response = await authenticatedRequest('/api/attachments/upload', { method: 'POST', body: form });
  if (!response.ok) throw new Error('Attachment upload failed. The draft note is retained; retry its attachment below.');
}
export async function attachments(noteId: number) { return request<AttachmentInfo[]>(`/api/attachments/note/${noteId}`); }
export async function attachmentBlob(attachment: AttachmentInfo): Promise<Blob> {
  if (attachment.fileSize > 10 * 1024 * 1024) throw new Error('Attachment exceeds the 10 MB portable-file limit.');
  const response = await authenticatedRequest(`/api/attachments/${attachment.id}/download-url`);
  if (!response.ok) throw new Error('Could not authorize attachment download.');
  const raw = await response.text(); const url = new URL(raw.startsWith('"') ? JSON.parse(raw) : raw, window.location.origin);
  if (url.username || url.password || (url.origin !== window.location.origin && url.protocol !== 'https:')) throw new Error('Unsupported attachment location.');
  const file = url.origin === window.location.origin ? await authenticatedRequest(url.href) : await fetch(url.href, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
  if (!file.ok) throw new Error('Attachment download failed.');
  const reader = file.body?.getReader(); if (!reader) throw new Error('Attachment stream unavailable.');
  const chunks: BlobPart[] = []; let size = 0;
  try { let part = await reader.read(); while (!part.done) { size += part.value.byteLength; if (size > 10 * 1024 * 1024) throw new Error('Attachment exceeds 10 MB.'); chunks.push(new Uint8Array(part.value)); part = await reader.read(); } }
  finally { await reader.cancel(); }
  return new Blob(chunks, { type: attachment.contentType });
}
export async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
export function fromBase64(value: string, mime: string) {
  if (typeof value !== 'string' || value.length > 14 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid attachment encoding.');
  const binary = atob(value); if (binary.length > 10 * 1024 * 1024) throw new Error('Attachment exceeds 10 MB.'); return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: mime });
}
