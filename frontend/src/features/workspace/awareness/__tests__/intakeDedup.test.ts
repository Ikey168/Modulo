import { describe, expect, it } from 'vitest';
import { mergeFeedItems } from '../intakeDedup';
import { groupStories, preferredSignals, type Signal } from '../model';
import type { LifeRecord } from '../../lifeStore';
const item = (id: string, url: string, status = 'Unread'): LifeRecord => ({ id, title: 'Article', status, category: 'Article', recurrence: 'Once', favorite: status === 'Saved', tags: ['keep'], checklist: [], log: [], values: { url, externalId: id, source: 'Feed' } });
const signal: Signal = { id: 'one', title: 'Article', body: 'Evidence', date: '2026-09-01', url: 'https://example.org/story', source: 'Feeds', route: 'feeds-reading-inbox' };
describe('intake duplicate and recommendation loops', () => {
  it('preserves saved and archived records across sync and tracking variants', () => {
    const saved = item('saved', 'https://example.org/story', 'Saved');
    const merged = mergeFeedItems([saved], [item('incoming', 'https://example.org/story?utm_source=email')]);
    expect(merged).toHaveLength(1); expect(merged[0]).toMatchObject({ id: 'saved', status: 'Saved', favorite: true, tags: ['keep'] });
    expect(mergeFeedItems([{ ...saved, status: 'Archived' }], [saved])[0].status).toBe('Archived');
  });
  it('does not merge the same external id from unrelated feeds', () => {
    const a = item('1', 'https://a.test/article'); const b = item('1', 'https://b.test/article'); b.values.source = 'Other';
    expect(mergeFeedItems([a], [b])).toHaveLength(2);
  });
  it('retains review revision when the same story arrives by another channel or at another time', () => {
    expect(groupStories([signal])[0].revision).toBe(groupStories([signal, { ...signal, id: 'two', source: 'Newsletters', date: '2026-09-21' }])[0].revision);
    expect(groupStories([signal])[0].revision).not.toBe(groupStories([{ ...signal, body: 'Changed evidence' }])[0].revision);
  });
  it('does not collapse unrelated same-title articles without URLs', () => {
    expect(groupStories([{ ...signal, url: '' }, { ...signal, id: 'two', url: '', body: 'Different evidence' }])).toHaveLength(2);
  });
  it('uses publisher delivery preferences without hiding other publishers', () => {
    expect(preferredSignals([signal, { ...signal, id: 'two', source: 'Newsletters' }, { ...signal, id: 'three', url: 'https://other.org/story', source: 'Newsletters' }], { 'example.org': 'Feeds' }).map(s => s.id)).toEqual(['one', 'three']);
  });
});
