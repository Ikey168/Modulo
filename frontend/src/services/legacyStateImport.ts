import type { PluginStateClient, StateJson } from './pluginStateClient';

/** Explicitly claimed browser data; never replace an existing server record during migration. */
export async function importLegacyState(client: PluginStateClient, storage: Storage,
  legacyKey: string, key: string, schemaId: string, validate: (value: unknown) => StateJson): Promise<void> {
  const raw = storage.getItem(legacyKey);
  if (raw === null) return;
  const value = validate(JSON.parse(raw));
  await client.refreshAll();
  const existing = client.get(key);
  if (existing) {
    if (existing.deleted || existing.schemaId !== schemaId || existing.schemaVersion !== 1
      || JSON.stringify(existing.value) !== JSON.stringify(value)) {
      throw new Error('Server settings differ. Browser settings are preserved for export.');
    }
  } else await client.create(key, value, schemaId, 1);
  await client.synchronize();
  if (client.get(key)?.pending || client.get(key)?.conflict) throw new Error('Import has not synchronized; browser data is preserved.');
  const marker = `migration.${key}`;
  await client.set(marker, { source: legacyKey }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get(marker)?.pending || client.get(marker)?.conflict) throw new Error('Migration confirmation is pending.');
  if (storage.getItem(legacyKey) === raw) storage.removeItem(legacyKey);
}
