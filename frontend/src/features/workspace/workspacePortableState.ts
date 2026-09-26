import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
import { parseLifeOsData } from './lifeOs';
import { parseSops } from './sops';
import { parsePara } from './para';
import { parseRoutines } from './routines';
import { parseMealPlanner } from './mealPlanner';
import { parseWorkoutPlanner } from './workoutPlanner';
import { parseMediaLibrary } from './mediaLibrary';
import { MEDIA_ITEM_SCHEMA, mediaLibraryFromRecords, planMediaWrites } from './mediaLibraryStore';
import { parseEducation } from './education';
import { parseHobbyData } from './hobbies';
import { parseMusicData } from './musicStudio';
import { parseElectronicsData } from './electronicsWorkbench';
import { parseHomelabData } from './homelab';
import { parseWardrobeData } from './wardrobe';
import { parseTtrpgData } from './ttrpg';
import { parseBusinessAdmin } from './businessAdmin';
import { parseTimeEntries } from './timeTracking';
import { parseSellerProfile } from './invoicing';
import { parseRetentionClasses } from './gobd';
import { parseTodos } from './todos';
import { parseStages } from './pipeline';
import { containsProhibitedSecuritySecret, parseLifeCollection } from './lifeStore';
import { parseEuerData } from './usePluginDataStores';
import { parseCollapsed, parseTreeMap } from './noteTree';
type Parser = (value: unknown) => unknown;
interface Destination { namespace: string; key: string; schemaId: string; parse: Parser; }
const asJson = (value: unknown): StateJson => JSON.parse(JSON.stringify(value)) as StateJson;

const stringSettings = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) =>
    typeof raw === 'string' ? [[key, raw]] : []));
};
const numericSettings = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) =>
    typeof raw === 'number' && Number.isFinite(raw) ? [[key, raw]] : []));
};
const quickCapture = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { title: '', content: '' };
  const raw = value as Record<string, unknown>;
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
  };
};
const onboarding = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    ...(raw.dismissed === true ? { dismissed: true } : {}),
    ...(raw.completed === true ? { completed: true } : {}),
    ...(typeof raw.startedAt === 'string' ? { startedAt: raw.startedAt } : {}),
  };
};
const STATIC: Record<string, Destination> = {
  'modulo-life-os-v1': { namespace: 'life-os', key: 'data', schemaId: 'modulo.workspace.life-os', parse: parseLifeOsData },
  'modulo-personal-sops-v1': { namespace: 'personal-sops', key: 'data', schemaId: 'modulo.workspace.personal-sops', parse: parseSops },
  'modulo-modified-para-v1': { namespace: 'para', key: 'data', schemaId: 'modulo.workspace.para', parse: parsePara },
  'modulo-routines-habits-v1': { namespace: 'routines', key: 'data', schemaId: 'modulo.workspace.routines', parse: parseRoutines },
  'modulo-meal-planner-v2': { namespace: 'meal-planner', key: 'data', schemaId: 'modulo.workspace.meal-planner.v2', parse: parseMealPlanner },
  'modulo-workout-planner-v1': { namespace: 'workout-planner', key: 'data', schemaId: 'modulo.workspace.workout-planner', parse: parseWorkoutPlanner },
  'modulo-education-v1': { namespace: 'education', key: 'data', schemaId: 'modulo.workspace.education', parse: parseEducation },
  'modulo-hobbies-v1': { namespace: 'hobbies', key: 'data', schemaId: 'modulo.workspace.hobbies', parse: parseHobbyData },
  'modulo-music-studio-v1': { namespace: 'music', key: 'data', schemaId: 'modulo.workspace.music', parse: parseMusicData },
  'modulo-electronics-workbench-v1': { namespace: 'electronics', key: 'data', schemaId: 'modulo.workspace.electronics', parse: parseElectronicsData },
  'modulo-homelab-v1': { namespace: 'homelab', key: 'data', schemaId: 'modulo.workspace.homelab', parse: parseHomelabData },
  'modulo-wardrobe-v1': { namespace: 'wardrobe', key: 'data', schemaId: 'modulo.workspace.wardrobe', parse: parseWardrobeData },
  'modulo-ttrpg-v1': { namespace: 'ttrpg', key: 'data', schemaId: 'modulo.workspace.ttrpg', parse: parseTtrpgData },
  'modulo-business-admin-v1': { namespace: 'business', key: 'data', schemaId: 'modulo.workspace.business', parse: parseBusinessAdmin },
  'modulo-time-entries': { namespace: 'time-tracking', key: 'entries', schemaId: 'modulo.workspace.time.entries', parse: parseTimeEntries },
  'modulo-invoice-seller': { namespace: 'invoicing', key: 'seller-profile', schemaId: 'modulo.workspace.invoice.seller-profile', parse: parseSellerProfile },
  'modulo-gobd-classes': { namespace: 'gobd', key: 'retention-classes', schemaId: 'modulo.workspace.gobd.retention-classes', parse: parseRetentionClasses },
  'modulo-fsrs-deck-limits': { namespace: 'foundation-settings', key: 'fsrs-deck-limits', schemaId: 'modulo.workspace.foundation.fsrs-deck-limits', parse: numericSettings },
  'modulo-todos': { namespace: 'todos', key: 'items', schemaId: 'modulo.workspace.todos', parse: parseTodos },
  'modulo-pipeline-stages': { namespace: 'pipeline', key: 'stages', schemaId: 'modulo.workspace.pipeline.stages', parse: parseStages },
  'modulo-self-hosted-settings-v1': { namespace: 'self-hosted-settings', key: 'settings', schemaId: 'modulo.workspace.self-hosted.settings', parse: stringSettings },
  'modulo:audit-onboarding:v1': { namespace: 'audit-pack', key: 'onboarding', schemaId: 'modulo.workspace.audit.onboarding', parse: onboarding },
  'modulo-quick-capture-v1': { namespace: 'quick-capture', key: 'draft', schemaId: 'modulo.workspace.quick-capture', parse: quickCapture },
  'modulo-note-tree': { namespace: 'note-tree', key: 'tree', schemaId: 'modulo.workspace.note-tree', parse: parseTreeMap },
  'modulo-note-collapsed': { namespace: 'note-tree', key: 'collapsed', schemaId: 'modulo.workspace.note-tree.collapsed', parse: parseCollapsed },
};

const EUER_KEYS = new Set(['modulo-euer-expenses', 'modulo-euer-categories', 'modulo-euer-exported']);
const MEDIA_KEY = 'modulo-media-library-v2';
const dynamicLife = (portableKey: string): Destination | undefined => {
  const match = /^modulo-life-(.+)-v1$/.exec(portableKey);
  if (!match || portableKey === 'modulo-life-os-v1') return undefined;
  return {
    namespace: 'life-collections',
    key: match[1],
    schemaId: 'modulo.workspace.life-collection',
    parse: (value) => {
      const parsed = parseLifeCollection(value);
      if (match[1].startsWith('security-') && containsProhibitedSecuritySecret(parsed))
        throw new Error('Security secrets cannot be restored into ordinary plugin state.');
      return parsed;
    },
  };
};
export function isServerPortableStoreKey(key: string): boolean {
  return key in STATIC || key === MEDIA_KEY || EUER_KEYS.has(key) || Boolean(dynamicLife(key));
}

export async function restorePortableServerStores(
  planned: Record<string, unknown>,
  current: Record<string, unknown>,
  open: (namespace: string) => Promise<PluginStateClient>,
): Promise<string[]> {
  const clients = new Map<string, PluginStateClient>();
  const touched: Array<{ portableKey: string; client: PluginStateClient; key: string }> = [];
  const clientFor = async (namespace: string) => {
    const existing = clients.get(namespace);
    if (existing) return existing;
    const client = await open(namespace);
    clients.set(namespace, client);
    return client;
  };
  const write = async (portableKey: string, destination: Destination, raw: unknown) => {
    const client = await clientFor(destination.namespace);
    await client.set(destination.key, asJson(destination.parse(raw)), destination.schemaId, 1);
    touched.push({ portableKey, client, key: destination.key });
  };

  for (const [portableKey, raw] of Object.entries(planned)) {
    if (EUER_KEYS.has(portableKey)) continue;
    const destination = STATIC[portableKey] ?? dynamicLife(portableKey);
    if (destination) await write(portableKey, destination, raw);
  }
  if (Object.prototype.hasOwnProperty.call(planned, MEDIA_KEY)) {
    // One record per item: restoring replaces the library, deleting items absent from the backup.
    const client = await clientFor('media-library');
    await client.refreshAll();
    const plan = planMediaWrites(mediaLibraryFromRecords(client.list()), parseMediaLibrary(planned[MEDIA_KEY]).items);
    for (const write of plan.set) {
      await client.set(write.key, asJson(write.value), MEDIA_ITEM_SCHEMA, 1);
      touched.push({ portableKey: MEDIA_KEY, client, key: write.key });
    }
    for (const key of plan.remove) await client.delete(key);
  }
  const euerPlanned = [...EUER_KEYS].some((key) => Object.prototype.hasOwnProperty.call(planned, key));
  if (euerPlanned) {
    const next = parseEuerData({
      expenses: planned['modulo-euer-expenses'] ?? current['modulo-euer-expenses'] ?? [],
      categories: planned['modulo-euer-categories'] ?? current['modulo-euer-categories'] ?? [],
      exportedPeriods: planned['modulo-euer-exported'] ?? current['modulo-euer-exported'] ?? [],
    });
    const client = await clientFor('euer');
    await client.set('data', asJson(next), 'modulo.workspace.euer', 1);
    for (const portableKey of EUER_KEYS) {
      if (Object.prototype.hasOwnProperty.call(planned, portableKey))
        touched.push({ portableKey, client, key: 'data' });
    }
  }

  await Promise.all([...clients.values()].map((client) => client.synchronize()));
  for (const { client, key } of touched) {
    const record = client.get(key);
    if (!record || record.pending || record.conflict)
      throw new Error('Server restore did not finish synchronizing. Retry after connectivity recovers.');
  }
  return [...new Set(touched.map((item) => item.portableKey))];
}
