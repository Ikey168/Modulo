import { beforeEach, describe, expect, it } from 'vitest';
import {
  MEDIA_TYPE_PLUGIN_DEFINITIONS,
  MEDIA_TYPE_PLUGIN_IDS,
  MEDIA_TYPES,
  emptyMediaLibrary,
  filterMedia,
  parseMediaLibrary,
  progressPercent,
  type MediaItem,
} from '../mediaLibrary';

beforeEach(() => localStorage.clear());

const book: MediaItem = {
  id: 'media-1',
  title: 'The Dispossessed',
  type: 'Book',
  status: 'Active',
  creator: 'Ursula K. Le Guin',
  currentProgress: 120,
  totalProgress: 400,
  progressUnit: 'pages',
  rating: 5,
  favorite: true,
  tags: ['fiction', 'politics'],
};

describe('media library store', () => {
  it('supports written, watched, listened, played, learned, and live media', () => {
    expect(MEDIA_TYPES).toEqual(['Book', 'Ebook', 'Short story', 'Novella', 'Essay', 'Article', 'Comic & graphic novel', 'Manga', 'Magazine & zine', 'Poetry', 'Photograph', 'Artwork', 'Graphic design', 'Architecture', 'Product design', 'Illustration', 'Movie', 'TV series', 'Documentary', 'Short film', 'Animation', 'Music video', 'Experimental film', 'YouTube video', 'Web series', 'Commercial & title sequence', 'Course', 'Audiobook', 'Album', 'Song', 'Podcast', 'Radio drama', 'Radio documentary', 'DJ mix', 'Live recording', 'Interview', 'Speech & lecture', 'Debate', 'Oral history', 'Reading', 'Video game', 'Board game', 'TTRPG', 'Card game', 'Puzzle', 'ARG', 'Theatre', 'Musical', 'Opera', 'Dance', 'Concert', 'Performance art', 'Circus & physical theatre', 'Magic & illusion', 'Live performance', 'Stand-up']);
  });

  it('defines one uniquely addressable plugin for every media type', () => {
    expect(MEDIA_TYPE_PLUGIN_DEFINITIONS.map((definition) => definition.type)).toEqual(MEDIA_TYPES);
    expect(MEDIA_TYPE_PLUGIN_IDS).toHaveLength(MEDIA_TYPES.length);
    expect(new Set(MEDIA_TYPE_PLUGIN_IDS).size).toBe(MEDIA_TYPES.length);
  });

  it('parses valid items and applies safe defaults', () => {
    const parsed = parseMediaLibrary({
      items: [{ id: 'm1', title: 'Listen', type: 'Audiobook', status: 'Unknown', rating: 12, currentProgress: -5, coverUrl: 'https://example.com/cover.jpg', tags: 'invalid' }],
    });
    expect(parsed.items[0]).toMatchObject({
      type: 'Audiobook',
      status: 'Inbox',
      rating: 5,
      currentProgress: 0,
      progressUnit: 'minutes',
      coverUrl: 'https://example.com/cover.jpg',
      tags: [],
    });
  });

  it('selects progress units for the expanded media families', () => {
    const items = parseMediaLibrary({ items: [
      { id: 'tv', title: 'Series', type: 'TV series' },
      { id: 'album', title: 'Album', type: 'Album' },
      { id: 'game', title: 'Game', type: 'Video game' },
      { id: 'youtube', title: 'Video', type: 'YouTube video' },
    ] }).items;
    expect(items.map((item) => item.progressUnit)).toEqual(['episodes', 'tracks', 'percent', 'minutes']);
  });

  it('calculates bounded progress and filters across metadata', () => {
    expect(progressPercent(book)).toBe(30);
    expect(progressPercent({ currentProgress: 500, totalProgress: 400 })).toBe(100);
    expect(filterMedia([book], 'le guin', 'All', 'Active')).toEqual([book]);
    expect(filterMedia([book], 'fiction', 'Book', 'All')).toEqual([book]);
    expect(filterMedia([book], '', 'Article', 'All')).toEqual([]);
  });

  it('round-trips through server JSON and recovers from corruption', () => {
    expect(parseMediaLibrary(JSON.parse(JSON.stringify({ version: 2, items: [book] }))).items[0]).toEqual(book);
    expect(parseMediaLibrary('{broken')).toEqual(emptyMediaLibrary());
  });

  it('loads existing v1 libraries into the expanded schema', () => {
    expect(parseMediaLibrary({ version: 1, items: [book] }).items[0]).toEqual(book);
  });
});

describe('media library forward compatibility', () => {
  it('keeps item fields this version does not recognise', () => {
    const parsed = parseMediaLibrary({ version: 2, extra: 1, items: [{ id: 'm1', title: 'Dune', type: 'Book', isbn: '978-0441013593' }] });
    expect(parsed.items[0]).toMatchObject({ title: 'Dune', isbn: '978-0441013593' });
    expect((parsed as typeof parsed & { extra?: number }).extra).toBe(1);
  });
});
