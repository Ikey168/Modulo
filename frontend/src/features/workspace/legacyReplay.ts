import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
import type { LegacyStorage } from '../../services/legacy/browserLegacyStorage';
import { importLegacyState, importLegacyStateBundle } from '../../services/legacy/legacyStateImport';
import { ownerOfLegacyKey, type LegacyKeyOwnership } from '../../services/legacy/legacyKeyRegistry';
import { importLegacyCanvas } from './canvasSync';
import { importLegacyDatabases } from './databaseSync';
import { importLegacyMediaLibrary } from './mediaLibraryStore';
import { importLegacyRevisions } from './noteRevisionsStore';
import { importCollection } from './operationalState';
import { EXPENSE_COLLECTION, TIME_COLLECTION, TODO_COLLECTION } from './operationalSchemas';
import { importWorkspacePreferences } from './plugins/installationState';
import type { PluginManifest } from './plugins/types';

export interface ReplayResult { imported: string[]; skipped: Array<{ key: string; reason: string }> }
export interface ReplayTargets {
  workspace: (namespace: string) => Promise<PluginStateClient>;
  plugin: (id: string) => Promise<PluginStateClient>;
  preferences?: PluginStateClient;
  catalog: PluginManifest[];
}

const COLLECTIONS = { 'modulo-todos': TODO_COLLECTION, 'modulo-time-entries': TIME_COLLECTION, 'modulo-euer-expenses': EXPENSE_COLLECTION } as const;
const identity = (value: unknown) => JSON.parse(JSON.stringify(value)) as StateJson;

function documentKey(entry: LegacyKeyOwnership, key: string): string {
  const destination = entry.destination!;
  if (!destination.key.includes('{id}')) return destination.key;
  const match = /^modulo-life-(.+)-v1$/.exec(key);
  if (!match) throw new Error(`No record id in ${key}`);
  return destination.key.replace('{id}', match[1]);
}

/**
 * Re-run the owning importer for each value in a Storage (normally a legacy
 * recovery export after the browser keys were retired). Importers are
 * create-only and compare against existing server records, so replaying data
 * that already arrived is a no-op and a differing server copy is reported.
 */
export async function replayLegacyStorage(storage: LegacyStorage, targets: ReplayTargets): Promise<ReplayResult> {
  const result: ReplayResult = { imported: [], skipped: [] };
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key !== null) keys.push(key); }
  const handled = new Set<string>();
  for (const key of keys.sort()) {
    if (handled.has(key)) continue;
    const entry = ownerOfLegacyKey(key);
    if (!entry) { result.skipped.push({ key, reason: 'Unknown key; it is not part of any Modulo store.' }); continue; }
    if (entry.disposition !== 'migrate') { result.skipped.push({ key, reason: `${entry.disposition} data is not replayed.` }); continue; }
    try {
      if (key === 'modulo-information-intake-v1') {
        result.skipped.push({ key, reason: 'Open Information Intake to review and import these research records.' });
        continue;
      }
      if (key === 'modulo-canvas') await importLegacyCanvas(await targets.plugin('canvas-board'), storage);
      else if (key === 'modulo-databases') await importLegacyDatabases(await targets.plugin('notion-database'), storage);
      else if (key === 'modulo-media-library-v2' || key === 'modulo-media-library-v1') {
        await importLegacyMediaLibrary(await targets.workspace('media-library'), storage);
        handled.add('modulo-media-library-v1'); handled.add('modulo-media-library-v2');
      } else if (key === 'modulo-note-revisions-v1') await importLegacyRevisions(await targets.workspace('note-revisions'), storage);
      else if (key === 'modulo-plugins-installed' || key === 'modulo-plugins' || key === 'modulo-hub-tabs') {
        if (!targets.preferences) throw new Error('Workspace settings are still loading.');
        await importWorkspacePreferences(targets.preferences, storage, targets.catalog);
        ['modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs'].forEach(item => handled.add(item));
      } else if (key in COLLECTIONS) {
        const definition = COLLECTIONS[key as keyof typeof COLLECTIONS];
        await importCollection(await targets.plugin(definition.namespace), definition as never, storage);
      } else if (key === 'modulo-meal-planner-v2' || key === 'modulo-meal-planner-v1') {
        await importLegacyStateBundle(await targets.workspace('meal-planner'), storage, ['modulo-meal-planner-v2', 'modulo-meal-planner-v1'],
          'data', 'modulo.workspace.meal-planner.v2', values => identity(values['modulo-meal-planner-v2'] ?? values['modulo-meal-planner-v1']));
        handled.add('modulo-meal-planner-v1'); handled.add('modulo-meal-planner-v2');
      } else if (entry.destination && entry.scope) {
        const client = entry.destination.namespace === 'workspace-settings' ? targets.preferences
          : entry.scope === 'workspace' ? await targets.workspace(entry.destination.namespace) : await targets.plugin(entry.destination.namespace);
        if (!client) throw new Error('Workspace settings are still loading.');
        await importLegacyState(client, storage, key, documentKey(entry, key), entry.destination.schemaId, identity);
      } else {
        result.skipped.push({ key, reason: 'No replay destination is registered.' });
        continue;
      }
      result.imported.push(key);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      result.skipped.push({ key, reason: message === 'Plugin is not enabled' ? `Enable ${entry.owner} to replay this data.` : message });
    }
  }
  return result;
}
