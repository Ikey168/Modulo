import type { CoreLink, CoreNote } from '@modulo/core';
import type { StateView } from '../../../services/pluginStateClient';
import { bodyOf, object, text } from './shared';
export interface Checkpoint { id: string; title: string; createdAt: string; notes: CoreNote[]; links: CoreLink[]; plugins: { id: string; enabled: boolean }[]; settings: StateView[]; restoredIds?: Record<string, number> }
export interface Checkpoints { checkpoints: Checkpoint[] }
export const emptyCheckpoints: Checkpoints = { checkpoints: [] };
export function validateNotes(value: unknown): CoreNote[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid note collection.');
  const ids = new Set<number>();
  for (const raw of value) {
    const note = object(raw); text(note.title); text(note.content);
    if (!Number.isSafeInteger(note.id) || Number(note.id) < 1 || ids.has(Number(note.id))) throw new Error('Invalid or duplicate note ID.');
    ids.add(Number(note.id));
    if (note.markdownContent !== undefined) text(note.markdownContent);
    if (!Array.isArray(note.tags) || note.tags.length > 1000) throw new Error('Invalid tags.');
    for (const rawTag of note.tags) { const tag = object(rawTag); text(tag.name, 200); text(tag.id, 128); }
  }
  return value as CoreNote[];
}
export function validateCheckpoints(value: unknown): Checkpoints {
  const root = object(value);
  if (!Array.isArray(root.checkpoints) || root.checkpoints.length > 100) throw new Error('Export and remove older checkpoints before adding more.');
  const ids = new Set<string>();
  for (const item of root.checkpoints) {
    const checkpoint = object(item); const id = text(checkpoint.id, 128); text(checkpoint.title, 1000); text(checkpoint.createdAt, 100);
    if (ids.has(id)) throw new Error('Duplicate checkpoint.'); ids.add(id);
    validateNotes(checkpoint.notes);
    if (!Array.isArray(checkpoint.links) || !Array.isArray(checkpoint.plugins) || !Array.isArray(checkpoint.settings)) throw new Error('Invalid checkpoint.');
    for (const raw of checkpoint.links) { const link = object(raw); text(link.id, 128); text(link.linkType, 100); if (!Number.isSafeInteger(link.sourceNoteId) || !Number.isSafeInteger(link.targetNoteId)) throw new Error('Invalid checkpoint relationship.'); }
    for (const raw of checkpoint.plugins) { const plugin = object(raw); text(plugin.id, 128); if (typeof plugin.enabled !== 'boolean') throw new Error('Invalid checkpoint plugin.'); }
    for (const raw of checkpoint.settings) { const setting = object(raw); text(setting.key, 128); if (setting.schemaId !== 'modulo.workspace.hub-tab' || setting.schemaVersion !== 1 || typeof setting.value !== 'string') throw new Error('Unsupported checkpoint setting.'); }
    if (checkpoint.restoredIds !== undefined) for (const [source, target] of Object.entries(object(checkpoint.restoredIds))) if (!/^[1-9]\d*$/.test(source) || !Number.isSafeInteger(target) || Number(target) < 1) throw new Error('Invalid restored note mapping.');
  }
  return value as Checkpoints;
}
export function noteChanged(a: CoreNote, b: CoreNote) {
  return a.title !== b.title || bodyOf(a) !== bodyOf(b) || JSON.stringify(a.tags.map(t => t.name).sort()) !== JSON.stringify(b.tags.map(t => t.name).sort());
}
export const linkKey = (link: CoreLink) => `${link.sourceNoteId}:${link.targetNoteId}:${link.linkType}`;
