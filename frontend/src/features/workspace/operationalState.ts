import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';

export interface OperationalCollection<T extends { id: string }> {
  namespace: string;
  schemaId: string;
  legacyKey: string;
  validate: (value: unknown) => T;
}
const json = (value: unknown): StateJson => JSON.parse(JSON.stringify(value)) as StateJson;
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function validateCollection<T extends { id: string }>(definition: OperationalCollection<T>, value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('Expected a collection. Export the source for recovery.');
  const records = value.map(definition.validate);
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('Duplicate record IDs.');
  return records;
}
export function readCollection<T extends { id: string }>(client: PluginStateClient, definition: OperationalCollection<T>): T[] {
  return client.list().filter(record => record.key.startsWith('record.')).map(record => {
    if (record.schemaId !== definition.schemaId || record.schemaVersion !== 1) throw new Error('Unsupported record version. Export for recovery.');
    const value = definition.validate(record.value);
    if (record.key !== `record.${value.id}`) throw new Error('Record ID does not match its key.');
    return value;
  }).sort((a, b) => a.id.localeCompare(b.id));
}
/** Diff against the displayed baseline; an unseen remote record must never be deleted. */
export async function saveCollection<T extends { id: string }>(client: PluginStateClient,
  definition: OperationalCollection<T>, previous: T[], next: T[]): Promise<void> {
  const validated = validateCollection(definition, next);
  for (const record of validated) {
    const old = previous.find(item => item.id === record.id);
    if (!old || canonical(old) !== canonical(record)) await client.set(`record.${record.id}`, json(record), definition.schemaId, 1, { value: old ? json(old) : undefined });
  }
  for (const record of previous) {
    if (!validated.some(item => item.id === record.id)) await client.delete(`record.${record.id}`, { value: json(record) });
  }
}
/** Explicit owner claim, stable IDs and create-only writes; preserve source until every acknowledgement. */
export async function importCollection<T extends { id: string }>(client: PluginStateClient,
  definition: OperationalCollection<T>, storage: Storage): Promise<void> {
  const raw = storage.getItem(definition.legacyKey);
  if (raw === null) return;
  const records = validateCollection(definition, JSON.parse(raw));
  await client.refreshAll();
  // Check all known conflicts before queueing any imports.
  for (const record of records) {
    const existing = client.get(`record.${record.id}`);
    if (existing && (existing.deleted || existing.schemaId !== definition.schemaId || existing.schemaVersion !== 1
      || canonical(existing.value) !== canonical(record))) throw new Error('Server data differs. Browser data is preserved for recovery.');
  }
  for (const record of records) {
    if (!client.get(`record.${record.id}`)) await client.create(`record.${record.id}`, json(record), definition.schemaId, 1);
  }
  await client.synchronize();
  if (records.some(record => { const entry = client.get(`record.${record.id}`); return !entry || entry.pending || entry.conflict; })) {
    throw new Error('Import has not synchronized. Browser data is preserved.');
  }
  await client.set('migration-browser-v1', { source: definition.legacyKey, ids: records.map(record => record.id) }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get('migration-browser-v1')?.pending || client.get('migration-browser-v1')?.conflict) throw new Error('Migration confirmation is pending.');
  if (storage.getItem(definition.legacyKey) === raw) storage.removeItem(definition.legacyKey);
}
