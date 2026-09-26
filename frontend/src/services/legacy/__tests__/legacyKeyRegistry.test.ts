import { describe, expect, it } from 'vitest';
import { LEGACY_KEY_REGISTRY, isAuthTransientKey, ownerOfLegacyKey } from '../legacyKeyRegistry';
import { CATALOG } from '../../../features/workspace/plugins/catalog';
import { LEGACY_CANVAS_KEY } from '../../../features/workspace/canvasSync';
import { DATABASE_LEGACY_KEY } from '../../../features/workspace/databaseSync';
import { EDUCATION_STORE_KEY } from '../../../features/workspace/education';
import { ELECTRONICS_STORE_KEY } from '../../../features/workspace/electronicsWorkbench';
import { CATEGORIES_KEY, EXPENSES_KEY, EXPORTED_KEY } from '../../../features/workspace/euer';
import { GOBD_CLASSES_KEY } from '../../../features/workspace/gobd';
import { HOBBY_STORE_KEY } from '../../../features/workspace/hobbies';
import { HOMELAB_STORE_KEY } from '../../../features/workspace/homelab';
import { SELLER_PROFILE_KEY } from '../../../features/workspace/invoicing';
import { LIFE_OS_STORE_KEY } from '../../../features/workspace/lifeOs';
import { lifeStoreKey } from '../../../features/workspace/lifeStore';
import { LEGACY_MEAL_PLANNER_STORE_KEY, MEAL_PLANNER_STORE_KEY } from '../../../features/workspace/mealPlanner';
import { LEGACY_MEDIA_LIBRARY_STORE_KEY, MEDIA_LIBRARY_STORE_KEY } from '../../../features/workspace/mediaLibrary';
import { MUSIC_STORE_KEY } from '../../../features/workspace/musicStudio';
import { PARA_STORE_KEY } from '../../../features/workspace/para';
import { PIPELINE_STAGES_KEY } from '../../../features/workspace/pipeline';
import { ROUTINES_STORE_KEY } from '../../../features/workspace/routines';
import { SOPS_STORE_KEY } from '../../../features/workspace/sops';
import { TIME_ENTRIES_KEY } from '../../../features/workspace/timeTracking';
import { TODOS_STORE_KEY } from '../../../features/workspace/todos';
import { TTRPG_STORE_KEY } from '../../../features/workspace/ttrpg';
import { WARDROBE_STORE_KEY } from '../../../features/workspace/wardrobe';
import { WORKOUT_PLANNER_STORE_KEY } from '../../../features/workspace/workoutPlanner';
import { NOTE_REVISIONS_KEY, NOTE_TRASH_KEY, RECOVERY_KEY } from '../../../features/workspace/workspaceRecovery';
import { BUSINESS_ADMIN_STORE_KEY } from '../../../features/workspace/businessAdmin';
import { LEGACY_INTAKE_KEY } from '../../../features/workspace/plugins/builtins/legacyIntakeMigration';

const KNOWN_KEYS = [
  LEGACY_CANVAS_KEY, DATABASE_LEGACY_KEY, EDUCATION_STORE_KEY, ELECTRONICS_STORE_KEY, CATEGORIES_KEY, EXPENSES_KEY, EXPORTED_KEY,
  GOBD_CLASSES_KEY, HOBBY_STORE_KEY, HOMELAB_STORE_KEY, SELLER_PROFILE_KEY, LIFE_OS_STORE_KEY, LEGACY_MEAL_PLANNER_STORE_KEY,
  MEAL_PLANNER_STORE_KEY, LEGACY_MEDIA_LIBRARY_STORE_KEY, MEDIA_LIBRARY_STORE_KEY, MUSIC_STORE_KEY, PARA_STORE_KEY,
  PIPELINE_STAGES_KEY, ROUTINES_STORE_KEY, SOPS_STORE_KEY, TIME_ENTRIES_KEY, TODOS_STORE_KEY, TTRPG_STORE_KEY, WARDROBE_STORE_KEY,
  WORKOUT_PLANNER_STORE_KEY, NOTE_REVISIONS_KEY, NOTE_TRASH_KEY, RECOVERY_KEY, BUSINESS_ADMIN_STORE_KEY, LEGACY_INTAKE_KEY,
  lifeStoreKey('home-maintenance'), lifeStoreKey('security-identity-roots'),
  'modulo-note-tree', 'modulo-note-collapsed', 'modulo-quick-capture-v1', 'modulo-fsrs-deck-limits', 'modulo-self-hosted-settings-v1',
  'modulo:audit-onboarding:v1', 'modulo:audit-onboarding-events:v1', 'modulo.graph.savedViews', 'modulo-local-blueprints',
  'modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs', 'modulo-saved-searches', 'modulo-github-sync-config-v1',
  'modulo-web3-identity-v1', 'modulo-focus-sessions-v1', 'modulo-theme', 'modulo-note-draft-["https://id","alice"]:42',
  'modulo.plugin-state.v1:["https://app","https://id","alice","personal","canvas","r"]', 'modulo.offline-notes.v1:alice',
  'modulo.state.replica', 'modulo-reminder-fired:task-1',
];

/** Owners that are the workspace host or a family rather than one catalog plugin. */
const HOST_OWNERS = new Set(['workspace', 'notes-editor', 'packs', 'audit-pack', 'graph-view', 'self-hosted tools',
  'foundation reminders', 'life collection plugin {id}']);

describe('legacy key registry', () => {
  it('assigns every known browser key to exactly one owner', () => {
    for (const key of KNOWN_KEYS) expect(ownerOfLegacyKey(key), key).toBeDefined();
  });

  it('never lets two entries claim the same key', () => {
    const exact = LEGACY_KEY_REGISTRY.map(entry => entry.key);
    expect(new Set(exact).size).toBe(exact.length);
    for (const entry of LEGACY_KEY_REGISTRY) {
      const sample = entry.key.replace('{id}', 'sample').replace(/\*$/, 'sample');
      expect(() => ownerOfLegacyKey(sample), entry.key).not.toThrow();
    }
  });

  it('names catalog plugins as owners', () => {
    const plugins = new Set(CATALOG.map(plugin => plugin.id));
    for (const entry of LEGACY_KEY_REGISTRY) {
      expect(HOST_OWNERS.has(entry.owner) || plugins.has(entry.owner), `${entry.key} → ${entry.owner}`).toBe(true);
    }
  });

  it('gives every migrated key a durable destination', () => {
    for (const entry of LEGACY_KEY_REGISTRY.filter(item => item.disposition === 'migrate')) {
      expect(entry.destination?.namespace, entry.key).toBeTruthy();
      expect(entry.destination?.schemaId, entry.key).toBeTruthy();
    }
  });

  it('keeps authentication protocol state out of plugin migration', () => {
    expect(isAuthTransientKey('oidc.user:https://id:modulo')).toBe(true);
    expect(isAuthTransientKey('modulo-todos')).toBe(false);
    expect(ownerOfLegacyKey('oidc.user:https://id:modulo')).toBeUndefined();
  });
});
