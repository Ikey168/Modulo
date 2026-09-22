import {
  createEmptyPara, parsePara, type AreaFocus, type AreaHealth, type GoalLevel, type GoalStatus,
  type ParaData, type Priority, type ProjectStatus, type ResourceStatus, type ResourceType, type TaskStatus,
} from './para';
import { dayBlockIdFromLabel } from './dayBlocks';

export interface MarkdownImport { sourceId: string; title: string; content: string; }
export interface NotionImportPreview { data: ParaData; markdown: MarkdownImport[]; files: number; warnings: string[]; }
type CsvRow = Record<string, string>;

export function parseCsv(source: string): CsvRow[] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && source[i + 1] === '\n') i += 1; row.push(field); if (row.some((x) => x.length)) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  row.push(field); if (row.some((x) => x.length)) rows.push(row);
  const headers = rows.shift()?.map(normalize) ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

const normalize = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const value = (row: CsvRow, ...names: string[]): string => names.map(normalize).map((name) => row[name]).find(Boolean) ?? '';
const relations = (raw: string): string[] => raw.split(/[,;]+/).map((x) => normalize(x)).filter(Boolean);
const choice = <T extends string>(raw: string, options: readonly T[], fallback: T): T => options.find((option) => normalize(option) === normalize(raw)) ?? fallback;
const stableId = (prefix: string, source: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${prefix}-notion-${(hash >>> 0).toString(36)}`;
};
const cleanTitle = (filename: string): string => filename.replace(/\.[^.]+$/, '').replace(/\s+[0-9a-f]{32}$/i, '').trim();
const archived = (raw: string, filename: string): string | undefined => /archiv/i.test(raw) || /archive/i.test(filename) ? new Date().toISOString() : undefined;

function kindOf(filename: string): 'tasks' | 'projects' | 'areas' | 'resources' | 'goals' | 'reviews' | null {
  const name = normalize(filename);
  if (/task|nextaction|todo/.test(name)) return 'tasks';
  if (/project/.test(name)) return 'projects';
  if (/area/.test(name)) return 'areas';
  if (/goal|arc/.test(name)) return 'goals';
  if (/review|reflection/.test(name)) return 'reviews';
  if (/resource|source|reading|note|idea/.test(name)) return 'resources';
  return null;
}

export async function previewNotionFiles(files: File[]): Promise<NotionImportPreview> {
  let data: ParaData = createEmptyPara(); const markdown: MarkdownImport[] = []; const warnings: string[] = [];
  const drafts: Array<{ kind: NonNullable<ReturnType<typeof kindOf>>; row: CsvRow; id: string }> = [];
  for (const file of files) {
    const source = await file.text(); const sourceName = file.webkitRelativePath || file.name;
    if (/\.json$/i.test(file.name)) { data = mergePreview(data, parsePara(JSON.parse(source))); continue; }
    if (/\.md$/i.test(file.name)) {
      const sourceId = `notion:file:${sourceName}`; const title = cleanTitle(file.name);
      markdown.push({ sourceId, title, content: source });
      data.resources.push({ id: stableId('resource', sourceId), sourceId, title, type: 'Note', status: 'Evergreen', content: source, projectIds: [], areaIds: [] });
      continue;
    }
    if (!/\.csv$/i.test(file.name)) { warnings.push(`Skipped unsupported file: ${file.name}`); continue; }
    const kind = kindOf(file.name);
    if (!kind) { warnings.push(`Could not map CSV automatically: ${file.name}`); continue; }
    for (const row of parseCsv(source)) {
      const title = value(row, 'name', 'title', 'task', 'project', 'area', 'goal');
      if (!title) continue;
      const sourceId = value(row, 'id', 'url') || `notion:${sourceName}:${title}`; const id = stableId(kind.slice(0, -1), sourceId); const status = value(row, 'status', 'arc status');
      drafts.push({ kind, row, id });
      if (kind === 'projects') data.projects.push({ id, sourceId, name: title, outcome: value(row, 'outcome', 'definition of done', 'description'), status: mapProject(status), areaIds: [], deadline: value(row, 'deadline', 'due date') || undefined, priority: mapPriority(value(row, 'priority')), archivedAt: archived(status, file.name) });
      if (kind === 'areas') data.areas.push({ id, sourceId, name: title, category: value(row, 'category') || 'Uncategorized', focus: mapAreaFocus(value(row, 'focus level', 'focus')), health: mapAreaHealth(value(row, 'health', 'status')), vision: value(row, 'vision', 'under control', 'description'), archivedAt: archived(status, file.name) });
      if (kind === 'resources') data.resources.push({ id, sourceId, title, type: mapResourceType(value(row, 'type', 'note type')), status: mapResourceStatus(status), url: value(row, 'url', 'link') || undefined, projectIds: [], areaIds: [], archivedAt: archived(status, file.name) });
      if (kind === 'tasks') data.tasks.push({ id, sourceId, title, status: mapTask(status), priority: mapPriority(value(row, 'priority')), energy: choice(value(row, 'energy'), ['Low', 'Medium', 'High'], 'Medium'), context: value(row, 'context') || undefined, blockId: dayBlockIdFromLabel(value(row, 'block')), doDate: value(row, 'do date', 'scheduled') || undefined, deadline: value(row, 'deadline', 'due date') || undefined, archivedAt: archived(status, file.name) });
      if (kind === 'goals') data.goals.push({ id, sourceId, title, level: mapGoalLevel(value(row, 'level')), status: mapGoalStatus(status), horizon: value(row, 'horizon', 'quarter') || undefined, progress: Number(value(row, 'progress').replace('%', '')) || 0, areaIds: [], archivedAt: archived(status, file.name) });
      if (kind === 'reviews') data.reviews.push({ id, date: value(row, 'date') || title, wins: value(row, 'wins'), friction: value(row, 'friction'), nextFocus: value(row, 'next focus', 'focus'), checklist: [], signals: [] });
    }
  }
  recoverRelations(data, drafts);
  return { data: parsePara(data), markdown, files: files.length, warnings };
}

function recoverRelations(data: ParaData, drafts: Array<{ kind: NonNullable<ReturnType<typeof kindOf>>; row: CsvRow; id: string }>) {
  const projectIds = new Map(data.projects.map((x) => [normalize(x.name), x.id])); const areaIds = new Map(data.areas.map((x) => [normalize(x.name), x.id]));
  const resolve = (raw: string, index: Map<string, string>) => relations(raw).map((name) => index.get(name)).filter((id): id is string => Boolean(id));
  for (const draft of drafts) {
    const projects = resolve(value(draft.row, 'project', 'projects', 'related projects'), projectIds); const areas = resolve(value(draft.row, 'area', 'areas', 'related areas'), areaIds);
    if (draft.kind === 'projects') { const item = data.projects.find((x) => x.id === draft.id); if (item) item.areaIds = areas; }
    if (draft.kind === 'resources') { const item = data.resources.find((x) => x.id === draft.id); if (item) { item.projectIds = projects; item.areaIds = areas; } }
    if (draft.kind === 'tasks') { const item = data.tasks.find((x) => x.id === draft.id); if (item) { item.projectId = projects[0]; item.areaId = areas[0]; } }
    if (draft.kind === 'goals') { const item = data.goals.find((x) => x.id === draft.id); if (item) item.areaIds = areas; }
  }
}

function mergePreview(a: ParaData, b: ParaData): ParaData { return { version: 1, projects: [...a.projects, ...b.projects], areas: [...a.areas, ...b.areas], resources: [...a.resources, ...b.resources], tasks: [...a.tasks, ...b.tasks], goals: [...a.goals, ...b.goals], inbox: [...a.inbox, ...b.inbox], reviews: [...a.reviews, ...b.reviews] }; }
function mapProject(v: string): ProjectStatus { if (/done|complete/i.test(v)) return 'Done'; if (/hold|paused/i.test(v)) return 'On Hold'; if (/active|progress/i.test(v)) return 'Active'; if (/plan/i.test(v)) return 'Planning'; return 'Idea'; }
function mapTask(v: string): TaskStatus { if (/done|complete/i.test(v)) return 'Done'; if (/wait/i.test(v)) return 'Waiting'; if (/sched|calendar/i.test(v)) return 'Scheduled'; if (/next|progress/i.test(v)) return 'Next'; return 'Inbox'; }
function mapPriority(v: string): Priority { if (/urgent|p1|highest/i.test(v)) return 'P1'; if (/high|p2/i.test(v)) return 'P2'; if (/low|p4/i.test(v)) return 'P4'; return 'P3'; }
function mapAreaFocus(v: string): AreaFocus { return choice(v, ['Core', 'Maintain', 'Low', 'Up Next', 'Later'], 'Maintain'); }
function mapAreaHealth(v: string): AreaHealth { return choice(v, ['On Fire', 'Rebuilding', 'Messy', 'Growing', 'Under Control', 'Optimal'], 'Growing'); }
function mapResourceType(v: string): ResourceType { return choice(v, ['Note', 'Source', 'Idea', 'Reference'], 'Note'); }
function mapResourceStatus(v: string): ResourceStatus { return choice(v, ['Inbox', 'Queued', 'In Progress', 'Evergreen'], 'Inbox'); }
function mapGoalLevel(v: string): GoalLevel { return choice(v, ['Core Arc', 'Goal', 'Milestone'], 'Goal'); }
function mapGoalStatus(v: string): GoalStatus { return choice(v, ['Emerging', 'Active', 'Closing', 'Archived'], 'Emerging'); }
