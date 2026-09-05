import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';
import { isRunnable, type InstalledRecord, type PluginManifest } from './types';
import type { InstallationStorage } from './runtime';

export const INSTALLATION_SCHEMA = 'modulo.workspace.installations';
export function validateInstallations(value: unknown, catalog: PluginManifest[]): InstalledRecord[] {
  if (!Array.isArray(value) || value.some(record => !record || typeof record.id !== 'string' || typeof record.enabled !== 'boolean')
    || new Set(value.map(record => record.id)).size !== value.length) throw new Error('Invalid plugin installation settings');
  const available = new Map(catalog.map(manifest => [manifest.id, manifest]));
  for (const record of value) {
    const manifest = available.get(record.id);
    if (!manifest || !isRunnable(manifest)) throw new Error(`Unavailable plugin: ${record.id}. Settings are preserved for recovery.`);
    for (const dependency of manifest.dependencies ?? []) {
      if (!value.some(candidate => candidate.id === dependency)) throw new Error(`Missing dependency ${dependency} for ${record.id}`);
    }
  }
  return value.map(record => ({ id: record.id, enabled: record.enabled }));
}
export function installationStorage(client: PluginStateClient | undefined, catalog: PluginManifest[]): InstallationStorage {
  const defaultIds = new Set<string>();
  const include = (id: string) => {
    if (defaultIds.has(id)) return;
    const manifest = catalog.find(candidate => candidate.id === id);
    if (!manifest || !isRunnable(manifest)) return;
    defaultIds.add(id); for (const dependency of manifest.dependencies ?? []) include(dependency);
  };
  for (const manifest of catalog) if (manifest.builtin) include(manifest.id);
  const defaults = [...defaultIds].map(id => ({ id, enabled: true }));
  return {
    load: () => {
      const record = client?.get('installed');
      if (!record || record.deleted) return defaults;
      if (record.schemaId !== INSTALLATION_SCHEMA || record.schemaVersion !== 1) throw new Error('Unsupported plugin settings version');
      return validateInstallations(record.value, catalog);
    },
    save: async records => {
      if (!client || client.status === 'closed') throw new Error('Sign in and load the settings cache before changing plugins.');
      const validated = validateInstallations(records, catalog);
      await client.set('installed', validated.map(record => ({ ...record })) as StateJson, INSTALLATION_SCHEMA, 1);
    },
  };
}

export async function importWorkspacePreferences(client: PluginStateClient, storage: Storage, catalog: PluginManifest[]): Promise<void> {
  const { importLegacyState } = await import('../../../services/legacyStateImport');
  const oldFlat = storage.getItem('modulo-plugins');
  const installedKey = storage.getItem('modulo-plugins-installed') !== null ? 'modulo-plugins-installed' : 'modulo-plugins';
  await importLegacyState(client, storage, installedKey, 'installed', INSTALLATION_SCHEMA, raw => {
    const records = installedKey === 'modulo-plugins' && Array.isArray(raw) ? raw.map(id => ({ id, enabled: true })) : raw;
    return validateInstallations(records, catalog).map(record => ({ ...record }));
  });
  if (installedKey === 'modulo-plugins-installed' && storage.getItem('modulo-plugins') === oldFlat) storage.removeItem('modulo-plugins');
  const raw = storage.getItem('modulo-hub-tabs');
  if (raw === null) return;
  const tabs: unknown = JSON.parse(raw);
  if (!tabs || typeof tabs !== 'object' || Array.isArray(tabs)
    || Object.entries(tabs).some(([mode, tab]) => !/^[A-Za-z0-9_-]+$/.test(mode) || typeof tab !== 'string')) throw new Error('Invalid browser hub preferences');
  await client.refreshAll();
  for (const [mode, tab] of Object.entries(tabs)) {
    const key = `tab.${mode}`;
    const existing = client.get(key);
    if (existing && (existing.deleted || existing.value !== tab || existing.schemaId !== 'modulo.workspace.hub-tab' || existing.schemaVersion !== 1)) {
      throw new Error('Server hub preferences differ. Browser settings are preserved.');
    }
    if (!existing) await client.create(key, tab, 'modulo.workspace.hub-tab', 1);
  }
  await client.synchronize();
  if (Object.keys(tabs).some(mode => client.get(`tab.${mode}`)?.pending)) throw new Error('Hub preferences have not synchronized.');
  await client.set('migration.hub-tabs', { source: 'modulo-hub-tabs' }, 'modulo.migration', 1);
  await client.synchronize();
  if (client.get('migration.hub-tabs')?.pending) throw new Error('Hub migration confirmation is pending.');
  if (storage.getItem('modulo-hub-tabs') === raw) storage.removeItem('modulo-hub-tabs');
}
