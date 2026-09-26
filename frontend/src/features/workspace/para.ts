import { dayKey } from './noteDates';
// Canonical model shared by the Modified PARA plugin pack. Domain-specific
// plugins may keep independent stores and attach through stable externalRefs.
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { keepUnknown } from './keepUnknown';
import { parseTaskTags } from '../taskTags';

export const PARA_STORE_KEY = 'modulo-modified-para-v1';

export type ProjectStatus = 'Idea' | 'Planning' | 'Active' | 'On Hold' | 'Done';
export type AreaHealth = 'On Fire' | 'Rebuilding' | 'Messy' | 'Growing' | 'Under Control' | 'Optimal';
export type AreaChecklistHealth = Extract<AreaHealth, 'Rebuilding' | 'Messy' | 'Growing' | 'Under Control'>;
export interface AreaRequirement { id: string; text: string; done: boolean; }
export type AreaRequirements = Partial<Record<AreaChecklistHealth, AreaRequirement[]>>;
export type AreaFocus = 'Core' | 'Maintain' | 'Low' | 'Up Next' | 'Later';
export type ResourceType = 'Note' | 'Source' | 'Idea' | 'Reference';
export type ResourceStatus = 'Inbox' | 'Queued' | 'In Progress' | 'Evergreen';
export type TaskStatus = 'Inbox' | 'Next' | 'Waiting' | 'Scheduled' | 'Done';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Energy = 'Low' | 'Medium' | 'High';
export type GoalStatus = 'Emerging' | 'Active' | 'Closing' | 'Archived';
export type GoalLevel = 'Core Arc' | 'Goal' | 'Milestone';
export type InboxKind = 'Thought' | 'Task' | 'Idea' | 'Link';

export const PROJECT_STATUSES: ProjectStatus[] = ['Idea', 'Planning', 'Active', 'On Hold', 'Done'];
export const AREA_HEALTH: AreaHealth[] = ['On Fire', 'Rebuilding', 'Messy', 'Growing', 'Under Control', 'Optimal'];
export const AREA_FOCUS: AreaFocus[] = ['Core', 'Maintain', 'Low', 'Up Next', 'Later'];
export const AREA_ICON_IDS = ['compass', 'health', 'fitness', 'career', 'money', 'home', 'people', 'learning', 'reading', 'travel', 'places', 'creative', 'nature', 'personal'] as const;
export type AreaIconId = typeof AREA_ICON_IDS[number];
export const RESOURCE_TYPES: ResourceType[] = ['Note', 'Source', 'Idea', 'Reference'];
export const RESOURCE_STATUSES: ResourceStatus[] = ['Inbox', 'Queued', 'In Progress', 'Evergreen'];
export const TASK_STATUSES: TaskStatus[] = ['Inbox', 'Next', 'Waiting', 'Scheduled', 'Done'];
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];
export const ENERGIES: Energy[] = ['Low', 'Medium', 'High'];
export const GOAL_STATUSES: GoalStatus[] = ['Emerging', 'Active', 'Closing', 'Archived'];
export const GOAL_LEVELS: GoalLevel[] = ['Core Arc', 'Goal', 'Milestone'];

export interface ExternalRef { pluginId: string; entityType: string; entityId: string; }
export interface ParaProject { id: string; name: string; outcome: string; notes?: string; status: ProjectStatus; areaIds: string[]; deadline?: string; priority: Priority; archivedAt?: string; sourceId?: string; externalRefs?: ExternalRef[]; }
export interface ParaArea { id: string; name: string; category: string; focus: AreaFocus; health: AreaHealth; vision: string; icon?: AreaIconId; requirements?: AreaRequirements; requirementsRevision?: Partial<Record<AreaChecklistHealth, number>>; parentId?: string; archivedAt?: string; sourceId?: string; externalRefs?: ExternalRef[]; }
export interface ParaResource { id: string; title: string; type: ResourceType; status: ResourceStatus; url?: string; content?: string; noteId?: number; projectIds: string[]; areaIds: string[]; archivedAt?: string; sourceId?: string; externalRefs?: ExternalRef[]; }
export interface ParaTask { id: string; title: string; status: TaskStatus; priority: Priority; energy: Energy; context?: string; tags?: string[]; projectId?: string; areaId?: string; blockId?: DayBlockId; doDate?: string; deadline?: string; archivedAt?: string; sourceId?: string; externalRefs?: ExternalRef[]; }
export interface ParaGoal { id: string; title: string; level: GoalLevel; status: GoalStatus; horizon?: string; progress: number; areaIds: string[]; archivedAt?: string; sourceId?: string; externalRefs?: ExternalRef[]; }
export interface ParaInboxItem { id: string; title: string; kind: InboxKind; detail?: string; capturedAt: string; sourceId?: string; }
export interface ParaReview { id: string; date: string; wins: string; friction: string; nextFocus: string; checklist: boolean[]; signals: string[]; }

export interface ParaData {
  version: 1;
  projects: ParaProject[];
  areas: ParaArea[];
  resources: ParaResource[];
  tasks: ParaTask[];
  goals: ParaGoal[];
  inbox: ParaInboxItem[];
  reviews: ParaReview[];
}

export const REVIEW_CHECKLIST = [
  'Process the capture inbox',
  'Give every active project a next action',
  'Review Waiting and Scheduled tasks',
  'Scan Areas and update their health',
  'Check whether active Arcs still span the right subareas',
  'Link or archive orphan Resources',
  'Archive completed or abandoned work',
];

export const EMPTY_PARA: ParaData = { version: 1, projects: [], areas: [], resources: [], tasks: [], goals: [], inbox: [], reviews: [] };
export const createEmptyPara = (): ParaData => ({ version: 1, projects: [], areas: [], resources: [], tasks: [], goals: [], inbox: [], reviews: [] });

const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const strings = (value: unknown): string[] => arr(value).filter((item): item is string => typeof item === 'string');
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
const optionalPick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const valid = (value: unknown, label: string): boolean => str(record(value).id).length > 0 && str(record(value)[label]).length > 0;
const checklistHealth: AreaChecklistHealth[] = ['Rebuilding', 'Messy', 'Growing', 'Under Control'];
const parseRequirements = (value: unknown): AreaRequirements => {
  const raw = record(value);
  return Object.fromEntries(checklistHealth.filter((health) => Array.isArray(raw[health])).map((health) => [
    health,
    arr(raw[health]).filter((item) => valid(item, 'text')).map((item) => {
      const requirement = record(item);
      return { id: str(requirement.id), text: str(requirement.text), done: requirement.done === true };
    }),
  ])) as AreaRequirements;
};

const parseRequirementsRevision = (value: unknown): Partial<Record<AreaChecklistHealth, number>> => {
  const raw = record(value);
  return Object.fromEntries(checklistHealth.flatMap((health) => {
    const revision = raw[health];
    return typeof revision === 'number' && Number.isInteger(revision) && revision > 0 ? [[health, revision]] : [];
  }));
};

export function parsePara(value: unknown): ParaData {
  const raw = record(value);
  return keepUnknown(raw, {
    version: 1,
    projects: arr(raw.projects).filter((x) => valid(x, 'name')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), name: str(v.name), outcome: str(v.outcome), notes: str(v.notes) || undefined, status: pick(v.status, PROJECT_STATUSES, 'Idea'), areaIds: strings(v.areaIds), deadline: str(v.deadline) || undefined, priority: pick(v.priority, PRIORITIES, 'P3'), archivedAt: str(v.archivedAt) || undefined, sourceId: str(v.sourceId) || undefined, externalRefs: arr(v.externalRefs) as ExternalRef[] }); }),
    areas: arr(raw.areas).filter((x) => valid(x, 'name')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), name: str(v.name), category: str(v.category, 'Uncategorized'), focus: pick(v.focus, AREA_FOCUS, 'Maintain'), health: pick(v.health, AREA_HEALTH, 'Growing'), vision: str(v.vision), icon: optionalPick(v.icon, AREA_ICON_IDS), requirements: parseRequirements(v.requirements), requirementsRevision: parseRequirementsRevision(v.requirementsRevision), parentId: str(v.parentId) || undefined, archivedAt: str(v.archivedAt) || undefined, sourceId: str(v.sourceId) || undefined, externalRefs: arr(v.externalRefs) as ExternalRef[] }); }),
    resources: arr(raw.resources).filter((x) => valid(x, 'title')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), title: str(v.title), type: pick(v.type, RESOURCE_TYPES, 'Note'), status: pick(v.status, RESOURCE_STATUSES, 'Inbox'), url: str(v.url) || undefined, content: str(v.content) || undefined, noteId: typeof v.noteId === 'number' ? v.noteId : undefined, projectIds: strings(v.projectIds), areaIds: strings(v.areaIds), archivedAt: str(v.archivedAt) || undefined, sourceId: str(v.sourceId) || undefined, externalRefs: arr(v.externalRefs) as ExternalRef[] }); }),
    tasks: arr(raw.tasks).filter((x) => valid(x, 'title')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), title: str(v.title), status: pick(v.status, TASK_STATUSES, 'Inbox'), priority: pick(v.priority, PRIORITIES, 'P3'), energy: pick(v.energy, ENERGIES, 'Medium'), context: str(v.context) || undefined, tags: parseTaskTags(v.tags), projectId: str(v.projectId) || undefined, areaId: str(v.areaId) || undefined, blockId: optionalPick(v.blockId, DAY_BLOCKS.map((block) => block.id)), doDate: str(v.doDate) || undefined, deadline: str(v.deadline) || undefined, archivedAt: str(v.archivedAt) || undefined, sourceId: str(v.sourceId) || undefined, externalRefs: arr(v.externalRefs) as ExternalRef[] }); }),
    goals: arr(raw.goals).filter((x) => valid(x, 'title')).map((x) => {
      const v = record(x);
      const legacyFree = { ...v };
      delete legacyFree.projectIds;
      return keepUnknown(legacyFree, { id: str(v.id), title: str(v.title), level: pick(v.level, GOAL_LEVELS, 'Goal'), status: pick(v.status, GOAL_STATUSES, 'Emerging'), horizon: str(v.horizon) || undefined, progress: Math.max(0, Math.min(100, typeof v.progress === 'number' ? v.progress : Number(v.progress) || 0)), areaIds: strings(v.areaIds), archivedAt: str(v.archivedAt) || undefined, sourceId: str(v.sourceId) || undefined, externalRefs: arr(v.externalRefs) as ExternalRef[] });
    }),
    inbox: arr(raw.inbox).filter((x) => valid(x, 'title')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), title: str(v.title), kind: pick(v.kind, ['Thought', 'Task', 'Idea', 'Link'], 'Thought'), detail: str(v.detail) || undefined, capturedAt: str(v.capturedAt, new Date().toISOString()), sourceId: str(v.sourceId) || undefined }); }),
    reviews: arr(raw.reviews).filter((x) => valid(x, 'date')).map((x) => { const v = record(x); return keepUnknown(v, { id: str(v.id), date: str(v.date), wins: str(v.wins), friction: str(v.friction), nextFocus: str(v.nextFocus), checklist: arr(v.checklist).map(Boolean).slice(0, REVIEW_CHECKLIST.length), signals: strings(v.signals) }); }),
  });
}

export const newParaId = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
export const isoDay = (date = new Date()): string => dayKey(date);

function mergeById<T extends { id: string; sourceId?: string }>(current: T[], incoming: T[]): T[] {
  const merged = new Map(current.map((item) => [item.sourceId ? `source:${item.sourceId}` : `id:${item.id}`, item]));
  for (const item of incoming) merged.set(item.sourceId ? `source:${item.sourceId}` : `id:${item.id}`, item);
  return [...merged.values()];
}

export function mergePara(current: ParaData, incoming: ParaData): ParaData {
  return { ...current, ...incoming, version: 1, projects: mergeById(current.projects, incoming.projects), areas: mergeById(current.areas, incoming.areas), resources: mergeById(current.resources, incoming.resources), tasks: mergeById(current.tasks, incoming.tasks), goals: mergeById(current.goals, incoming.goals), inbox: mergeById(current.inbox, incoming.inbox), reviews: mergeById(current.reviews, incoming.reviews) };
}

/** An area owns its projects and those assigned anywhere beneath it. */
export function projectsForArea(data: ParaData, areaId: string): ParaProject[] {
  const children = new Map<string, string[]>();
  for (const area of data.areas) {
    if (!area.parentId) continue;
    const siblings = children.get(area.parentId) ?? [];
    siblings.push(area.id);
    children.set(area.parentId, siblings);
  }
  const included = new Set<string>([areaId]);
  const queue = [areaId];
  for (let index = 0; index < queue.length; index++) {
    for (const childId of children.get(queue[index]) ?? []) {
      if (included.has(childId)) continue;
      included.add(childId);
      queue.push(childId);
    }
  }
  return data.projects.filter((project) =>
    !project.archivedAt && project.areaIds.some((id) => included.has(id)),
  );
}

export function reviewSignals(data: ParaData): string[] {
  const activeProjectIds = new Set(data.projects.filter((p) => !p.archivedAt && p.status === 'Active').map((p) => p.id));
  const projectNextActions = new Set(data.tasks.filter((t) => !t.archivedAt && t.status === 'Next' && t.projectId).map((t) => t.projectId));
  const signals: string[] = [];
  for (const project of data.projects.filter((p) => activeProjectIds.has(p.id) && !projectNextActions.has(p.id))) signals.push(`Project without a next action: ${project.name}`);
  for (const area of data.areas.filter((a) => !a.archivedAt && ['On Fire', 'Rebuilding', 'Messy'].includes(a.health))) signals.push(`Area needs attention: ${area.name} (${area.health})`);
  if (data.inbox.length) signals.push(`${data.inbox.length} unprocessed capture${data.inbox.length === 1 ? '' : 's'}`);
  const linkedResources = data.resources.filter((r) => !r.archivedAt && r.projectIds.length === 0 && r.areaIds.length === 0);
  if (linkedResources.length) signals.push(`${linkedResources.length} orphan resource${linkedResources.length === 1 ? '' : 's'}`);
  for (const goal of data.goals.filter((g) => !g.archivedAt && g.status === 'Active' && g.areaIds.length === 0)) signals.push(`Active arc without a subarea: ${goal.title}`);
  return signals;
}
