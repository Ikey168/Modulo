/**
 * Ownership of every browser Storage key Modulo has ever written (#479/#482).
 *
 * Each key or key family has exactly one owner and one disposition. The
 * inventory generator and the CI storage gate reject a Storage key found in
 * source that is not listed here, and reject two entries claiming one key.
 *
 * - migrate:   legacy plugin/workspace data; imported once into the durable
 *              destination through services/legacy, then retired.
 * - transfer:  a device cache/outbox copied into IndexedDB/SQLite on first
 *              open (no server import needed; the queue itself synchronizes).
 * - transient: never persisted; session-only protocol or diagnostic state.
 * - retired:   obsolete key; its data is claimed by another owner's importer.
 *
 * `scope` says how the destination namespace is opened: `workspace` records
 * are host-owned (plugins.workspaceState), `plugin` records are namespaced to
 * the owning plugin (plugins.state), `device` stays on the device.
 */
export type LegacyDisposition = 'migrate' | 'transfer' | 'transient' | 'retired';
export type LegacyKind = 'records' | 'settings' | 'draft' | 'recovery' | 'queue' | 'preference' | 'protocol' | 'diagnostic';
export type AndroidIssue = 'P03' | 'P05' | 'P06' | 'P07' | 'P08' | 'P10' | 'P16';

export interface LegacyKeyOwnership {
  /** Exact key, or a family pattern ending in `*` (prefix) or containing `{id}`. */
  key: string;
  owner: string;
  kind: LegacyKind;
  disposition: LegacyDisposition;
  storage: 'localStorage' | 'sessionStorage';
  scope?: 'workspace' | 'plugin' | 'device';
  destination?: { namespace: string; key: string; schemaId: string; layout?: 'document' | 'record-per-id' | 'item-per-key' };
  issue: AndroidIssue;
  note?: string;
}

const workspace = (key: string, owner: string, namespace: string, record: string, schemaId: string, issue: AndroidIssue,
  kind: LegacyKind = 'records'): LegacyKeyOwnership =>
  ({ key, owner, kind, disposition: 'migrate', storage: 'localStorage', scope: 'workspace',
    destination: { namespace, key: record, schemaId, layout: 'document' }, issue });
const plugin = (key: string, owner: string, record: string, schemaId: string, issue: AndroidIssue,
  kind: LegacyKind = 'settings', layout: 'document' | 'record-per-id' = 'document'): LegacyKeyOwnership =>
  ({ key, owner, kind, disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: owner, key: record, schemaId, layout }, issue });

export const LEGACY_KEY_REGISTRY: readonly LegacyKeyOwnership[] = [
  // PARA and productivity (P05)
  workspace('modulo-modified-para-v1', 'para-core', 'para', 'data', 'modulo.workspace.para', 'P05'),
  workspace('modulo-routines-habits-v1', 'routines-habits', 'routines', 'data', 'modulo.workspace.routines', 'P05'),
  workspace('modulo-meal-planner-v2', 'meal-planner', 'meal-planner', 'data', 'modulo.workspace.meal-planner.v2', 'P05'),
  { ...workspace('modulo-meal-planner-v1', 'meal-planner', 'meal-planner', 'data', 'modulo.workspace.meal-planner.v2', 'P05'),
    note: 'Older format; bundled with v2 by the meal planner importer.' },
  workspace('modulo-workout-planner-v1', 'workout-planner', 'workout-planner', 'data', 'modulo.workspace.workout-planner', 'P05'),
  workspace('modulo-personal-sops-v1', 'personal-sops', 'personal-sops', 'data', 'modulo.workspace.personal-sops', 'P05'),
  workspace('modulo-quick-capture-v1', 'workspace', 'quick-capture', 'draft', 'modulo.workspace.quick-capture', 'P05', 'draft'),
  workspace('modulo-note-tree', 'notes-editor', 'note-tree', 'tree', 'modulo.workspace.note-tree', 'P05', 'settings'),
  workspace('modulo-note-collapsed', 'notes-editor', 'note-tree', 'collapsed', 'modulo.workspace.note-tree.collapsed', 'P05', 'preference'),
  plugin('modulo-todos', 'todo-lists', 'record.{id}', 'modulo.todo', 'P05', 'records', 'record-per-id'),
  plugin('modulo-time-entries', 'zeiterfassung', 'record.{id}', 'modulo.time-entry', 'P05', 'records', 'record-per-id'),
  plugin('modulo-focus-sessions-v1', 'focus', 'sessions', 'modulo.focus.sessions', 'P05', 'records'),
  plugin('modulo-saved-searches', 'saved-searches', 'queries', 'modulo.saved-searches', 'P05'),

  // Personal, life, hobbies and media (P06)
  workspace('modulo-life-os-v1', 'life-os-dashboard', 'life-os', 'data', 'modulo.workspace.life-os', 'P06'),
  { key: 'modulo-life-{id}-v1', owner: 'life collection plugin {id}', kind: 'records', disposition: 'migrate', storage: 'localStorage',
    scope: 'workspace', destination: { namespace: 'life-collections', key: '{id}', schemaId: 'modulo.workspace.life-collection', layout: 'document' },
    issue: 'P06', note: 'One document per life/learning collection plugin; security-* collections reject secrets.' },
  workspace('modulo-hobbies-v1', 'hobby-stack', 'hobbies', 'data', 'modulo.workspace.hobbies', 'P06'),
  workspace('modulo-music-studio-v1', 'music-practice', 'music', 'data', 'modulo.workspace.music', 'P06'),
  workspace('modulo-wardrobe-v1', 'style-studio', 'wardrobe', 'data', 'modulo.workspace.wardrobe', 'P06'),
  workspace('modulo-ttrpg-v1', 'ttrpg-sessions', 'ttrpg', 'data', 'modulo.workspace.ttrpg', 'P06'),
  { key: 'modulo-media-library-v2', owner: 'media-library', kind: 'records', disposition: 'migrate', storage: 'localStorage', scope: 'workspace',
    destination: { namespace: 'media-library', key: 'item.{id}', schemaId: 'modulo.workspace.media-item', layout: 'item-per-key' }, issue: 'P06' },
  { key: 'modulo-media-library-v1', owner: 'media-library', kind: 'records', disposition: 'migrate', storage: 'localStorage', scope: 'workspace',
    destination: { namespace: 'media-library', key: 'item.{id}', schemaId: 'modulo.workspace.media-item', layout: 'item-per-key' }, issue: 'P06',
    note: 'Older format; read only when v2 is absent.' },

  // Work, learning, research and remaining plugin stores (P07)
  workspace('modulo-education-v1', 'education-core', 'education', 'data', 'modulo.workspace.education', 'P07'),
  workspace('modulo-electronics-workbench-v1', 'electronics-lab', 'electronics', 'data', 'modulo.workspace.electronics', 'P07'),
  workspace('modulo-homelab-v1', 'homelab-operations', 'homelab', 'data', 'modulo.workspace.homelab', 'P07'),
  workspace('modulo-business-admin-v1', 'business-operations', 'business', 'data', 'modulo.workspace.business', 'P07'),
  workspace('modulo-fsrs-deck-limits', 'flashcards-spaced-repetition', 'foundation-settings', 'fsrs-deck-limits',
    'modulo.workspace.foundation.fsrs-deck-limits', 'P07', 'settings'),
  workspace('modulo-self-hosted-settings-v1', 'self-hosted tools', 'self-hosted-settings', 'settings', 'modulo.workspace.self-hosted.settings', 'P07', 'settings'),
  workspace('modulo:audit-onboarding:v1', 'audit-pack', 'audit-pack', 'onboarding', 'modulo.workspace.audit.onboarding', 'P07', 'settings'),
  workspace('modulo.graph.savedViews', 'graph-view', 'graph-views', 'views', 'modulo.workspace.graph.saved-views', 'P07', 'settings'),
  workspace('modulo-local-blueprints', 'packs', 'blueprint-packs', 'blueprints', 'modulo.workspace.pack-blueprints', 'P07'),
  plugin('modulo-euer-expenses', 'euer-datev', 'record.{id}', 'modulo.expense', 'P07', 'records', 'record-per-id'),
  plugin('modulo-euer-categories', 'euer-datev', 'categories', 'modulo.expense.categories', 'P07'),
  plugin('modulo-euer-exported', 'euer-datev', 'exported-periods', 'modulo.expense.exported-periods', 'P07'),
  plugin('modulo-invoice-seller', 'rechnung', 'seller', 'modulo.invoice.seller', 'P07'),
  plugin('modulo-gobd-classes', 'gobd-vault', 'classes', 'modulo.retention.classes', 'P07'),
  plugin('modulo-pipeline-stages', 'kanban', 'stages', 'modulo.pipeline.stages', 'P07'),
  plugin('modulo-github-sync-config-v1', 'github-sync', 'config', 'modulo.github-sync.config', 'P07'),
  plugin('modulo-web3-identity-v1', 'web3-id', 'proof', 'modulo.web3-identity.proof', 'P07', 'records'),
  { key: 'modulo-canvas', owner: 'canvas-board', kind: 'records', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'canvas-board', key: 'board.{id}', schemaId: 'modulo.canvas.board', layout: 'item-per-key' }, issue: 'P07' },
  { key: 'modulo-databases', owner: 'notion-database', kind: 'records', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'notion-database', key: 'database.{id}', schemaId: 'modulo.embedded-database', layout: 'item-per-key' }, issue: 'P07' },
  { key: 'modulo-information-intake-v1', owner: 'information-intake', kind: 'records', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'information-intake', key: 'legacy.{collection}.{id}', schemaId: 'modulo.intake.legacy-record', layout: 'item-per-key' },
    issue: 'P07', note: 'Claimed only by the Noesis Information Intake legacy importer (digest-verified import report).' },

  // Plugin settings, runtime and shared helpers (P08)
  { key: 'modulo-plugins-installed', owner: 'workspace', kind: 'settings', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'workspace-settings', key: 'installed', schemaId: 'modulo.workspace.installations' }, issue: 'P08' },
  { key: 'modulo-plugins', owner: 'workspace', kind: 'settings', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'workspace-settings', key: 'installed', schemaId: 'modulo.workspace.installations' }, issue: 'P08',
    note: 'Oldest flat id list; converted by the installation importer.' },
  { key: 'modulo-hub-tabs', owner: 'workspace', kind: 'preference', disposition: 'migrate', storage: 'localStorage', scope: 'plugin',
    destination: { namespace: 'workspace-settings', key: 'tab.{mode}', schemaId: 'modulo.workspace.hub-tab' }, issue: 'P08' },
  workspace('modulo-note-trash-v1', 'notes-editor', 'notes', 'trash', 'modulo.workspace.note-trash', 'P08', 'recovery'),
  { key: 'modulo-note-revisions-v1', owner: 'notes-editor', kind: 'recovery', disposition: 'migrate', storage: 'localStorage', scope: 'workspace',
    destination: { namespace: 'note-revisions', key: '{id}', schemaId: 'modulo.workspace.note-revision', layout: 'item-per-key' }, issue: 'P08' },
  { key: 'modulo-note-draft-*', owner: 'notes-editor', kind: 'draft', disposition: 'transfer', storage: 'localStorage', scope: 'device',
    issue: 'P08', note: 'Unsaved editor text; moved to the account-partitioned device draft store and cleared once the server accepts the save.' },
  { key: 'modulo-workspace-recovery-v1', owner: 'workspace', kind: 'recovery', disposition: 'retired', storage: 'localStorage', issue: 'P08',
    note: 'Journal of browser-local store writes. Server CAS history and the legacy recovery store replace it; kept readable for export only.' },
  { key: 'modulo-theme', owner: 'workspace', kind: 'preference', disposition: 'transfer', storage: 'localStorage', scope: 'device',
    issue: 'P08', note: 'Display theme applies before sign-in, so it is a device preference in device storage, not account data.' },
  { key: 'modulo:audit-onboarding-events:v1', owner: 'audit-pack', kind: 'diagnostic', disposition: 'transient', storage: 'sessionStorage',
    issue: 'P08', note: 'Onboarding funnel diagnostics; kept in memory for the session only.' },

  // Device caches and outboxes (P03)
  { key: 'modulo.plugin-state.v1:*', owner: 'workspace', kind: 'queue', disposition: 'transfer', storage: 'localStorage', scope: 'device',
    issue: 'P03', note: 'Old per-partition offline queue; transferred into IndexedDB/SQLite and retired after acknowledgement.' },
  { key: 'modulo.offline-notes.v1:*', owner: 'notes-editor', kind: 'queue', disposition: 'transfer', storage: 'localStorage', scope: 'device',
    issue: 'P03', note: 'Old offline note queue; transferred into the durable note cache.' },
  { key: 'modulo.state.replica', owner: 'workspace', kind: 'queue', disposition: 'retired', storage: 'sessionStorage', issue: 'P03',
    note: 'Replaced by the IndexedDB replica pool.' },

  // Reminders (P16)
  { key: 'modulo-reminder-fired:*', owner: 'foundation reminders', kind: 'diagnostic', disposition: 'transient', storage: 'sessionStorage',
    issue: 'P16', note: 'Per-session de-duplication; delivered reminders are recorded durably by the reminder scheduler.' },
] as const;

/** Authentication protocol state is not plugin data and never migrates (#488). */
export const AUTH_TRANSIENT_KEYS = ['oidc.*', 'returnTo', 'oauth_state_*', 'oauth_return_url', 'mobile_auth_user', 'mobile_auth_method'] as const;

function pattern(key: string): RegExp {
  const escaped = key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[a-z]+\\\}/g, '.+').replace(/\*$/, '.*');
  return new RegExp(`^${escaped}$`);
}

const isFamily = (entry: LegacyKeyOwnership) => entry.key.endsWith('*') || entry.key.includes('{');

/** The single owner of a concrete key, or undefined when the key is unregistered. An exact entry wins over a family. */
export function ownerOfLegacyKey(key: string): LegacyKeyOwnership | undefined {
  const exact = LEGACY_KEY_REGISTRY.find(entry => !isFamily(entry) && entry.key === key);
  if (exact) return exact;
  const matches = LEGACY_KEY_REGISTRY.filter(entry => isFamily(entry) && pattern(entry.key).test(key));
  if (matches.length > 1) throw new Error(`Legacy key ${key} has ${matches.length} owners: ${matches.map(entry => entry.owner).join(', ')}`);
  return matches[0];
}

export function isAuthTransientKey(key: string): boolean {
  return AUTH_TRANSIENT_KEYS.some(candidate => pattern(candidate).test(key));
}
