import { legacyBrowserStorage, readLegacyValue } from '../../../services/legacy/browserLegacyStorage';
import type { PluginStateClient } from '../../../services/pluginStateClient';
import type { PluginManifest } from './types';
import { importWorkspacePreferences } from './installationState';

const legacyKeys = ['modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs'] as const;

/** Old plugin installation settings, read through the isolated legacy accessor. */
export function browserPluginSettings(): Record<string, string | null> {
  return Object.fromEntries(legacyKeys.map(key => [key, readLegacyValue(key)]));
}

export function hasBrowserPluginSettings(): boolean {
  return Object.values(browserPluginSettings()).some(value => value !== null);
}

export function importBrowserPluginSettings(client: PluginStateClient, catalog: PluginManifest[]): Promise<void> {
  const storage = legacyBrowserStorage();
  return storage ? importWorkspacePreferences(client, storage, catalog) : Promise.resolve();
}
