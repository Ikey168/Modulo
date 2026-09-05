import type { Database } from './database';
import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
export const DATABASE_SCHEMA = 'modulo.embedded-database';
export const DATABASE_LEGACY_KEY = 'modulo-databases';
const kinds = ['text', 'number', 'select', 'checkbox', 'date'];
export function validateDatabase(value: unknown): Database {
  const db = value as Database;
  if (!db || typeof db.id !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,100}$/.test(db.id)
    || typeof db.title !== 'string' || !Array.isArray(db.columns) || !Array.isArray(db.rows)
    || (db.view !== undefined && db.view !== 'table' && db.view !== 'board')) throw new Error('Invalid database document. Export it for recovery.');
  if (db.columns.some(column => !column || typeof column.id !== 'string' || !column.id || typeof column.name !== 'string'
    || !kinds.includes(column.kind) || (column.options !== undefined && (!Array.isArray(column.options)
      || column.options.some(option => typeof option !== 'string'))))
    || new Set(db.columns.map(column => column.id)).size !== db.columns.length) throw new Error('Invalid database columns');
  const columns = new Set(db.columns.map(column => column.id));
  if (db.rows.some(row => !row || typeof row.id !== 'string' || !row.id || !row.cells || typeof row.cells !== 'object'
    || Array.isArray(row.cells) || Object.entries(row.cells).some(([key, cell]) => !columns.has(key)
      || !['string', 'number', 'boolean'].includes(typeof cell) || (typeof cell === 'number' && !Number.isFinite(cell))))
    || new Set(db.rows.map(row => row.id)).size !== db.rows.length) throw new Error('Invalid database rows');
  // Preserve unknown extension fields and pre-existing cell values when a column's display type changes.
  return db;
}
export async function importLegacyDatabases(client: PluginStateClient, storage: Storage): Promise<void> {
  const raw = storage.getItem(DATABASE_LEGACY_KEY); if (raw === null) return;
  const source: unknown = JSON.parse(raw);
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid browser database store');
  const databases = Object.entries(source).map(([id, value]) => {
    const db = validateDatabase(value); if (id !== db.id) throw new Error('Database identity does not match its browser key'); return db;
  });
  await client.refreshAll();
  for (const db of databases) {
    const key = `database.${db.id}`; const existing = client.get(key);
    if (existing && (existing.deleted || existing.schemaId !== DATABASE_SCHEMA || existing.schemaVersion !== 1
      || JSON.stringify(existing.value) !== JSON.stringify(db))) throw new Error(`Database “${db.title}” differs on the server. Browser data is preserved.`);
    if (!existing) await client.create(key, JSON.parse(JSON.stringify(db)) as StateJson, DATABASE_SCHEMA, 1);
  }
  await client.synchronize();
  if (databases.some(db => client.get(`database.${db.id}`)?.pending)) throw new Error('Database import has not synchronized.');
  await client.set('migration.browser-v1', { ids: databases.map(db => db.id) }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get('migration.browser-v1')?.pending) throw new Error('Database migration confirmation is pending.');
  if (storage.getItem(DATABASE_LEGACY_KEY) === raw) storage.removeItem(DATABASE_LEGACY_KEY);
}
