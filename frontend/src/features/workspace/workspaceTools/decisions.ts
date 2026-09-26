import { emptyLifeCollection, parseLifeCollection, type LifeCollectionData } from '../lifeStore';
import { object, text } from './shared';

export const emptyDecisions = emptyLifeCollection();
export function validateDecisions(value: unknown): LifeCollectionData {
  const root = object(value);
  if (root.version !== 1 || !Array.isArray(root.records) || root.records.length > 2000 || !Array.isArray(root.occurrenceCompletions)) throw new Error('Invalid decision journal.');
  const ids = new Set<string>();
  for (const raw of root.records) {
    const record = object(raw); const id = text(record.id, 128);
    if (!id || ids.has(id)) throw new Error('Duplicate decision ID.'); ids.add(id);
    text(record.title, 1000); text(record.status, 100); object(record.values);
    for (const entry of Object.values(record.values as object)) text(entry);
    if (!Array.isArray(record.log) || !Array.isArray(record.tags) || !Array.isArray(record.checklist)) throw new Error('Invalid decision history.');
    for (const item of record.log) { const log = object(item); text(log.id, 128); text(log.date, 100); text(log.title); }
    if (record.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(text(record.date, 10))) throw new Error('Invalid review date.');
  }
  return parseLifeCollection(value);
}
