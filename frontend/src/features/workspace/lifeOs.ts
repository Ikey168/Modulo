import { searchableText, referencedNotes } from './searchIndex';
import { parseSops, SOPS_STORE_KEY } from './sops';
import type { CoreNote, CoreLink } from '@modulo/core';
import { LIFE_PLUGIN_CONFIGS } from './lifeConfigs';
import { DOMAIN_COLLECTION_CONFIGS } from './domainConfigs';
import { FOUNDATION_TOOL_DEFINITIONS } from './foundationTools';
import { SELF_HOSTED_TOOL_DEFINITIONS } from './selfHostedTools';
import { containsProhibitedSecuritySecret, lifeStoreKey } from './lifeStore';

export const LIFE_OS_STORE_KEY = 'modulo-life-os-v1';
export const LIFE_OS_CHANGED_EVENT = 'modulo:life-os-changed';
export const LIFE_OS_BACKUP_FORMAT = 'modulo-life-os-backup';

export interface LifeOsEntity {
  uid: string;
  source: string;
  kind: string;
  title: string;
  status?: string;
  date?: string;
  detail?: string;
  tags: string[];
  route: string;
  artifact: boolean;
  path?: string;
  noteIds?: number[];
  /** Raw hydrated server record used by generic record sheets; never persisted here. */
  record?: Record<string, unknown>;
}

export const LIFE_OS_RELATION_TYPES = ['Related', 'Uses', 'Supports', 'Derived from', 'Cites', 'Attached to', 'Part of'] as const;
export type LifeOsRelationType = typeof LIFE_OS_RELATION_TYPES[number];
export interface LifeOsRelation { id: string; fromUid: string; toUid: string; type: LifeOsRelationType; label: string; createdAt?: string; }
export interface LifeOsReview { id: string; date: string; wins: string; friction: string; nextFocus: string; signals: string[]; }
export interface LifeOsData { version: 1; relations: LifeOsRelation[]; reviews: LifeOsReview[]; }
export interface PortableNote { originalId?: number; tags?: string[]; trashed?: boolean; title: string; content: string; createdAt?: string; updatedAt?: string; }
export interface LifeOsBackup {
  format: typeof LIFE_OS_BACKUP_FORMAT;
  schemaVersion: 1;
  exportedAt: string;
  stores: Record<string, unknown>;
  notes: PortableNote[];
  links?: Array<Pick<CoreLink, 'sourceNoteId' | 'targetNoteId' | 'linkType'>>;
}
export interface RestoreResult { restored: string[]; skipped: string[]; unknown: string[]; }
export interface LifeOsHealthIssue { id: string; severity: 'Error' | 'Warning'; source: string; title: string; detail: string; route?: string; }

interface CollectionDescriptor { key: string; kind: string; route: string; artifact?: boolean; }
interface StoreDescriptor { key: string; source: string; collections: CollectionDescriptor[]; }
interface ReferenceRule { storeKey: string; collection: string; field: string; targetCollection: string; route: string; targetStoreKey?: string; }

const STORES: StoreDescriptor[] = [
  { key: SOPS_STORE_KEY, source: 'Personal SOPs', collections: [
    { key: 'procedures', kind: 'Procedure', route: 'personal-sops', artifact: true },
    { key: 'runs', kind: 'Procedure run', route: 'personal-sops' },
  ] },
  { key: 'modulo-modified-para-v1', source: 'PARA', collections: [
    { key: 'projects', kind: 'Project', route: 'para-core' }, { key: 'areas', kind: 'Area', route: 'para-core' },
    { key: 'resources', kind: 'Resource', route: 'para-core', artifact: true }, { key: 'tasks', kind: 'Task', route: 'para-tasks' },
    { key: 'goals', kind: 'Goal', route: 'para-goals' }, { key: 'inbox', kind: 'Inbox item', route: 'para-capture' },
    { key: 'reviews', kind: 'PARA review', route: 'para-review' },
  ] },
  { key: 'modulo-routines-habits-v1', source: 'Routines', collections: [
    { key: 'routines', kind: 'Routine', route: 'routines-habits' }, { key: 'habits', kind: 'Habit', route: 'routines-habits' },
  ] },
  { key: 'modulo-meal-planner-v2', source: 'Meals', collections: [
    { key: 'meals', kind: 'Meal', route: 'meal-planner' }, { key: 'recipes', kind: 'Recipe', route: 'meal-planner', artifact: true },
    { key: 'groceries', kind: 'Grocery item', route: 'meal-planner' }, { key: 'pantry', kind: 'Pantry item', route: 'meal-planner' },
    { key: 'shoppingTrips', kind: 'Shopping trip', route: 'meal-planner' }, { key: 'prepSessions', kind: 'Prep session', route: 'meal-planner' },
  ] },
  { key: 'modulo-workout-planner-v1', source: 'Workouts', collections: [{ key: 'workouts', kind: 'Workout', route: 'workout-planner' }] },
  { key: 'modulo-media-library-v2', source: 'Media', collections: [{ key: 'items', kind: 'Media', route: 'media-library' }] },
  { key: 'modulo-education-v1', source: 'Education', collections: [
    { key: 'nodes', kind: 'Learning node', route: 'education-core' }, { key: 'sessions', kind: 'Study session', route: 'education-study' },
    { key: 'assignments', kind: 'Assignment', route: 'education-assignments', artifact: true },
  ] },
  { key: 'modulo-information-intake-v1', source: 'Research', collections: [
    { key: 'items', kind: 'Intake item', route: 'information-intake' }, { key: 'sessions', kind: 'Research session', route: 'information-workbench' },
    { key: 'artifacts', kind: 'Research output', route: 'information-outputs', artifact: true }, { key: 'projects', kind: 'Research project', route: 'research-projects' },
    { key: 'explorationTrails', kind: 'Exploration trail', route: 'research-projects' }, { key: 'syntheses', kind: 'Research synthesis', route: 'research-evidence', artifact: true },
    { key: 'cases', kind: 'Decision or problem', route: 'research-decisions', artifact: true }, { key: 'creations', kind: 'Creation brief', route: 'research-creation', artifact: true },
    { key: 'learningPlans', kind: 'Learning transfer', route: 'research-learning' }, { key: 'experiments', kind: 'Research experiment', route: 'research-iteration' },
    { key: 'maintenanceReviews', kind: 'Knowledge review', route: 'research-maintenance' }, { key: 'transitions', kind: 'Workflow transition', route: 'information-workbench' },
  ] },
  { key: 'modulo-hobbies-v1', source: 'Hobbies', collections: [
    { key: 'hobbies', kind: 'Hobby', route: 'hobby-stack' }, { key: 'sessions', kind: 'Practice session', route: 'hobby-practice' },
    { key: 'artifacts', kind: 'Hobby artifact', route: 'hobby-practice', artifact: true }, { key: 'funMenu', kind: 'Fun activity', route: 'hobby-fun' },
  ] },
  { key: 'modulo-music-studio-v1', source: 'Music', collections: [
    { key: 'projects', kind: 'Music project', route: 'music-track-lab', artifact: true }, { key: 'practice', kind: 'Music practice', route: 'music-practice' },
    { key: 'assets', kind: 'Music asset', route: 'music-studio-library', artifact: true },
  ] },
  { key: 'modulo-electronics-workbench-v1', source: 'Electronics', collections: [
    { key: 'projects', kind: 'Electronics project', route: 'electronics-projects', artifact: true }, { key: 'parts', kind: 'Component', route: 'electronics-parts' },
    { key: 'bom', kind: 'BOM item', route: 'electronics-parts' }, { key: 'lab', kind: 'Lab entry', route: 'electronics-lab', artifact: true },
  ] },
  { key: 'modulo-homelab-v1', source: 'Homelab', collections: [
    { key: 'assets', kind: 'Infrastructure asset', route: 'homelab-assets' }, { key: 'runs', kind: 'Operation', route: 'homelab-operations', artifact: true },
  ] },
  { key: 'modulo-wardrobe-v1', source: 'Style', collections: [
    { key: 'garments', kind: 'Garment', route: 'wardrobe-closet' }, { key: 'outfits', kind: 'Outfit', route: 'style-studio', artifact: true },
    { key: 'logs', kind: 'Style log', route: 'style-studio' },
  ] },
  { key: 'modulo-ttrpg-v1', source: 'TTRPG', collections: [
    { key: 'campaigns', kind: 'Campaign', route: 'ttrpg-campaigns' }, { key: 'entities', kind: 'World entity', route: 'ttrpg-world', artifact: true },
    { key: 'sessions', kind: 'Game session', route: 'ttrpg-sessions', artifact: true },
  ] },
  { key: 'modulo-business-admin-v1', source: 'Business', collections: [
    { key: 'clients', kind: 'Client', route: 'business-directory' }, { key: 'engagements', kind: 'Engagement', route: 'business-directory' },
    { key: 'agreements', kind: 'Agreement', route: 'business-contracts', artifact: true }, { key: 'reconciliation', kind: 'Reconciliation record', route: 'business-reconciliation' },
    { key: 'obligations', kind: 'Business obligation', route: 'business-obligations' }, { key: 'vendors', kind: 'Vendor', route: 'business-operations' },
    { key: 'correspondence', kind: 'Business correspondence', route: 'business-operations', artifact: true },
  ] },
  { key: 'modulo-time-entries', source: 'Business Time', collections: [{ key: '$root', kind: 'Time entry', route: 'time' }] },
  { key: 'modulo-euer-expenses', source: 'Business Books', collections: [{ key: '$root', kind: 'Expense', route: 'books', artifact: true }] },
  ...[...LIFE_PLUGIN_CONFIGS, ...DOMAIN_COLLECTION_CONFIGS, ...FOUNDATION_TOOL_DEFINITIONS.map((definition) => definition.config), ...SELF_HOSTED_TOOL_DEFINITIONS.map((definition) => definition.config)].map((config) => ({
    key: lifeStoreKey(config.id), source: config.title,
    collections: [{ key: 'records', kind: config.singular, route: config.id }],
  })),
];

const EXTRA_PORTABLE_STORE_KEYS = [
  'modulo-euer-categories',
  'modulo-euer-exported',
  'modulo-invoice-seller',
  'modulo-gobd-classes',
  'modulo-fsrs-deck-limits',
  'modulo-todos',
  'modulo-pipeline-stages',
  'modulo-self-hosted-settings-v1',
  'modulo:audit-onboarding:v1',
  'modulo-quick-capture-v1',
  'modulo-note-tree',
  'modulo-note-collapsed',
];
export const LIFE_OS_DATA_STORE_KEYS = [LIFE_OS_STORE_KEY, ...STORES.map((store) => store.key), ...EXTRA_PORTABLE_STORE_KEYS];

const REFERENCE_RULES: ReferenceRule[] = [
  { storeKey: 'modulo-modified-para-v1', collection: 'projects', field: 'areaIds', targetCollection: 'areas', route: 'para-core' },
  { storeKey: 'modulo-modified-para-v1', collection: 'areas', field: 'parentId', targetCollection: 'areas', route: 'para-core' },
  { storeKey: 'modulo-modified-para-v1', collection: 'resources', field: 'projectIds', targetCollection: 'projects', route: 'para-core' },
  { storeKey: 'modulo-modified-para-v1', collection: 'resources', field: 'areaIds', targetCollection: 'areas', route: 'para-core' },
  { storeKey: 'modulo-modified-para-v1', collection: 'tasks', field: 'projectId', targetCollection: 'projects', route: 'para-tasks' },
  { storeKey: 'modulo-modified-para-v1', collection: 'tasks', field: 'areaId', targetCollection: 'areas', route: 'para-tasks' },
  { storeKey: 'modulo-modified-para-v1', collection: 'goals', field: 'projectIds', targetCollection: 'projects', route: 'para-goals' },
  { storeKey: 'modulo-modified-para-v1', collection: 'goals', field: 'areaIds', targetCollection: 'areas', route: 'para-goals' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'meals', field: 'recipeId', targetCollection: 'recipes', route: 'meal-planner' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'meals', field: 'prepSessionId', targetCollection: 'prepSessions', route: 'meal-planner' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'groceries', field: 'tripId', targetCollection: 'shoppingTrips', route: 'meal-planner' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'groceries', field: 'sourceMealIds', targetCollection: 'meals', route: 'meal-planner' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'prepSessions', field: 'recipeId', targetCollection: 'recipes', route: 'meal-planner' },
  { storeKey: 'modulo-meal-planner-v2', collection: 'prepSessions', field: 'mealIds', targetCollection: 'meals', route: 'meal-planner' },
  { storeKey: 'modulo-education-v1', collection: 'nodes', field: 'parentId', targetCollection: 'nodes', route: 'education-curriculum' },
  { storeKey: 'modulo-education-v1', collection: 'sessions', field: 'nodeId', targetCollection: 'nodes', route: 'education-study' },
  { storeKey: 'modulo-education-v1', collection: 'assignments', field: 'nodeId', targetCollection: 'nodes', route: 'education-assignments' },
  { storeKey: 'modulo-information-intake-v1', collection: 'sessions', field: 'itemId', targetCollection: 'items', route: 'information-workbench' },
  { storeKey: 'modulo-information-intake-v1', collection: 'artifacts', field: 'itemId', targetCollection: 'items', route: 'information-outputs' },
  { storeKey: 'modulo-information-intake-v1', collection: 'items', field: 'projectId', targetCollection: 'projects', route: 'information-intake' },
  { storeKey: 'modulo-information-intake-v1', collection: 'explorationTrails', field: 'projectId', targetCollection: 'projects', route: 'research-projects' },
  { storeKey: 'modulo-information-intake-v1', collection: 'syntheses', field: 'projectId', targetCollection: 'projects', route: 'research-evidence' },
  { storeKey: 'modulo-information-intake-v1', collection: 'cases', field: 'projectId', targetCollection: 'projects', route: 'research-decisions' },
  { storeKey: 'modulo-information-intake-v1', collection: 'creations', field: 'projectId', targetCollection: 'projects', route: 'research-creation' },
  { storeKey: 'modulo-information-intake-v1', collection: 'learningPlans', field: 'projectId', targetCollection: 'projects', route: 'research-learning' },
  { storeKey: 'modulo-information-intake-v1', collection: 'experiments', field: 'projectId', targetCollection: 'projects', route: 'research-iteration' },
  { storeKey: 'modulo-information-intake-v1', collection: 'maintenanceReviews', field: 'projectId', targetCollection: 'projects', route: 'research-maintenance' },
  { storeKey: 'modulo-hobbies-v1', collection: 'sessions', field: 'hobbyId', targetCollection: 'hobbies', route: 'hobby-practice' },
  { storeKey: 'modulo-hobbies-v1', collection: 'sessions', field: 'funActivityId', targetCollection: 'funMenu', route: 'hobby-practice' },
  { storeKey: 'modulo-hobbies-v1', collection: 'artifacts', field: 'hobbyId', targetCollection: 'hobbies', route: 'hobby-practice' },
  { storeKey: 'modulo-music-studio-v1', collection: 'assets', field: 'projectId', targetCollection: 'projects', route: 'music-studio-library' },
  { storeKey: 'modulo-electronics-workbench-v1', collection: 'bom', field: 'projectId', targetCollection: 'projects', route: 'electronics-parts' },
  { storeKey: 'modulo-electronics-workbench-v1', collection: 'bom', field: 'partId', targetCollection: 'parts', route: 'electronics-parts' },
  { storeKey: 'modulo-electronics-workbench-v1', collection: 'lab', field: 'projectId', targetCollection: 'projects', route: 'electronics-lab' },
  { storeKey: 'modulo-homelab-v1', collection: 'assets', field: 'hostId', targetCollection: 'assets', route: 'homelab-assets' },
  { storeKey: 'modulo-homelab-v1', collection: 'runs', field: 'assetId', targetCollection: 'assets', route: 'homelab-operations' },
  { storeKey: 'modulo-wardrobe-v1', collection: 'outfits', field: 'garmentIds', targetCollection: 'garments', route: 'style-studio' },
  { storeKey: 'modulo-wardrobe-v1', collection: 'logs', field: 'outfitId', targetCollection: 'outfits', route: 'style-studio' },
  { storeKey: 'modulo-wardrobe-v1', collection: 'garments', field: 'inventoryId', targetStoreKey: lifeStoreKey('home-inventory'), targetCollection: 'records', route: 'wardrobe-closet' },
  { storeKey: 'modulo-wardrobe-v1', collection: 'garments', field: 'wishlistId', targetStoreKey: lifeStoreKey('wishlist-purchases'), targetCollection: 'records', route: 'wardrobe-closet' },
  { storeKey: 'modulo-ttrpg-v1', collection: 'entities', field: 'campaignId', targetCollection: 'campaigns', route: 'ttrpg-world' },
  { storeKey: 'modulo-ttrpg-v1', collection: 'sessions', field: 'campaignId', targetCollection: 'campaigns', route: 'ttrpg-sessions' },
  { storeKey: 'modulo-business-admin-v1', collection: 'engagements', field: 'clientId', targetCollection: 'clients', route: 'business-directory' },
  { storeKey: 'modulo-business-admin-v1', collection: 'agreements', field: 'clientId', targetCollection: 'clients', route: 'business-contracts' },
  { storeKey: 'modulo-business-admin-v1', collection: 'agreements', field: 'engagementId', targetCollection: 'engagements', route: 'business-contracts' },
  ...[...LIFE_PLUGIN_CONFIGS, ...DOMAIN_COLLECTION_CONFIGS, ...FOUNDATION_TOOL_DEFINITIONS.map((definition) => definition.config), ...SELF_HOSTED_TOOL_DEFINITIONS.map((definition) => definition.config)].flatMap((config) => [
    { storeKey: lifeStoreKey(config.id), collection: 'records', field: 'projectId', targetStoreKey: 'modulo-modified-para-v1', targetCollection: 'projects', route: config.id },
    { storeKey: lifeStoreKey(config.id), collection: 'records', field: 'areaId', targetStoreKey: 'modulo-modified-para-v1', targetCollection: 'areas', route: config.id },
  ]),
];

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const firstText = (item: Record<string, unknown>, keys: string[]): string | undefined => keys.map((key) => text(item[key])).find(Boolean);


export function emptyLifeOsData(): LifeOsData { return { version: 1, relations: [], reviews: [] }; }

export function parseLifeOsData(value: unknown): LifeOsData {
  const raw = object(value);
  const relations = Array.isArray(raw.relations) ? raw.relations : [];
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : [];
  return {
    version: 1,
    relations: relations.map(object).filter((item) => text(item.id) && text(item.fromUid) && text(item.toUid)).map((item) => ({
      id: text(item.id), fromUid: text(item.fromUid), toUid: text(item.toUid),
      type: LIFE_OS_RELATION_TYPES.includes(text(item.type) as LifeOsRelationType) ? text(item.type) as LifeOsRelationType : 'Related',
      label: text(item.label) || text(item.type) || 'Related', createdAt: text(item.createdAt) || undefined,
    })),
    reviews: reviews.map(object).filter((item) => text(item.id) && text(item.date)).map((item) => ({
      id: text(item.id), date: text(item.date), wins: text(item.wins), friction: text(item.friction), nextFocus: text(item.nextFocus), signals: stringList(item.signals),
    })),
  };
}

export const newLifeOsId = (prefix: 'relation' | 'review'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function relationsFor(uid: string, data: LifeOsData): { relation: LifeOsRelation; direction: 'incoming' | 'outgoing' }[] {
  return data.relations.filter((relation) => relation.fromUid === uid || relation.toUid === uid).map((relation) => ({
    relation,
    direction: relation.fromUid === uid ? 'outgoing' as const : 'incoming' as const,
  }));
}

export function withoutRelationsFor(data: LifeOsData, uid: string): { data: LifeOsData; removed: number } {
  const relations = data.relations.filter((relation) => relation.fromUid !== uid && relation.toUid !== uid);
  return { data: { ...data, relations }, removed: data.relations.length - relations.length };
}

export function repairLifeOsRelation(data: LifeOsData, relationId: string, side: 'from' | 'to', uid: string): LifeOsData {
  return {
    ...data,
    relations: data.relations.map((relation) =>
      relation.id !== relationId ? relation : side === 'from' ? { ...relation, fromUid: uid } : { ...relation, toUid: uid }),
  };
}

export function pruneBrokenLifeOsRelations(entities: LifeOsEntity[], data: LifeOsData): { data: LifeOsData; removed: number } {
  const ids = new Set(entities.map((entity) => entity.uid));
  const relations = data.relations.filter((relation) => ids.has(relation.fromUid) && ids.has(relation.toUid));
  return { data: { ...data, relations }, removed: data.relations.length - relations.length };
}

export function collectLifeOsEntities(notes: CoreNote[] = [], stores: Record<string, unknown> = {}): LifeOsEntity[] {
  const entities: LifeOsEntity[] = [];
  for (const store of STORES) {
    const parsed = stores[store.key];
    const data = object(parsed);
    for (const collection of store.collections) {
      const values = collection.key === '$root' && Array.isArray(parsed) ? parsed : Array.isArray(data[collection.key]) ? data[collection.key] as unknown[] : [];
      values.map(object).forEach((item, index) => {
        const id = firstText(item, ['id', 'sourceId']) ?? `${collection.key}-${index}`;
        const title = firstText(item, ['title', 'name', 'description', 'vendor', 'question', 'summary', 'type']) ?? `${collection.kind} ${index + 1}`;
        const done = typeof item.done === 'boolean' ? (item.done ? 'Done' : 'Open') : undefined;
        entities.push({
          uid: `${store.key}:${collection.key}:${id}`, source: store.source, kind: collection.kind, title,
          status: firstText(item, ['status', 'stage', 'state']) ?? done,
          date: firstText(item, ['date', 'doDate', 'deadline', 'dueDate', 'renewalDate', 'expiresOn', 'contractEnd', 'nextSession', 'updatedAt', 'createdAt']),
          detail: searchableText(item), noteIds: referencedNotes(item), record: item,
          tags: stringList(item.tags), route: store.key === 'modulo-information-intake-v1' && collection.key === 'cases' && item.kind === 'Problem' ? 'research-problems' : store.key === 'modulo-information-intake-v1' && collection.key === 'creations' && item.kind === 'Externalization' ? 'research-externalization' : collection.route, artifact: collection.artifact === true,
        });
      });
    }
  }
  notes.forEach((note) => entities.push({
    uid: `core:notes:${note.id}`, source: 'Notes', kind: 'Note', title: note.title,
    date: note.updatedAt ?? note.createdAt, detail: note.markdownContent ?? note.content,
    tags: note.tags?.map((tag) => tag.name) ?? [], route: 'notes', artifact: true,
  }));
  return entities;
}

export function collectLifeOsHealth(entities: LifeOsEntity[], data: LifeOsData, stores: Record<string, unknown> = {}): LifeOsHealthIssue[] {
  const issues: LifeOsHealthIssue[] = [];
  const ids = new Set(entities.map((entity) => entity.uid));
  data.relations.forEach((relation) => {
    if (!ids.has(relation.fromUid) || !ids.has(relation.toUid)) issues.push({
      id: `relation:${relation.id}`, severity: 'Error', source: 'Relations', title: 'Broken cross-plugin relation',
      detail: `“${relation.label}” points to an entity that no longer exists.`, route: 'life-os-relations',
    });
  });
  const duplicates = new Map<string, LifeOsEntity[]>();
  entities.forEach((entity) => {
    const key = `${entity.source}:${entity.kind}:${entity.title.trim().toLocaleLowerCase()}`;
    duplicates.set(key, [...(duplicates.get(key) ?? []), entity]);
  });
  duplicates.forEach((matches) => {
    if (matches.length > 1) issues.push({
      id: `duplicate:${matches[0].uid}`, severity: 'Warning', source: matches[0].source,
      title: `Possible duplicate ${matches[0].kind.toLocaleLowerCase()}`,
      detail: `${matches.length} records are titled “${matches[0].title}”.`, route: matches[0].route,
    });
  });
  REFERENCE_RULES.forEach((rule) => {
    const source = object(stores[rule.storeKey]);
    const target = object(stores[rule.targetStoreKey ?? rule.storeKey]);
    const records = Array.isArray(source[rule.collection]) ? source[rule.collection] as unknown[] : [];
    const targets = new Set((Array.isArray(target[rule.targetCollection]) ? target[rule.targetCollection] as unknown[] : []).map((item) => text(object(item).id)).filter(Boolean));
    records.map(object).forEach((record, index) => {
      const references = Array.isArray(record[rule.field]) ? stringList(record[rule.field]) : [text(record[rule.field])].filter(Boolean);
      references.filter((reference) => !targets.has(reference)).forEach((reference) => issues.push({
        id: `orphan:${rule.storeKey}:${rule.collection}:${text(record.id) || index}:${rule.field}:${reference}`,
        severity: 'Error', source: STORES.find((store) => store.key === rule.storeKey)?.source ?? 'Integration',
        title: 'Orphaned specialist reference',
        detail: `${firstText(record, ['title', 'name', 'description']) ?? 'A record'} references missing ${rule.targetCollection.slice(0, -1)} “${reference}”.`,
        route: rule.route,
      }));
    });
  });
  return issues;
}

export function createLifeOsBackup(
  notes: CoreNote[] = [],
  links: CoreLink[] = [],
  trashedNotes: CoreNote[] = [],
  stores: Record<string, unknown> = {},
): LifeOsBackup {
  const portableStores = Object.fromEntries(
    LIFE_OS_DATA_STORE_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(stores, key))
      .map((key) => [key, stores[key]]),
  );
  return {
    format: LIFE_OS_BACKUP_FORMAT,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    stores: portableStores,
    notes: [...notes, ...trashedNotes].map((note) => ({
      originalId: note.id,
      title: note.title.trim() || 'Untitled Note',
      content: note.markdownContent ?? note.content ?? '',
      tags: note.tags.map((tag) => tag.name),
      trashed: trashedNotes.some((item) => item.id === note.id),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    links: links.map(({ sourceNoteId, targetNoteId, linkType }) => ({ sourceNoteId, targetNoteId, linkType })),
  };
}

export function parseLifeOsBackup(value: unknown): LifeOsBackup {
  const raw = object(value);
  if (raw.format !== LIFE_OS_BACKUP_FORMAT || raw.schemaVersion !== 1) throw new Error('This is not a supported Modulo Life OS backup.');
  const stores = object(raw.stores);
  const notes = Array.isArray(raw.notes) ? raw.notes.map(object).map((note) => {
    if (typeof note.title !== 'string' || !note.title.trim() || typeof note.content !== 'string') throw new Error('Invalid note in backup.');
    if (note.originalId !== undefined && !Number.isSafeInteger(note.originalId)) throw new Error('Invalid original note ID in backup.');
    return ({
    ...(typeof note.originalId === 'number' && Number.isSafeInteger(note.originalId) ? { originalId: note.originalId } : {}),
    ...(Array.isArray(note.tags) ? { tags: stringList(note.tags) } : {}),
    ...(typeof note.trashed === 'boolean' ? { trashed: note.trashed } : {}),
    title: text(note.title), content: text(note.content), createdAt: text(note.createdAt) || undefined, updatedAt: text(note.updatedAt) || undefined,
  }); }) : [];
  return { format: LIFE_OS_BACKUP_FORMAT, schemaVersion: 1, exportedAt: text(raw.exportedAt) || new Date(0).toISOString(), stores, notes, ...(Array.isArray(raw.links) ? { links: raw.links.map((value) => {
    const link = object(value);
    if (!Number.isSafeInteger(link.sourceNoteId) || !Number.isSafeInteger(link.targetNoteId) || !text(link.linkType)) throw new Error('Invalid note link in backup.');
    return { sourceNoteId: link.sourceNoteId as number, targetNoteId: link.targetNoteId as number, linkType: text(link.linkType) };
  }) } : {}) };
}

export function planLifeOsRestore(backup: LifeOsBackup, existingStores: Record<string, unknown> = {}, replace = false) {
  const known = new Set(LIFE_OS_DATA_STORE_KEYS);
  const result: RestoreResult = { restored: [], skipped: [], unknown: [] };
  const planned: Array<{ key: string; value: unknown }> = [];
  Object.entries(backup.stores).forEach(([key, value]) => {
    if (!known.has(key)) { result.unknown.push(key); return; }
    if (!replace && Object.prototype.hasOwnProperty.call(existingStores, key)) { result.skipped.push(key); return; }
    if (key.startsWith('modulo-life-security-') && containsProhibitedSecuritySecret(value)) { result.skipped.push(key); return; }
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') throw new Error(`Invalid store: ${key}`);
    if (key === SOPS_STORE_KEY) parseSops(parsed);
    const descriptor = STORES.find((store) => store.key === key);
    for (const collection of descriptor?.collections ?? []) {
      const items = collection.key === '$root' ? parsed : (parsed as Record<string, unknown>)[collection.key];
      if (items !== undefined && !Array.isArray(items)) throw new Error(`Invalid collection: ${collection.key}`);
      if (Array.isArray(items)) {
        const ids = new Set<unknown>();
        for (const item of items) {
          const id = object(item).id ?? object(item).sourceId;
          if (id === undefined) { if (!item || typeof item !== 'object') throw new Error(`Invalid record in ${collection.key}`); continue; }
          if ((typeof id !== 'string' && typeof id !== 'number') || ids.has(id)) throw new Error(`Missing or duplicate record ID in ${collection.key}`);
          ids.add(id);
        }
      }
    }
    planned.push({ key, value: parsed });
  });
  return { result, planned };
}

const csv = (value: string): string => `"${value.replace(/"/g, '""')}"`;
export function lifeOsEntitiesCsv(entities: LifeOsEntity[]): string {
  return ['uid,source,kind,title,status,date,tags,route', ...entities.map((entity) => [entity.uid, entity.source, entity.kind, entity.title, entity.status ?? '', entity.date ?? '', entity.tags.join('; '), entity.route].map(csv).join(','))].join('\n');
}
export function lifeOsEntitiesMarkdown(entities: LifeOsEntity[]): string {
  const groups = new Map<string, LifeOsEntity[]>();
  entities.forEach((entity) => groups.set(entity.source, [...(groups.get(entity.source) ?? []), entity]));
  return ['# Modulo Life OS Index', '', ...[...groups.entries()].flatMap(([source, items]) => [`## ${source}`, '', ...items.map((item) => `- **${item.title}** — ${item.kind}${item.status ? ` · ${item.status}` : ''}${item.date ? ` · ${item.date.slice(0, 10)}` : ''}`), ''])].join('\n');
}
