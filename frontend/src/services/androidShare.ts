import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { DeviceDocuments } from './deviceDocuments';

/**
 * Share-to-Modulo on Android (#493). The native side copies every incoming
 * share into app-private storage and keeps it pending until `complete`, so a
 * share survives the app being killed before it was routed.
 */
export interface SharedFile { name: string; mime: string; size: number }
export interface SharedItem {
  id: string;
  receivedAt: number;
  subject?: string;
  text?: string;
  files: SharedFile[];
  /** Items the device could not keep (too large, permission revoked, unavailable). */
  skipped: string[];
}

export interface ShareBridge {
  pending(): Promise<{ shares: SharedItem[] }>;
  readFile(options: { id: string; index: number }): Promise<{ data: string }>;
  complete(options: { id: string }): Promise<void>;
  saveDocument(options: { name: string; mime: string; data: string }): Promise<{ saved?: boolean; cancelled?: boolean }>;
  shareDocument(options: { name?: string; mime?: string; data?: string; text?: string; title?: string }): Promise<void>;
  addListener(event: 'shareReceived' | 'shareFailed', listener: (event: { id?: string; message?: string }) => void): Promise<PluginListenerHandle>;
}

let bridge: ShareBridge | undefined;
export function nativeShareBridge(): ShareBridge | undefined {
  if (Capacitor.getPlatform() !== 'android') return undefined;
  bridge ??= registerPlugin<ShareBridge>('ModuloShare');
  return bridge;
}

/** Largest attachment the server accepts. */
export const ATTACHMENT_LIMIT = 10 * 1024 * 1024;

/** The marker lets a retried import find the note it already created. */
export const shareMarker = (id: string) => `<!-- modulo-share:${id} -->`;

const URL_ONLY = /^\s*(https?:\/\/\S+)\s*$/i;

export function sharedNote(share: SharedItem): { title: string; content: string } {
  const text = share.text?.trim() ?? '';
  const link = URL_ONLY.exec(text)?.[1];
  const title = (share.subject?.trim() || (link ? new URL(link).hostname : text.split('\n')[0]) || share.files[0]?.name || 'Shared item')
    .slice(0, 200);
  const lines = [text && link ? `<${link}>` : text];
  const tooLarge = share.files.filter(file => file.size > ATTACHMENT_LIMIT).map(file => `${file.name} is larger than 10 MB and was not attached.`);
  const notices = [...share.skipped, ...tooLarge];
  if (notices.length) lines.push('', ...notices.map(notice => `- ${notice}`));
  lines.push('', shareMarker(share.id));
  return { title, content: lines.filter((line, index) => index > 0 || line).join('\n').trim() };
}

export interface ShareImportDeps {
  bridge: Pick<ShareBridge, 'readFile' | 'complete'>;
  documents: DeviceDocuments;
  /** The id of a note whose content carries the marker, if one exists. */
  findNote(marker: string): Promise<number | undefined>;
  createNote(title: string, content: string): Promise<number>;
  upload(noteId: number, file: File): Promise<void>;
}

interface ImportProgress { noteId?: number; uploaded: number[] }

export interface ShareImportResult { noteId: number; failed: string[] }

/**
 * Import a share as a note with its files as attachments. Progress is
 * committed to device storage after each step, so a retry after a failure or
 * restart resumes: it reuses the note and skips uploaded files instead of
 * duplicating them. The share is completed only when nothing is left to retry.
 */
export async function importShare(share: SharedItem, deps: ShareImportDeps): Promise<ShareImportResult> {
  const key = `share.import.${share.id}`;
  const progress: ImportProgress = (await deps.documents.get<ImportProgress>(key)) ?? { uploaded: [] };
  if (progress.noteId === undefined) {
    const note = sharedNote(share);
    progress.noteId = await deps.findNote(shareMarker(share.id)) ?? await deps.createNote(note.title, note.content);
    await deps.documents.set(key, progress);
  }
  const failed: string[] = [];
  for (const [index, file] of share.files.entries()) {
    if (progress.uploaded.includes(index) || file.size > ATTACHMENT_LIMIT) continue;
    try {
      const { data } = await deps.bridge.readFile({ id: share.id, index });
      const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
      await deps.upload(progress.noteId, new File([bytes], file.name, { type: file.mime }));
      progress.uploaded.push(index);
      await deps.documents.set(key, progress);
    } catch (error) {
      failed.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
    }
  }
  if (!failed.length) {
    await deps.bridge.complete({ id: share.id });
    await deps.documents.remove(key);
  }
  return { noteId: progress.noteId, failed };
}
