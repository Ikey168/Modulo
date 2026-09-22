import type { PluginStateClient } from '../../../services/pluginStateClient';
import type { PluginManifest } from './types';
import { importWorkspacePreferences } from './installationState';

const legacyKeys = ['modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs'] as const;

/** The only browser Storage access for the old plugin installation settings. */
export function browserPluginSettings(): Record<string, string | null> {
  try { return Object.fromEntries(legacyKeys.map(key => [key, localStorage.getItem(key)])); }
  catch { return Object.fromEntries(legacyKeys.map(key => [key, null])); }
}

export function hasBrowserPluginSettings(): boolean {
  return Object.values(browserPluginSettings()).some(value => value !== null);
}

export function importBrowserPluginSettings(client: PluginStateClient, catalog: PluginManifest[]): Promise<void> {
  return importWorkspacePreferences(client, localStorage, catalog);
}
