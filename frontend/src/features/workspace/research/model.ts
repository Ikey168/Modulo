export interface ResearchReference { id: string; kind: string; title: string; route: string }
export interface SourcePolicy { allowedHosts: string[]; primaryHosts: string[]; languages: string[]; regions: string[]; maxAgeDays: number }
export interface ResearchSource { id: string; title: string; url: string; documentId: string; path: string; excerpt: string; authority: string }
export interface Finding { id: string; text: string; verdict: string; citationState: string; method: string; support: string[]; contradictions: string[] }
export interface Snapshot { status: string; findings: Finding[]; sources: ResearchSource[]; coverageGaps: string[]; assumptions: string[]; refusal: string }
export interface DeltaPart { added: string[]; removed: string[]; changed: string[] }
export interface ResearchResult {
  id: string; question: string; domain: string; policy: SourcePolicy; references: ResearchReference[];
  createdAt: string; refreshedAt: string; runId: string; runReference: string; snapshot: Snapshot;
  delta: { kind: string; material: boolean; findings: DeltaPart; sources: DeltaPart; statusChanged: boolean; reason: string };
  history: { runId: string; snapshot: Snapshot }[];
  outputs: { id: string; kind: string; runId: string; targetId?: string; noteId?: number; createdAt: string }[];
}
export interface ResearchRecord { key: string; version: number; value: ResearchResult }
export const emptyPolicy: SourcePolicy = { allowedHosts: [], primaryHosts: [], languages: [], regions: [], maxAgeDays: 0 };
export const researchPath = (id: string) => `/app/research-noesis?research=${encodeURIComponent(id)}`;
export function objectReference(record: unknown, title: string): ResearchReference | undefined {
  if (!record || typeof record !== 'object' || !('id' in record)) return undefined;
  const r = record as Record<string, unknown>; let id = String(r.id);
  let kind = 'record';
  if ('outcome' in r && 'areaIds' in r) kind = 'project';
  else if ('vision' in r && 'health' in r) kind = 'area';
  else if ('energy' in r && 'priority' in r) kind = 'task';
  else if ('projectIds' in r && 'type' in r) kind = 'resource';
  const uidMatch = /^modulo-modified-para-v1:(projects|areas|tasks|resources):(.+)$/.exec(id);
  if (uidMatch) { kind = uidMatch[1].slice(0, -1); id = uidMatch[2]; }
  const para = ['project', 'area', 'task', 'resource'].includes(kind);
  const route = window.location.pathname.split('/').pop() || '';
  const information: Record<string, [string, string]> = { 'research-decisions': ['cases', 'decision'], 'research-problems': ['cases', 'question'], 'research-projects': ['explorationTrails', 'question'], 'research-evidence': ['syntheses', 'question'], 'information-intake': ['items', 'idea'] };
  if (information[route] && !para) { const [collection, refKind] = information[route]; return { id, kind: refKind, title, route: `${window.location.pathname}?record=${encodeURIComponent(`modulo-information-intake-v1:${collection}:${id}`)}` }; }
  const uid = para ? `modulo-modified-para-v1:${kind === 'resource' ? 'resources' : `${kind}s`}:${id}` : ('values' in r ? `modulo-life-${route}-v1:records:${id}` : id);
  return { id, kind, title, route: `${window.location.pathname}?record=${encodeURIComponent(uid)}` };
}
