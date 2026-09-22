import { keepUnknown } from './keepUnknown';

export const MEDIA_LIBRARY_STORE_KEY = 'modulo-media-library-v2';
export const LEGACY_MEDIA_LIBRARY_STORE_KEY = 'modulo-media-library-v1';

export const MEDIA_TYPES = ['Book', 'Ebook', 'Short story', 'Novella', 'Essay', 'Article', 'Comic & graphic novel', 'Manga', 'Magazine & zine', 'Poetry', 'Photograph', 'Artwork', 'Graphic design', 'Architecture', 'Product design', 'Illustration', 'Movie', 'TV series', 'Documentary', 'Short film', 'Animation', 'Music video', 'Experimental film', 'YouTube video', 'Web series', 'Commercial & title sequence', 'Course', 'Audiobook', 'Album', 'Song', 'Podcast', 'Radio drama', 'Radio documentary', 'DJ mix', 'Live recording', 'Interview', 'Speech & lecture', 'Debate', 'Oral history', 'Reading', 'Video game', 'Board game', 'TTRPG', 'Card game', 'Puzzle', 'ARG', 'Theatre', 'Musical', 'Opera', 'Dance', 'Concert', 'Performance art', 'Circus & physical theatre', 'Magic & illusion', 'Live performance', 'Stand-up'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export interface MediaTypePluginDefinition {
  type: MediaType;
  pluginId: string;
  label: string;
  family: 'Written' | 'Seen' | 'Watched' | 'Listened' | 'Spoken' | 'Played' | 'Live';
}

/** One independently installable plugin for every format understood by the
 * shared media store. The view id intentionally matches the plugin id so deep
 * links and install prompts stay predictable. */
export const MEDIA_TYPE_PLUGIN_DEFINITIONS: readonly MediaTypePluginDefinition[] = [
  { type: 'Book', pluginId: 'media-books', label: 'Books', family: 'Written' },
  { type: 'Ebook', pluginId: 'media-ebooks', label: 'Ebooks', family: 'Written' },
  { type: 'Short story', pluginId: 'media-short-stories', label: 'Short stories', family: 'Written' },
  { type: 'Novella', pluginId: 'media-novellas', label: 'Novellas', family: 'Written' },
  { type: 'Essay', pluginId: 'media-essays', label: 'Essays', family: 'Written' },
  { type: 'Article', pluginId: 'media-articles', label: 'Articles', family: 'Written' },
  { type: 'Comic & graphic novel', pluginId: 'media-comics-graphic-novels', label: 'Comics & graphic novels', family: 'Written' },
  { type: 'Manga', pluginId: 'media-manga', label: 'Manga', family: 'Written' },
  { type: 'Magazine & zine', pluginId: 'media-magazines-zines', label: 'Magazines & zines', family: 'Written' },
  { type: 'Poetry', pluginId: 'media-poetry', label: 'Poetry', family: 'Written' },
  { type: 'Photograph', pluginId: 'media-photography', label: 'Photography', family: 'Seen' },
  { type: 'Artwork', pluginId: 'media-visual-art', label: 'Painting & visual art', family: 'Seen' },
  { type: 'Graphic design', pluginId: 'media-graphic-design', label: 'Graphic design & posters', family: 'Seen' },
  { type: 'Architecture', pluginId: 'media-architecture', label: 'Architecture', family: 'Seen' },
  { type: 'Product design', pluginId: 'media-product-design', label: 'Industrial & product design', family: 'Seen' },
  { type: 'Illustration', pluginId: 'media-illustration', label: 'Illustration', family: 'Seen' },
  { type: 'Movie', pluginId: 'media-movies', label: 'Movies', family: 'Watched' },
  { type: 'TV series', pluginId: 'media-tv-series', label: 'TV series', family: 'Watched' },
  { type: 'Documentary', pluginId: 'media-documentaries', label: 'Documentaries', family: 'Watched' },
  { type: 'Short film', pluginId: 'media-short-films', label: 'Short films', family: 'Watched' },
  { type: 'Animation', pluginId: 'media-animation', label: 'Animation', family: 'Watched' },
  { type: 'Music video', pluginId: 'media-music-videos', label: 'Music videos', family: 'Watched' },
  { type: 'Experimental film', pluginId: 'media-experimental-film', label: 'Experimental film & video art', family: 'Watched' },
  { type: 'YouTube video', pluginId: 'media-youtube-videos', label: 'YouTube videos', family: 'Watched' },
  { type: 'Web series', pluginId: 'media-web-series', label: 'Web series', family: 'Watched' },
  { type: 'Commercial & title sequence', pluginId: 'media-commercials-titles', label: 'Commercials & title sequences', family: 'Watched' },
  { type: 'Course', pluginId: 'media-courses', label: 'Courses', family: 'Watched' },
  { type: 'Audiobook', pluginId: 'media-audiobooks', label: 'Audiobooks', family: 'Listened' },
  { type: 'Album', pluginId: 'media-albums', label: 'Albums', family: 'Listened' },
  { type: 'Song', pluginId: 'media-songs', label: 'Songs', family: 'Listened' },
  { type: 'Podcast', pluginId: 'media-podcasts', label: 'Podcasts', family: 'Listened' },
  { type: 'Radio drama', pluginId: 'media-radio-drama', label: 'Radio drama & audio fiction', family: 'Listened' },
  { type: 'Radio documentary', pluginId: 'media-radio-documentaries', label: 'Radio documentaries & features', family: 'Listened' },
  { type: 'DJ mix', pluginId: 'media-dj-mixes', label: 'DJ mixes & mixtapes', family: 'Listened' },
  { type: 'Live recording', pluginId: 'media-live-recordings', label: 'Live recordings', family: 'Listened' },
  { type: 'Interview', pluginId: 'media-interviews', label: 'Interviews & conversations', family: 'Spoken' },
  { type: 'Speech & lecture', pluginId: 'media-speeches-lectures', label: 'Speeches & lectures', family: 'Spoken' },
  { type: 'Debate', pluginId: 'media-debates', label: 'Debates & dialogues', family: 'Spoken' },
  { type: 'Oral history', pluginId: 'media-oral-histories', label: 'Oral histories', family: 'Spoken' },
  { type: 'Reading', pluginId: 'media-readings', label: 'Readings', family: 'Spoken' },
  { type: 'Video game', pluginId: 'media-video-games', label: 'Video games', family: 'Played' },
  { type: 'Board game', pluginId: 'media-board-games', label: 'Board games', family: 'Played' },
  { type: 'TTRPG', pluginId: 'media-ttrpgs', label: 'TTRPGs', family: 'Played' },
  { type: 'Card game', pluginId: 'media-card-games', label: 'Card games', family: 'Played' },
  { type: 'Puzzle', pluginId: 'media-puzzles', label: 'Puzzles', family: 'Played' },
  { type: 'ARG', pluginId: 'media-args', label: 'ARGs', family: 'Played' },
  { type: 'Theatre', pluginId: 'media-theatre', label: 'Theatre', family: 'Live' },
  { type: 'Musical', pluginId: 'media-musicals', label: 'Musicals', family: 'Live' },
  { type: 'Opera', pluginId: 'media-opera', label: 'Opera', family: 'Live' },
  { type: 'Dance', pluginId: 'media-dance', label: 'Ballet & dance', family: 'Live' },
  { type: 'Concert', pluginId: 'media-concerts', label: 'Concerts', family: 'Live' },
  { type: 'Performance art', pluginId: 'media-performance-art', label: 'Performance art', family: 'Live' },
  { type: 'Circus & physical theatre', pluginId: 'media-circus', label: 'Circus & physical theatre', family: 'Live' },
  { type: 'Magic & illusion', pluginId: 'media-magic', label: 'Magic & illusion', family: 'Live' },
  { type: 'Live performance', pluginId: 'media-live-performances', label: 'Live performances', family: 'Live' },
  { type: 'Stand-up', pluginId: 'media-standup', label: 'Stand-up', family: 'Live' },
] as const;

export const MEDIA_TYPE_PLUGIN_IDS = MEDIA_TYPE_PLUGIN_DEFINITIONS.map((definition) => definition.pluginId);

export const MEDIA_STATUSES = ['Inbox', 'Backlog', 'Active', 'Paused', 'Finished', 'Dropped'] as const;
export type MediaStatus = typeof MEDIA_STATUSES[number];
export type ProgressUnit = 'pages' | 'minutes' | 'episodes' | 'tracks' | 'percent';

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  creator?: string;
  coverUrl?: string;
  currentProgress: number;
  totalProgress: number;
  progressUnit: ProgressUnit;
  rating: number;
  favorite: boolean;
  startedAt?: string;
  finishedAt?: string;
  sourceUrl?: string;
  tags: string[];
  notes?: string;
  projectId?: string;
  areaId?: string;
}

export interface MediaLibraryData {
  version: 2;
  items: MediaItem[];
}

export const emptyMediaLibrary = (): MediaLibraryData => ({ version: 2, items: [] });
export const defaultProgressUnit = (type: MediaType): ProgressUnit => {
  if (['Audiobook', 'Movie', 'YouTube video', 'Animation', 'Stand-up', 'Song', 'Podcast', 'Live performance', 'Documentary', 'Short film', 'Music video', 'Experimental film', 'Commercial & title sequence', 'Radio drama', 'Radio documentary', 'DJ mix', 'Live recording', 'Interview', 'Speech & lecture', 'Debate', 'Oral history', 'Reading', 'Theatre', 'Musical', 'Opera', 'Dance', 'Concert', 'Performance art', 'Circus & physical theatre', 'Magic & illusion'].includes(type)) return 'minutes';
  if (['TV series', 'Web series'].includes(type)) return 'episodes';
  if (type === 'Album') return 'tracks';
  if (['Video game', 'Board game', 'TTRPG', 'Card game', 'Puzzle', 'ARG', 'Course', 'Photograph', 'Artwork', 'Graphic design', 'Architecture', 'Product design', 'Illustration'].includes(type)) return 'percent';
  return 'pages';
};

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number => Math.max(0, Number(value) || 0);
const choice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;

export function parseMediaLibrary(value: unknown): MediaLibraryData {
  const raw = record(value);
  const items = Array.isArray(raw.items) ? raw.items : [];
  return keepUnknown(raw, {
    version: 2,
    items: items.map(record).filter((item) => string(item.id) && string(item.title)).map((item) => {
      const type = choice(item.type, MEDIA_TYPES, 'Book');
      return keepUnknown(item, {
        id: string(item.id),
        title: string(item.title),
        type,
        status: choice(item.status, MEDIA_STATUSES, 'Inbox'),
        creator: string(item.creator) || undefined,
        coverUrl: string(item.coverUrl) || undefined,
        currentProgress: number(item.currentProgress),
        totalProgress: number(item.totalProgress),
        progressUnit: choice(item.progressUnit, ['pages', 'minutes', 'episodes', 'tracks', 'percent'], defaultProgressUnit(type)),
        rating: Math.min(5, number(item.rating)),
        favorite: item.favorite === true,
        startedAt: string(item.startedAt) || undefined,
        finishedAt: string(item.finishedAt) || undefined,
        sourceUrl: string(item.sourceUrl) || undefined,
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        notes: string(item.notes) || undefined,
        projectId: string(item.projectId) || undefined,
        areaId: string(item.areaId) || undefined,
      });
    }),
  });
}

export const newMediaId = (): string => `media-${Math.random().toString(36).slice(2, 10)}`;

export function progressPercent(item: Pick<MediaItem, 'currentProgress' | 'totalProgress'>): number {
  if (item.totalProgress <= 0) return 0;
  return Math.min(100, Math.round((item.currentProgress / item.totalProgress) * 100));
}

export function filterMedia(items: MediaItem[], query: string, type: MediaType | 'All', status: MediaStatus | 'All'): MediaItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery = !needle || item.title.toLowerCase().includes(needle) || item.creator?.toLowerCase().includes(needle) || item.tags.some((tag) => tag.toLowerCase().includes(needle));
    return matchesQuery && (type === 'All' || item.type === type) && (status === 'All' || item.status === status);
  });
}

/** Items carrying every selected tag (tags compare case-insensitively). */
export function filterByTags(items: MediaItem[], selected: readonly string[]): MediaItem[] {
  if (selected.length === 0) return items;
  const wanted = selected.map((tag) => tag.toLowerCase());
  return items.filter((item) => {
    const tags = new Set(item.tags.map((tag) => tag.toLowerCase()));
    return wanted.every((tag) => tags.has(tag));
  });
}

/** Tag facets for a result set: most common first, then alphabetical. */
export function tagCounts(items: MediaItem[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const item of items) {
    for (const tag of new Set(item.tags)) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
