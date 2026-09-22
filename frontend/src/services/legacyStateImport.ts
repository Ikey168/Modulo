import { validateStateSnapshot, type PluginStateClient, type StateJson, type StatePersistence, type StateSnapshot } from './pluginStateClient';

/** One-time transfer of the old offline queue. A failed transfer leaves its source intact. */
export class LegacySnapshotMigration implements StatePersistence {
  constructor(private readonly durable: StatePersistence, private readonly legacy: Storage) {}

  async load(partition: string): Promise<StateSnapshot | null> {
    const current = await this.durable.load(partition);
    const key = `modulo.plugin-state.v1:${partition}`;
    const raw = this.legacy.getItem(key);
    if (raw === null) return current;
    const snapshot: unknown = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('Legacy plugin state cache is invalid; source data was retained.');
    }
    try { validateStateSnapshot(snapshot as StateSnapshot, partition); }
    catch { throw new Error('Legacy plugin state cache is invalid; source data was retained.'); }
    if (current !== null) {
      if (current.legacySource === raw) return current;
      if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
        throw new Error('Legacy and current plugin state caches differ; both were retained for recovery.');
      }
    }
    const copied = { ...(snapshot as StateSnapshot), legacySource: raw };
    await this.durable.save(partition, copied);
    const verified = await this.durable.load(partition);
    if (JSON.stringify(verified) !== JSON.stringify(copied)) throw new Error('Legacy plugin state cache verification failed; source data was retained.');
    if (sourceAcknowledged(snapshot as StateSnapshot, copied) && this.legacy.getItem(key) === raw) this.legacy.removeItem(key);
    return copied;
  }

  async save(partition: string, snapshot: StateSnapshot): Promise<void> {
    await this.durable.save(partition, snapshot);
    if (!snapshot.legacySource) return;
    const original = JSON.parse(snapshot.legacySource) as StateSnapshot;
    if (sourceAcknowledged(original, snapshot)) {
      const key = `modulo.plugin-state.v1:${partition}`;
      if (this.legacy.getItem(key) === snapshot.legacySource) this.legacy.removeItem(key);
    }
  }
}

export function createLegacyStatePersistence(durable: StatePersistence): StatePersistence {
  return new LegacySnapshotMigration(durable, localStorage);
}

export function browserLegacyValue(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function browserLegacyRecovery(key?: string): string | null {
  return key ? browserLegacyValue(key) : null;
}

export function importBrowserLegacyState(client: PluginStateClient, legacyKey: string, key: string,
  schemaId: string, validate: (value: unknown) => StateJson): Promise<void> {
  return importLegacyState(client, localStorage, legacyKey, key, schemaId, validate);
}

function canonical(value: StateJson): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceAcknowledged(original: StateSnapshot, current: StateSnapshot): boolean {
  return original.entries.every(source => {
    if (source.conflict) return false;
    if (!source.pending) return true;
    const target = current.entries.find(item => item.key === source.key);
    const remote = target?.remote;
    return !!remote && remote.deleted === source.pending.deleted
      && remote.version > (source.pending.base?.version ?? 0)
      && (remote.deleted || (remote.schemaId === source.pending.schemaId
        && remote.schemaVersion === source.pending.schemaVersion
        && canonical(remote.value) === canonical(source.pending.value)));
  });
}

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

/** Explicitly claim several legacy browser keys into one server record. */
export async function importLegacyStateBundle(
  client: PluginStateClient,
  storage: Storage,
  legacyKeys: string[],
  key: string,
  schemaId: string,
  combine: (values: Record<string, unknown>) => StateJson,
): Promise<void> {
  const raw = Object.fromEntries(legacyKeys.map(legacyKey => [legacyKey, storage.getItem(legacyKey)]));
  if (Object.values(raw).every(value => value === null)) return;
  const decoded: Record<string, unknown> = {};
  for (const [legacyKey, value] of Object.entries(raw)) {
    if (value === null) continue;
    decoded[legacyKey] = JSON.parse(value);
  }
  const value = combine(decoded);
  await client.refreshAll();
  const existing = client.get(key);
  if (existing) {
    if (existing.deleted || existing.schemaId !== schemaId || existing.schemaVersion !== 1
      || canonical(existing.value as StateJson) !== canonical(value)) {
      throw new Error('Server settings differ. Browser settings are preserved for export.');
    }
  } else {
    await client.create(key, value, schemaId, 1);
  }
  await client.synchronize();
  if (client.get(key)?.pending || client.get(key)?.conflict) {
    throw new Error('Import has not synchronized; browser data is preserved.');
  }
  const marker = `migration.${key}`;
  await client.set(marker, { sources: legacyKeys }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get(marker)?.pending || client.get(marker)?.conflict) {
    throw new Error('Migration confirmation is pending.');
  }
  for (const legacyKey of legacyKeys) {
    const original = raw[legacyKey];
    if (original !== null && storage.getItem(legacyKey) === original) storage.removeItem(legacyKey);
  }
}

export function importBrowserLegacyBundle(
  client: PluginStateClient,
  legacyKeys: string[],
  key: string,
  schemaId: string,
  combine: (values: Record<string, unknown>) => StateJson,
): Promise<void> {
  return importLegacyStateBundle(client, localStorage, legacyKeys, key, schemaId, combine);
}
