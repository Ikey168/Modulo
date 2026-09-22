import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bookmarkToMedia,
  citationAsBibtex,
  formatCitation,
  parseCitationImport,
  promoteAnnotationToFlashcard,
  saveMetadataToMedia,
  scheduleFlashcard,
  searchMetadata,
} from '../foundationActions';
import { emptyMediaLibrary } from '../mediaLibrary';
import type { LifeRecord } from '../lifeStore';

const record = (update: Partial<LifeRecord> = {}): LifeRecord => ({
  id: 'record-1', title: 'Systems Thinking', status: 'New', category: 'Concept', recurrence: 'Once',
  favorite: false, tags: [], values: {}, checklist: [], log: [], ...update,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('foundation tool actions', () => {
  it('queries Open Library and normalizes provider results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [{ key: '/works/OL1W', title: 'The Dispossessed', author_name: ['Ursula K. Le Guin'], first_publish_year: 1974, cover_i: 123 }] }) }));
    const results = await searchMetadata('Open Library', 'The Dispossessed');
    expect(results).toEqual([expect.objectContaining({ title: 'The Dispossessed', creator: 'Ursula K. Le Guin', type: 'Book', artworkUrl: 'https://covers.openlibrary.org/b/id/123-M.jpg' })]);
  });

  it('adds and updates normalized metadata in the shared Media Library', () => {
    const first = saveMetadataToMedia({ provider: 'TMDB', externalId: '1', title: 'Arrival', type: 'Movie', creator: 'Denis Villeneuve', artworkUrl: 'https://img.test/poster.jpg' }, emptyMediaLibrary());
    expect(first.data.items[0]).toEqual(expect.objectContaining({ id: first.item.id, title: 'Arrival', type: 'Movie', coverUrl: 'https://img.test/poster.jpg' }));
    const second = saveMetadataToMedia({ provider: 'TMDB', externalId: '1', title: 'Arrival (2016)', type: 'Movie' }, first.data, first.item.id);
    expect(second.data.items).toHaveLength(1);
    expect(second.data.items[0].title).toBe('Arrival (2016)');
    expect(second.data.items[0].coverUrl).toBe('https://img.test/poster.jpg');
  });

  it('schedules flashcards using the four review grades', () => {
    const card = record({ values: { intervalDays: '3', stability: '3', difficulty: '5', reps: '2', lapses: '0' } });
    expect(scheduleFlashcard(card, 'Again')).toEqual(expect.objectContaining({ status: 'Learning', values: expect.objectContaining({ intervalDays: '0', lapses: '1', reps: '3' }) }));
    const good = scheduleFlashcard(card, 'Good');
    const easy = scheduleFlashcard(card, 'Easy');
    expect(Number(good.values.stability)).toBeGreaterThan(0);
    expect(Number(easy.values.intervalDays)).toBeGreaterThanOrEqual(Number(good.values.intervalDays));
    let leech = card;
    for (let lapse = 0; lapse < 8; lapse += 1) leech = scheduleFlashcard(leech, 'Again');
    expect(leech).toEqual(expect.objectContaining({ status: 'Suspended', values: expect.objectContaining({ lapses: '8' }) }));
  });

  it('moves a bookmark through Media and an annotation into Flashcards', () => {
    const media = bookmarkToMedia(record({ title: 'Useful essay', category: 'Article', values: { url: 'https://example.test/essay', author: 'A. Writer' } }), emptyMediaLibrary());
    expect(media.data.items.map((item) => item.id)).toContain(media.item.id);
    expect(media.item).toEqual(expect.objectContaining({ type: 'Article', creator: 'A. Writer', sourceUrl: 'https://example.test/essay' }));
    const card = promoteAnnotationToFlashcard(record({ category: 'Quote', values: { excerpt: 'A durable idea', interpretation: 'Why does this matter?' } }));
    expect(card).toEqual(expect.objectContaining({ values: expect.objectContaining({ back: 'A durable idea' }) }));
  });

  it('imports, formats, and exports citation records', () => {
    const parsed = parseCitationImport('@article{key, title={A Study}, author={Doe, Jane and Roe, John}, year={2025}, doi={10.1/test}}');
    expect(parsed).toEqual(expect.objectContaining({ title: 'A Study', year: '2025', doi: '10.1/test' }));
    const citation = record({ title: 'A Study', values: { authors: 'Jane Doe', year: '2025', container: 'Journal', doi: '10.1/test', citationKey: 'doe2025' } });
    expect(formatCitation(citation, 'APA')).toContain('Jane Doe (2025)');
    expect(citationAsBibtex(citation)).toContain('@article{doe2025');
  });
});
