import { validateProjectBundle, type ProjectBundle } from './projects';
import type { CoreLink, CoreNote } from '@modulo/core';
import type { PropertyDefinition, PropertyValue } from '../../knowledge/propertyFrontmatter';
import { validateProperty } from '../../knowledge/propertyFrontmatter';
import { object, text } from './shared';
import { validateNotes } from './snapshots';
import { fromBase64 } from './attachments';
export interface CapsuleAttachment { sourceNoteId: number; name: string; mime: string; data: string }
export interface Capsule {
  project?: ProjectBundle;
  format: 'modulo-capsule'; version: 1; id: string; title: string; createdAt: string;
  notes: CoreNote[]; links: CoreLink[]; attachments: CapsuleAttachment[];
  definitions: PropertyDefinition[]; properties: { noteId: number; values: Record<string, PropertyValue> }[];
  plugins: { id: string; name: string; description: string; dependencies: string[] }[];
  packs: { id: string; name: string; description: string; plugins: string[] }[];
}
export function validateCapsule(value: unknown): Capsule {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 30 * 1024 * 1024) throw new Error('Capsule exceeds 30 MB.');
  const root = object(value);
  if (root.format !== 'modulo-capsule' || root.version !== 1) throw new Error('Unsupported capsule format.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(text(root.id, 128))) throw new Error('Invalid capsule ID.');
  if (!text(root.title, 300).trim()) throw new Error('Name the capsule.'); text(root.createdAt, 100);
  const notes = validateNotes(root.notes), ids = new Set(notes.map(note => note.id));
  for (const key of ['links', 'attachments', 'definitions', 'properties', 'plugins', 'packs']) if (!Array.isArray(root[key]) || (root[key] as unknown[]).length > 5000) throw new Error(`Invalid ${key}.`);
  const capsule = value as Capsule;
  for (const link of capsule.links) if (!ids.has(link.sourceNoteId) || !ids.has(link.targetNoteId) || link.sourceNoteId === link.targetNoteId || typeof link.linkType !== 'string' || !link.linkType.trim() || link.linkType.length > 100) throw new Error('Capsule relationship escapes the selected notes.');
  const keys = new Set<string>();
  for (const definition of capsule.definitions) {
    text(definition.key, 128); text(definition.title, 200);
    if (!/^[a-z][a-z0-9_.-]{0,127}$/.test(definition.key) || ['constructor', 'prototype', '__proto__'].includes(definition.key)) throw new Error('Invalid property schema key.');
    if (keys.has(definition.key) || !['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multiSelect', 'noteReference', 'link'].includes(definition.type) || !Array.isArray(definition.options) || definition.options.length > 100 || new Set(definition.options).size !== definition.options.length || definition.options.some(option => typeof option !== 'string')) throw new Error('Invalid property schema.'); keys.add(definition.key);
  }
  const propertyIds = new Set<number>();
  for (const row of capsule.properties) {
    if (propertyIds.has(row.noteId)) throw new Error('Duplicate property record.'); propertyIds.add(row.noteId);
    if (!ids.has(row.noteId)) throw new Error('Properties reference an unselected note.');
    for (const [key, value] of Object.entries(object(row.values))) {
      const definition = capsule.definitions.find(def => def.key === key); if (!definition) throw new Error('Missing property schema.'); validateProperty(definition, value);
      if (definition.type === 'noteReference' && value !== null && !ids.has(Number(value))) throw new Error('Include the referenced note or remove its property before export.');
    }
  }
  for (const file of capsule.attachments) { if (!ids.has(file.sourceNoteId)) throw new Error('Attachment references an unselected note.'); text(file.name, 300); text(file.mime, 200); fromBase64(file.data, file.mime); }
  const pluginIds = new Set<string>();
  for (const plugin of capsule.plugins) { if (pluginIds.has(plugin.id)) throw new Error('Duplicate plugin requirement.'); pluginIds.add(plugin.id); text(plugin.id, 128); text(plugin.name, 300); text(plugin.description, 4000); if (!Array.isArray(plugin.dependencies) || plugin.dependencies.some(id => typeof id !== 'string')) throw new Error('Invalid plugin requirements.'); }
  for (const pack of capsule.packs) { text(pack.id, 128); text(pack.name, 300); text(pack.description, 10000); if (!Array.isArray(pack.plugins) || pack.plugins.some(id => typeof id !== 'string')) throw new Error('Invalid pack definition.'); }
  for (const plugin of capsule.plugins) if (plugin.dependencies.some(id => !pluginIds.has(id))) throw new Error('Missing plugin dependency definition.');
  for (const pack of capsule.packs) if (pack.plugins.some(id => !pluginIds.has(id))) throw new Error('Missing pack plugin definition.');
  if (capsule.project !== undefined) validateProjectBundle(capsule.project, ids);
  return capsule;
}
export function schemaConflicts(incoming: PropertyDefinition[], current: PropertyDefinition[]) {
  return incoming.filter(def => { const old = current.find(item => item.key === def.key); return old && (old.type !== def.type || JSON.stringify(old.options) !== JSON.stringify(def.options)); }).map(def => def.key);
}
export function sensitiveLines(notes: CoreNote[]) {
  return notes.flatMap(note => (note.markdownContent ?? note.content).split('\n').flatMap((line, index) => /(?:password|secret|token|private.key|confidential|api.key)/i.test(line) ? [{ noteId: note.id, title: note.title, line: index + 1 }] : []));
}
