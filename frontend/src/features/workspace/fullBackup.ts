import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';

/**
 * Full workspace backup (#496): every plugin-state record the account holds,
 * across all namespaces and schemas, as one JSON file. Unlike the Life OS
 * export, it does not need to know a plugin's data model, so a newly added
 * plugin is covered without code changes. Restore writes through the normal
 * state clients (versioned, queued, conflict-checked) and verifies that every
 * record reached the server before reporting success.
 */
export const BACKUP_FORMAT = 'modulo.workspace-state';

export interface BackupRecord { key: string; schemaId: string; schemaVersion: number; value: StateJson }
export interface WorkspaceBackup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  namespaces: Record<string, BackupRecord[]>;
}
export interface RestoreReport {
  written: number;
  unchanged: number;
  removed: number;
  skipped: Array<{ namespace: string; reason: string }>;
}

export type OpenNamespace = (namespace: string) => Promise<PluginStateClient>;

const NAMESPACE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/;
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, (item as Record<string, unknown>)[name]])) : item);

export async function exportWorkspaceState(namespaces: string[], open: OpenNamespace, now = new Date()): Promise<WorkspaceBackup> {
  const backup: WorkspaceBackup = { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), namespaces: {} };
  for (const namespace of [...namespaces].sort()) {
    const client = await open(namespace);
    await client.refreshAll();
    const records = client.list().filter(view => view.schemaId && view.schemaVersion && view.value !== undefined)
      .map(view => ({ key: view.key, schemaId: view.schemaId!, schemaVersion: view.schemaVersion!, value: view.value! }))
      .sort((a, b) => a.key.localeCompare(b.key));
    if (records.length) backup.namespaces[namespace] = records;
  }
  return backup;
}

/** Validates a parsed backup file; throws with a message the user can act on. */
export function parseWorkspaceBackup(raw: unknown): WorkspaceBackup {
  const value = raw as Partial<WorkspaceBackup> | null;
  if (!value || value.format !== BACKUP_FORMAT) throw new Error('This file is not a Modulo workspace backup.');
  if (value.version !== 1) throw new Error('This backup was made by a newer Modulo version.');
  if (!value.namespaces || typeof value.namespaces !== 'object') throw new Error('The backup contains no records.');
  for (const [namespace, records] of Object.entries(value.namespaces)) {
    if (!NAMESPACE.test(namespace) || !Array.isArray(records)) throw new Error(`The backup's namespace “${namespace}” is invalid.`);
    for (const record of records) {
      if (!record || typeof record.key !== 'string' || typeof record.schemaId !== 'string' || !Number.isSafeInteger(record.schemaVersion)
        || record.value === undefined) throw new Error(`A record in “${namespace}” is invalid.`);
    }
  }
  return value as WorkspaceBackup;
}

/**
 * Restores a backup into the signed-in account. Existing records with the same
 * content are left alone; with `replace`, records absent from the backup are
 * deleted in the namespaces the backup contains (never elsewhere).
 */
export async function restoreWorkspaceState(backup: WorkspaceBackup, open: OpenNamespace,
  options: { replace?: boolean } = {}): Promise<RestoreReport> {
  const report: RestoreReport = { written: 0, unchanged: 0, removed: 0, skipped: [] };
  const touched: Array<{ client: PluginStateClient; key: string }> = [];
  const clients: PluginStateClient[] = [];
  for (const [namespace, records] of Object.entries(backup.namespaces)) {
    let client: PluginStateClient;
    try {
      client = await open(namespace);
      await client.refreshAll();
    } catch (error) {
      report.skipped.push({ namespace, reason: error instanceof Error ? error.message : 'unavailable' });
      continue;
    }
    clients.push(client);
    const wanted = new Set(records.map(record => record.key));
    for (const record of records) {
      const current = client.get(record.key);
      if (current && !current.deleted && current.schemaId === record.schemaId && current.schemaVersion === record.schemaVersion
        && canonical(current.value) === canonical(record.value)) {
        report.unchanged += 1;
        continue;
      }
      await client.set(record.key, record.value, record.schemaId, record.schemaVersion);
      touched.push({ client, key: record.key });
      report.written += 1;
    }
    if (options.replace) {
      for (const view of client.list()) {
        if (wanted.has(view.key)) continue;
        await client.delete(view.key);
        touched.push({ client, key: view.key });
        report.removed += 1;
      }
    }
  }
  await Promise.all(clients.map(client => client.synchronize()));
  for (const { client, key } of touched) {
    const view = client.get(key);
    if (view?.pending || view?.conflict) throw new Error('Restore did not finish synchronizing. Your data is queued on this device; retry when online.');
  }
  return report;
}
