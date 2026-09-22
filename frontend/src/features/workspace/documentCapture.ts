import type { LifeRecord } from './lifeStore';
import type { CoreNote } from '@modulo/core';

export function documentMarker(document: LifeRecord): string {
  return `<!-- modulo-document:${encodeURIComponent(document.id)} -->`;
}
export function documentNote(document: LifeRecord): { title: string; content: string } {
  return { title: document.title, content: `${documentMarker(document)}\n\nSource document: ${document.title}\n\nChecksum: ${document.values.checksum || 'Unavailable'}\n\nOriginal location: ${document.values.location || 'Browser import'}\n\n---\n\n${document.values.ocrText || ''}` };
}
export async function captureDocument(document: LifeRecord, api: {
  notes(): Promise<CoreNote[]>; createNote(title: string, content: string): Promise<CoreNote>;
}): Promise<CoreNote> {
  const marker = documentMarker(document);
  const existing = (await api.notes()).find(note => (note.markdownContent ?? note.content ?? '').includes(marker));
  if (existing) return existing;
  const payload = documentNote(document);
  return api.createNote(payload.title, payload.content);
}
