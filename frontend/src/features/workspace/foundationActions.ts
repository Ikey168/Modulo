import { defaultProgressUnit, newMediaId, type MediaItem, type MediaLibraryData, type MediaType } from './mediaLibrary';
import { newLifeId, type LifeRecord } from './lifeStore';
import { dayKey } from './noteDates';
import {
  READING_ANNOTATIONS_PLUGIN_ID,
} from './foundationTools';

export type MetadataProvider = 'Open Library' | 'MusicBrainz' | 'TMDB' | 'YouTube' | 'IGDB';

export interface MetadataCredentials {
  tmdbToken?: string;
  youtubeApiKey?: string;
  igdbProxyUrl?: string;
}

export interface MetadataResult {
  provider: MetadataProvider;
  externalId: string;
  title: string;
  creator?: string;
  year?: string;
  artworkUrl?: string;
  sourceUrl?: string;
  type: MediaType;
}

const json = async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return await response.json() as Record<string, unknown>;
};
const list = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const firstText = (value: unknown): string => Array.isArray(value) ? text(value[0]) : text(value);

export async function searchMetadata(provider: MetadataProvider, query: string, credentials: MetadataCredentials = {}): Promise<MetadataResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (provider === 'Open Library') {
    const payload = await json(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i`);
    return list(payload.docs).map((item) => ({
      provider, externalId: text(item.key), title: text(item.title), creator: firstText(item.author_name) || undefined,
      year: item.first_publish_year ? String(item.first_publish_year) : undefined,
      artworkUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : undefined,
      sourceUrl: text(item.key) ? `https://openlibrary.org${text(item.key)}` : undefined, type: 'Book' as MediaType,
    })).filter((item) => item.externalId && item.title);
  }
  if (provider === 'MusicBrainz') {
    const payload = await json(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=10`);
    return list(payload['release-groups']).map((item) => ({
      provider, externalId: text(item.id), title: text(item.title), creator: list(item['artist-credit']).map((credit) => text(credit.name)).filter(Boolean).join(', ') || undefined,
      year: text(item['first-release-date']).slice(0, 4) || undefined,
      artworkUrl: text(item.id) ? `https://coverartarchive.org/release-group/${text(item.id)}/front-500` : undefined,
      sourceUrl: text(item.id) ? `https://musicbrainz.org/release-group/${text(item.id)}` : undefined,
      type: (text(item['primary-type']) === 'Single' ? 'Song' : 'Album') as MediaType,
    })).filter((item) => item.externalId && item.title);
  }
  if (provider === 'TMDB') {
    if (!credentials.tmdbToken) throw new Error('Add a TMDB read-access token for this session.');
    const payload = await json(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false`, { headers: { Authorization: `Bearer ${credentials.tmdbToken}` } });
    return list(payload.results).filter((item) => ['movie', 'tv'].includes(text(item.media_type))).map((item) => ({
      provider, externalId: String(item.id ?? ''), title: text(item.title) || text(item.name),
      year: (text(item.release_date) || text(item.first_air_date)).slice(0, 4) || undefined,
      artworkUrl: text(item.poster_path) ? `https://image.tmdb.org/t/p/w500${text(item.poster_path)}` : undefined,
      sourceUrl: item.id ? `https://www.themoviedb.org/${text(item.media_type)}/${item.id}` : undefined,
      type: (text(item.media_type) === 'tv' ? 'TV series' : 'Movie') as MediaType,
    })).filter((item) => item.externalId && item.title);
  }
  if (provider === 'YouTube') {
    if (/youtu(?:\.be|be\.com)/i.test(q)) {
      const payload = await json(`https://www.youtube.com/oembed?url=${encodeURIComponent(q)}&format=json`);
      return [{ provider, externalId: q, title: text(payload.title), creator: text(payload.author_name) || undefined, artworkUrl: text(payload.thumbnail_url) || undefined, sourceUrl: q, type: 'YouTube video' }];
    }
    if (!credentials.youtubeApiKey) throw new Error('Paste a YouTube URL or add an API key for search.');
    const payload = await json(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${encodeURIComponent(credentials.youtubeApiKey)}`);
    return list(payload.items).map((item) => {
      const snippet = typeof item.snippet === 'object' && item.snippet ? item.snippet as Record<string, unknown> : {};
      const id = typeof item.id === 'object' && item.id ? text((item.id as Record<string, unknown>).videoId) : '';
      const thumbnails = typeof snippet.thumbnails === 'object' && snippet.thumbnails ? snippet.thumbnails as Record<string, unknown> : {};
      const medium = typeof thumbnails.medium === 'object' && thumbnails.medium ? thumbnails.medium as Record<string, unknown> : {};
      return { provider, externalId: id, title: text(snippet.title), creator: text(snippet.channelTitle) || undefined, year: text(snippet.publishedAt).slice(0, 4) || undefined, artworkUrl: text(medium.url) || undefined, sourceUrl: id ? `https://www.youtube.com/watch?v=${id}` : undefined, type: 'YouTube video' as const };
    }).filter((item) => item.externalId && item.title);
  }
  if (!credentials.igdbProxyUrl) throw new Error('IGDB requires a server-side Twitch credential proxy. Add its URL for this session.');
  const payload = await json(credentials.igdbProxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, limit: 10 }) });
  return list(payload.results ?? payload).map((item) => ({ provider, externalId: String(item.id ?? ''), title: text(item.name), year: item.first_release_date ? new Date(Number(item.first_release_date) * 1000).getUTCFullYear().toString() : undefined, artworkUrl: text(item.coverUrl) || undefined, sourceUrl: text(item.url) || undefined, type: 'Video game' as MediaType })).filter((item) => item.externalId && item.title);
}

export function saveMetadataToMedia(result: MetadataResult, data: MediaLibraryData, mediaId?: string): { data: MediaLibraryData; item: MediaItem } {
  const existing = mediaId ? data.items.find((item) => item.id === mediaId) : undefined;
  const item: MediaItem = existing ? {
    ...existing, title: result.title, type: result.type, creator: result.creator ?? existing.creator, coverUrl: result.artworkUrl ?? existing.coverUrl, sourceUrl: result.sourceUrl ?? existing.sourceUrl,
  } : {
    id: newMediaId(), title: result.title, type: result.type, creator: result.creator, coverUrl: result.artworkUrl,
    sourceUrl: result.sourceUrl, status: 'Inbox', currentProgress: 0, totalProgress: 0,
    progressUnit: defaultProgressUnit(result.type), rating: 0, favorite: false, tags: [result.provider.toLowerCase().replace(/\s+/g, '-')],
  };
  return { data: { ...data, items: existing ? data.items.map((current) => current.id === existing.id ? item : current) : [item, ...data.items] }, item };
}

export type FlashcardGrade = 'Again' | 'Hard' | 'Good' | 'Easy';
const addDays = (days: number): string => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};

export function scheduleFlashcard(card: LifeRecord, grade: FlashcardGrade): LifeRecord {
  const score = ({ Again: 1, Hard: 2, Good: 3, Easy: 4 } as const)[grade];
  const previousStability = Math.max(0.1, Number(card.values.stability) || [0, 0.4, 1, 2.4, 5.8][score]);
  const previousDifficulty = Math.max(1, Math.min(10, Number(card.values.difficulty) || 5 - (score - 3) * 1.5));
  const elapsed = card.values.lastReview ? Math.max(0, Math.round((Date.now() - new Date(`${card.values.lastReview}T12:00:00`).getTime()) / 86_400_000)) : 0;
  const retrievability = Math.exp(Math.log(0.9) * elapsed / previousStability);
  const difficulty = Math.max(1, Math.min(10, previousDifficulty - 0.8 * (score - 3)));
  const stability = score === 1
    ? Math.max(0.1, 0.9 * Math.pow(difficulty, -0.2) * (Math.pow(previousStability + 1, 0.3) - 1) * Math.exp(1.1 * (1 - retrievability)))
    : Math.max(0.1, previousStability * (1 + Math.exp(-0.4) * (11 - difficulty) * Math.pow(previousStability, -0.15) * (Math.exp(1.2 * (1 - retrievability)) - 1) * (score === 2 ? 0.7 : score === 4 ? 1.3 : 1)));
  const interval = score === 1 ? 0 : Math.max(1, Math.min(36_500, Math.round(stability)));
  const lapses = Math.max(0, Number(card.values.lapses) || 0) + (score === 1 ? 1 : 0);
  const suspended = lapses >= 8;
  const today = dayKey(new Date());
  return {
    ...card,
    status: suspended ? 'Suspended' : grade === 'Again' ? 'Learning' : 'Review',
    date: addDays(interval),
    values: { ...card.values, intervalDays: String(interval), stability: stability.toFixed(3), difficulty: difficulty.toFixed(3), retrievability: retrievability.toFixed(3), reps: String(Math.max(0, Number(card.values.reps) || 0) + 1), lapses: String(lapses), lastReview: today, lastReviewedAt: new Date().toISOString(), lastGrade: grade },
    log: [{ id: newLifeId('log'), date: today, title: `${grade} · FSRS ${suspended ? 'leech suspended' : `next review in ${interval} day${interval === 1 ? '' : 's'}`}` }, ...card.log],
  };
}

export function promoteAnnotationToFlashcard(annotation: LifeRecord): LifeRecord {
  const card: LifeRecord = {
    id: newLifeId('record'), title: annotation.title, status: 'New', category: annotation.category === 'Vocabulary' ? 'Language' : 'Concept',
    date: dayKey(new Date()), recurrence: 'Once', blockId: 'early-evening', favorite: false,
    tags: [...annotation.tags], notes: annotation.notes, projectId: annotation.projectId, areaId: annotation.areaId,
    values: { deck: 'Reading', front: annotation.values.interpretation || `Explain: ${annotation.title}`, back: annotation.values.excerpt || annotation.notes || '', intervalDays: '0', stability: '0.400', difficulty: '5.000', reps: '0', lapses: '0', source: `${READING_ANNOTATIONS_PLUGIN_ID}:${annotation.id}` }, checklist: [], log: [],
  };
  return card;
}

export function bookmarkToMedia(bookmark: LifeRecord, data: MediaLibraryData): { data: MediaLibraryData; item: MediaItem } {
  const categoryMap: Record<string, MediaType> = { Article: 'Article', Video: 'YouTube video', Podcast: 'Podcast', Paper: 'Article' };
  return saveMetadataToMedia({ provider: 'Open Library', externalId: bookmark.id, title: bookmark.title, creator: bookmark.values.author, sourceUrl: bookmark.values.url, type: categoryMap[bookmark.category] ?? 'Article' }, data);
}

export interface CitationLookup {
  title: string;
  authors: string;
  year?: string;
  container?: string;
  doi: string;
  url?: string;
  formatted: string;
}

export async function lookupDoi(rawDoi: string): Promise<CitationLookup> {
  const doi = rawDoi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  if (!doi) throw new Error('Enter a DOI.');
  const payload = await json(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const message = typeof payload.message === 'object' && payload.message ? payload.message as Record<string, unknown> : {};
  const title = firstText(message.title);
  const authors = list(message.author).map((author) => [text(author.given), text(author.family)].filter(Boolean).join(' ')).filter(Boolean).join(', ');
  const published = typeof message.published === 'object' && message.published ? message.published as Record<string, unknown> : {};
  const dateParts = Array.isArray(published['date-parts']) && Array.isArray(published['date-parts'][0]) ? published['date-parts'][0] as unknown[] : [];
  const year = dateParts[0] ? String(dateParts[0]) : undefined;
  const container = firstText(message['container-title']) || undefined;
  const url = text(message.URL) || `https://doi.org/${doi}`;
  return { title, authors, year, container, doi, url, formatted: `${authors}${year ? ` (${year})` : ''}. ${title}.${container ? ` ${container}.` : ''} https://doi.org/${doi}`.trim() };
}

export function parseCitationImport(source: string): Partial<CitationLookup> {
  const value = source.trim();
  const bib = (key: string) => new RegExp(`${key}\\s*=\\s*[{"]([^}"]+)`, 'i').exec(value)?.[1]?.trim();
  const ris = (key: string) => new RegExp(`^${key}\\s*-\\s*(.+)$`, 'im').exec(value)?.[1]?.trim();
  const title = bib('title') || ris('TI') || ris('T1') || '';
  const authors = [...value.matchAll(/^AU\s*-\s*(.+)$/gim)].map((match) => match[1].trim()).join(', ') || bib('author')?.replace(/\s+and\s+/gi, ', ') || '';
  const year = bib('year') || ris('PY');
  const doi = bib('doi') || ris('DO') || '';
  const url = bib('url') || ris('UR');
  const container = bib('journal') || bib('publisher') || ris('JO') || ris('T2');
  if (!title && !doi) throw new Error('No citation title or DOI found in the BibTeX/RIS text.');
  return { title, authors, year, doi, url, container };
}

export function citationAsBibtex(record: LifeRecord): string {
  const key = record.values.citationKey || record.id.replace(/[^a-z0-9]/gi, '');
  const fields = [['title', record.title], ['author', record.values.authors], ['year', record.values.year], ['journal', record.values.container], ['doi', record.values.doi], ['url', record.values.url]].filter((entry) => entry[1]);
  return `@article{${key},\n${fields.map(([name, value]) => `  ${name} = {${value}}`).join(',\n')}\n}`;
}

export function citationAsRis(record: LifeRecord): string {
  const authors = record.values.authors.split(/,\s*/).filter(Boolean).map((author) => `AU  - ${author}`);
  return ['TY  - JOUR', `TI  - ${record.title}`, ...authors, record.values.year && `PY  - ${record.values.year}`, record.values.container && `JO  - ${record.values.container}`, record.values.doi && `DO  - ${record.values.doi}`, record.values.url && `UR  - ${record.values.url}`, 'ER  -'].filter(Boolean).join('\n');
}

export type CitationStyle = 'APA' | 'MLA' | 'Chicago';
export function formatCitation(record: LifeRecord, style: CitationStyle): string {
  const authors = record.values.authors || 'Unknown author';
  const year = record.values.year || 'n.d.';
  const container = record.values.container;
  const locator = record.values.doi ? `https://doi.org/${record.values.doi}` : record.values.url;
  if (style === 'MLA') return `${authors}. “${record.title}.”${container ? ` ${container},` : ''} ${year}.${locator ? ` ${locator}.` : ''}`;
  if (style === 'Chicago') return `${authors}. “${record.title}.”${container ? ` ${container}` : ''} (${year}).${locator ? ` ${locator}.` : ''}`;
  return `${authors} (${year}). ${record.title}.${container ? ` ${container}.` : ''}${locator ? ` ${locator}` : ''}`;
}
