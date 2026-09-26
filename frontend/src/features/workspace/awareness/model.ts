import type { LifeRecord } from '../lifeStore';

export interface Newsletter { id: string; title: string; sender: string; body: string; url: string; receivedAt: string; messageId: string; status: 'Unread' | 'Saved' | 'Archived' }
export interface Newsletters { items: Newsletter[] }
export interface Watchlist { id: string; name: string; terms: string[]; exclude: string[]; areaId: string; enabled: boolean }
export interface Watchlists { items: Watchlist[] }
export interface Briefing { reviewed: Record<string, string>; deadline: number; day: string }
export interface Signal { id: string; source: 'Feeds' | 'Newsletters' | 'Web Watch'; title: string; body: string; url: string; date: string; route: string }
export interface Story { key: string; revision: string; title: string; signals: Signal[] }
export const EMPTY_NEWSLETTERS: Newsletters = { items: [] };
export const EMPTY_WATCHLISTS: Watchlists = { items: [] };
export const EMPTY_BRIEFING: Briefing = { reviewed: {}, deadline: 0, day: '' };
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Awareness data.'); return value as Record<string, unknown>; };
const str = (value: unknown, max = 1000) => { if (typeof value !== 'string' || value.length > max) throw new Error('Invalid or oversized Awareness text.'); return value; };
const items = (value: unknown) => { const list = record(value).items; if (!Array.isArray(list) || list.length > 5000) throw new Error('Invalid Awareness collection.'); return list; };
export function safeUrl(value: string): string { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } }
export function canonicalUrl(value: string): string {
  const safe = safeUrl(value); if (!safe) return '';
  const url = new URL(safe); url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key)) url.searchParams.delete(key);
  url.searchParams.sort(); return url.href;
}
export function validateNewsletters(value: unknown): Newsletters {
  const ids = new Set<string>();
  for (const raw of items(value)) { const item = record(raw); const id = str(item.id); if (!id || ids.has(id)) throw new Error('Duplicate newsletter ID.'); ids.add(id);
    for (const key of ['title', 'sender', 'receivedAt', 'messageId']) str(item[key]); str(item.body, 200000); const url = str(item.url, 4000); if (url && !safeUrl(url)) throw new Error('Use an HTTP or HTTPS article URL.');
    if (!['Unread', 'Saved', 'Archived'].includes(String(item.status))) throw new Error('Invalid newsletter status.'); }
  return value as Newsletters;
}
export function validateWatchlists(value: unknown): Watchlists {
  const ids = new Set<string>();
  for (const raw of items(value)) { const item = record(raw); const id = str(item.id); if (!id || ids.has(id)) throw new Error('Duplicate watchlist ID.'); ids.add(id); str(item.name); str(item.areaId);
    if (typeof item.enabled !== 'boolean') throw new Error('Invalid watchlist status.');
    for (const key of ['terms', 'exclude']) { const list = item[key]; if (!Array.isArray(list) || list.length > 100 || (key === 'terms' && !list.length)) throw new Error('Add at least one keyword or phrase.'); for (const term of list) if (!str(term, 200).trim()) throw new Error('Keywords cannot be blank.'); }
  } return value as Watchlists;
}
export function validateBriefing(value: unknown): Briefing { const root = record(value); str(root.day, 20); if (typeof root.deadline !== 'number' || !Number.isFinite(root.deadline) || root.deadline < 0) throw new Error('Invalid scan timer.'); const reviewed = record(root.reviewed); if (Object.keys(reviewed).length > 5000) throw new Error('Briefing history is full. Clear reviewed history to continue.'); for (const [key, revision] of Object.entries(reviewed)) { str(key, 5000); str(revision, 50000); } return value as Briefing; }
export function matches(watch: Watchlist, signal: Signal): boolean { const haystack = `${signal.title}\n${signal.body}\n${signal.url}`.toLocaleLowerCase(); return watch.enabled && watch.terms.some(term => haystack.includes(term.toLocaleLowerCase())) && !watch.exclude.some(term => haystack.includes(term.toLocaleLowerCase())); }
export function collectSignals(feeds: LifeRecord[], watches: LifeRecord[], newsletters: Newsletter[]): Signal[] {
  return [
    ...feeds.filter(item => !['Archived', 'Saved'].includes(item.status)).map(item => ({ id: `feed:${item.id}`, source: 'Feeds' as const, title: item.title, body: item.values.summary ?? '', url: safeUrl(item.values.url ?? ''), date: item.values.publishedAt ?? '', route: 'feeds-reading-inbox' })),
    ...watches.filter(item => item.status === 'Changed').map(item => ({ id: `watch:${item.id}`, source: 'Web Watch' as const, title: item.title, body: item.values.diff ?? item.values.changeSummary ?? 'The watched page changed.', url: safeUrl(item.values.sourceUrl ?? item.values.url ?? ''), date: item.values.lastChanged ?? item.values.lastChecked ?? '', route: 'web-watch' })),
    ...newsletters.filter(item => item.status !== 'Archived').map(item => ({ id: `newsletter:${item.id}`, source: 'Newsletters' as const, title: item.title, body: item.body, url: safeUrl(item.url), date: item.receivedAt, route: 'newsletter-inbox' })),
  ];
}
// A compact change marker, not a security or content-authentication hash.
function changeMarker(value: string): string {
  let first = 2166136261, second = 5381;
  for (let i = 0; i < value.length; i++) { first = Math.imul(first ^ value.charCodeAt(i), 16777619); second = Math.imul(second, 33) ^ value.charCodeAt(i); }
  return `${value.length}:${first >>> 0}:${second >>> 0}`;
}
export function groupStories(signals: Signal[]): Story[] {
  const groups = new Map<string, Signal[]>();
  for (const signal of signals) { const key = canonicalUrl(signal.url) || `title:${signal.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`; groups.set(key, [...(groups.get(key) ?? []), signal]); }
  return [...groups].map(([key, members]) => ({ key, title: members[0].title, signals: members, revision: changeMarker(JSON.stringify(members.map(item => [item.id, item.date, item.title, item.body]).sort((a, b) => a[0].localeCompare(b[0])))) }))
    .sort((a, b) => Math.max(...b.signals.map(item => Date.parse(item.date) || 0)) - Math.max(...a.signals.map(item => Date.parse(item.date) || 0)));
}
export function mergeNewsletters(current: Newsletter[], incoming: Newsletter[]): Newsletter[] {
  const result = [...current];
  for (const item of incoming) if (!result.some(existing => item.messageId ? existing.messageId === item.messageId : existing.title === item.title && existing.sender === item.sender && existing.body === item.body)) result.unshift(item);
  return result;
}
