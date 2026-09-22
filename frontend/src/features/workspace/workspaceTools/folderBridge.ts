import type { CoreNote } from '@modulo/core';
import { bodyOf, object, text } from './shared';
export interface FolderBinding { path: string; noteId: number; fileHash: string; noteHash: string }
export interface BridgeState { folder: string; bindings: FolderBinding[] }
export const emptyBridge: BridgeState = { folder: '', bindings: [] };
export interface LocalFile { kind: 'file'; name: string; getFile(): Promise<File>; createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> }
export interface LocalDirectory { kind: 'directory'; name: string; values(): AsyncIterable<LocalFile | LocalDirectory>; getFileHandle(name: string, options?: { create: boolean }): Promise<LocalFile>; getDirectoryHandle(name: string, options?: { create: boolean }): Promise<LocalDirectory> }
export function safePath(path: string): string[] {
  const parts = path.split('/');
  if (!path || path.length > 1000 || /[\\:]/.test(path) || [...path].some(char => char.charCodeAt(0) < 32) || parts.some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe relative file path.');
  return parts;
}
export function validateBridge(value: unknown): BridgeState {
  const root = object(value); text(root.folder, 500);
  if (!Array.isArray(root.bindings) || root.bindings.length > 1000) throw new Error('Invalid folder bindings.');
  const paths = new Set<string>();
  for (const raw of root.bindings) { const row = object(raw); const path = text(row.path, 1000); safePath(path); if (paths.has(path) || !Number.isSafeInteger(row.noteId)) throw new Error('Duplicate or invalid binding.'); paths.add(path); text(row.fileHash, 128); text(row.noteHash, 128); }
  return value as BridgeState;
}
export function encodeNote(note: CoreNote) { return `<!-- Modulo title: ${encodeURIComponent(note.title)} -->\n${bodyOf(note)}`; }
export function decodeNote(path: string, source: string) {
  const marker = /^<!-- Modulo title: ([^\n]*) -->\r?\n/.exec(source);
  return { title: marker ? decodeURIComponent(marker[1]) : path.split('/').pop()!.replace(/\.md$/i, ''), content: marker ? source.slice(marker[0].length) : source };
}
export type SyncDirection = 'unchanged' | 'import' | 'export' | 'conflict' | 'missing';
export function syncDirection(binding: FolderBinding, fileHash?: string, noteHash?: string): SyncDirection {
  if (!fileHash || !noteHash) return 'missing';
  const diskChanged = fileHash !== binding.fileHash, noteChanged = noteHash !== binding.noteHash;
  return diskChanged && noteChanged ? 'conflict' : diskChanged ? 'import' : noteChanged ? 'export' : 'unchanged';
}
export async function scanDirectory(directory: LocalDirectory, prefix = '', files = new Map<string, LocalFile>(), depth = 0): Promise<Map<string, LocalFile>> {
  if (depth > 12) throw new Error('Folder nesting exceeds 12 levels.');
  for await (const entry of directory.values()) {
    if (entry.name.startsWith('.')) continue;
    const path = `${prefix}${entry.name}`; safePath(path);
    if (entry.kind === 'directory') await scanDirectory(entry, `${path}/`, files, depth + 1);
    else { if (files.size >= 1000) throw new Error('Choose a folder with at most 1,000 files.'); files.set(path, entry); }
  }
  return files;
}
export async function writeLocal(directory: LocalDirectory, path: string, content: string | Blob) {
  const parts = safePath(path); let parent = directory;
  for (const part of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(part, { create: true });
  const file = await parent.getFileHandle(parts[parts.length - 1], { create: true });
  const writer = await file.createWritable();
  try { await writer.write(content); await writer.close(); } catch (error) { await writer.abort(); throw error; }
}
export async function readLocal(directory: LocalDirectory, path: string): Promise<File | undefined> {
  const parts = safePath(path); let parent = directory;
  try {
    for (const part of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(part);
    return await (await parent.getFileHandle(parts[parts.length - 1])).getFile();
  } catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') return undefined; throw error; }
}
