import type { LifeOsEntity } from './lifeOs';

const secretKey = /password|secret|token|credential|privateKey|attachmentBytes/i;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Search human content, including nested fields, without indexing credential fields. */
export function searchableText(value: unknown, depth = 0): string {
  if (depth > 12) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => searchableText(item, depth + 1)).join('\n');
  return Object.entries(record(value)).filter(([key]) => !secretKey.test(key))
    .map(([, item]) => searchableText(item, depth + 1)).join('\n');
}
export function referencedNotes(value: unknown, depth = 0): number[] {
  if (depth > 12) return [];
  if (typeof value === 'string') {
    try { return referencedNotes(JSON.parse(value), depth + 1); } catch { return /^note:\d+$/.test(value) ? [Number(value.slice(5))] : []; }
  }
  if (Array.isArray(value)) return [...new Set(value.flatMap(item => referencedNotes(item, depth + 1)))];
  return [...new Set(Object.entries(record(value)).flatMap(([key, item]) => {
    if (secretKey.test(key)) return [];
    if (/^(noteId|sourceNoteId)$/.test(key) && Number.isSafeInteger(Number(item)) && Number(item) > 0) return [Number(item)];
    if (/^(noteIds|evidenceIds|procedureIds)$/.test(key) && Array.isArray(item)) return item.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
    return referencedNotes(item, depth + 1);
  }))];
}
export function stateEntities(namespace: string, label: string, value: unknown): LifeOsEntity[] {
  const root = record(value);
  const data = record(root.data ?? root);
  return Object.entries(data).flatMap(([collection, items]) => {
    if (!Array.isArray(items)) return [];
    return items.flatMap(raw => {
      const item = record(raw);
      if (typeof item.id !== 'string' || typeof item.title !== 'string') return [];
      const parameter = namespace === 'project-workspaces' ? 'project' : namespace === 'executable-runbooks' ? 'run' : namespace === 'decision-journal' ? 'decision' : undefined;
      // These namespaces have addressable records. Other stores use the existing local record reader.
      if (!parameter) return [];
      return [{ uid: `state:${namespace}:${collection}:${item.id}`, source: label, kind: collection === 'runs' ? 'Run receipt' : collection === 'projects' ? 'Project' : 'Decision', title: item.title,
        detail: searchableText(item), noteIds: referencedNotes(item), tags: [], artifact: true, route: namespace,
        path: `${namespace}?${parameter}=${encodeURIComponent(item.id)}` }];
    });
  });
}
export function searchEntities(entities: LifeOsEntity[], query: string, limit = 100): LifeOsEntity[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entities.map(entity => {
    const title = entity.title.toLocaleLowerCase();
    const body = `${title}\n${entity.source}\n${entity.kind}\n${entity.detail ?? ''}\n${entity.tags.join(' ')}`.toLocaleLowerCase();
    return { entity, score: terms.every(term => body.includes(term)) ? terms.reduce((score, term) => score + (title.includes(term) ? 10 : 1), 0) : -1 };
  }).filter(hit => hit.score >= 0).sort((a, b) => b.score - a.score || a.entity.title.localeCompare(b.entity.title)).slice(0, limit).map(hit => hit.entity);
}
export function searchExcerpt(entity: LifeOsEntity, query: string): string {
  const body = (entity.detail ?? '').replace(/\s+/g, ' ');
  const term = query.trim().split(/\s+/).find(term => body.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
  const start = term ? Math.max(0, body.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) - 50) : 0;
  return `${start ? '…' : ''}${body.slice(start, start + 180)}${body.length > start + 180 ? '…' : ''}`;
}
