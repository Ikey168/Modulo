import { describe, expect, it } from 'vitest';
import { canonicalUrl, collectSignals, groupStories, matches, mergeNewsletters, safeUrl, validateNewsletters, validateWatchlists, type Newsletter, type Signal, type Watchlist } from '../model';
import { importNewsletter } from '../newsletterImport';
import type { LifeRecord } from '../../lifeStore';
const signal = (overrides: Partial<Signal> = {}): Signal => ({ id: 'one', title: 'A useful article', body: 'Open-source climate research', date: '2026-09-13', url: 'https://example.org/article', route: 'feeds-reading-inbox', source: 'Feeds', ...overrides });
const issue = (overrides: Partial<Newsletter> = {}): Newsletter => ({ id: 'n1', title: 'Issue one', sender: 'editor@example.org', body: 'Climate research', url: '', receivedAt: '2026-09-13', messageId: '<one@example.org>', status: 'Unread', ...overrides });
const watch: Watchlist = { id: 'w1', name: 'Climate', terms: ['climate', 'urban gardening'], exclude: ['sponsored'], areaId: 'area-1', enabled: true };

describe('Awareness intake', () => {
  it('groups tracking variants but preserves meaningful URL parameters', () => {
    expect(canonicalUrl('https://example.org/article?utm_source=email&id=1#top')).toBe('https://example.org/article?id=1');
    expect(groupStories([signal(), signal({ id: 'two', url: 'https://example.org/article?utm_campaign=daily', source: 'Newsletters' })])).toHaveLength(1);
    expect(groupStories([signal({ url: 'https://example.org/?id=1' }), signal({ id: 'two', url: 'https://example.org/?id=2' })])).toHaveLength(2);
  });
  it('resurfaces changed content while keeping reordering stable', () => {
    const original = [signal(), signal({ id: 'two', body: 'Another description' })];
    expect(groupStories(original)[0].revision).toBe(groupStories([...original].reverse())[0].revision);
    expect(groupStories([signal({ body: 'Updated finding' }), original[1]])[0].revision).not.toBe(groupStories(original)[0].revision);
    expect(groupStories([signal({ body: 'x'.repeat(200000) })])[0].revision.length).toBeLessThan(100);
  });
  it('matches literal phrases case-insensitively and respects exclusions and pauses', () => {
    expect(matches(watch, signal())).toBe(true);
    expect(matches(watch, signal({ body: 'SPONSORED climate research' }))).toBe(false);
    expect(matches({ ...watch, enabled: false }, signal())).toBe(false);
    expect(matches({ ...watch, terms: ['[climate]'] }, signal())).toBe(false);
  });
  it('uses only actionable source records', () => {
    const feed = { id: 'f', title: 'Feed', values: { url: 'https://example.org' }, status: 'Unread' } as unknown as LifeRecord;
    const web = { ...feed, id: 'w', status: 'Changed' };
    const signals = collectSignals([feed, { ...feed, id: 'archived', status: 'Archived' }], [web, { ...web, id: 'active', status: 'Active' }], [issue(), issue({ id: 'old', status: 'Archived' })]);
    expect(signals.map(item => item.source)).toEqual(['Feeds', 'Web Watch', 'Newsletters']);
  });
  it('deduplicates imported message IDs without resetting triage status', () => {
    const current = issue({ status: 'Archived' });
    expect(mergeNewsletters([current], [issue({ id: 'n2' })])).toEqual([current]);
    expect(mergeNewsletters([issue({ messageId: '' })], [issue({ id: 'n2', messageId: '' })])).toHaveLength(1);
  });
  it('rejects executable links and malformed persisted data', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('https://user:password@example.org/')).toBe('');
    expect(() => validateNewsletters({ items: [issue({ url: 'javascript:alert(1)' })] })).toThrow();
    expect(() => validateWatchlists({ items: [{ ...watch, terms: [] }] })).toThrow();
    expect(() => validateWatchlists({ items: [watch, watch] })).toThrow();
  });
  it('parses MIME encodings and preserves message identity', async () => {
    const message = await importNewsletter('From: Editor <editor@example.org>\r\nSubject: =?UTF-8?Q?Climate_=E2=9C=93?=\r\nMessage-ID: <issue-1@example.org>\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\nQ2xpbWF0ZSB1cGRhdGU=');
    expect(message).toMatchObject({ title: 'Climate ✓', sender: 'editor@example.org', body: 'Climate update', messageId: '<issue-1@example.org>', status: 'Unread' });
  });
  it('converts HTML-only email to readable text without active content', async () => {
    const message = await importNewsletter('Subject: HTML issue\nContent-Type: text/html; charset=utf-8\n\n<p>Hello reader</p><script>alert(1)</script><img src="https://tracking.invalid/pixel"><a href="javascript:alert(2)">Unsafe</a><a href="https://example.org/story">Read</a>');
    expect(message.body).toContain('Hello reader'); expect(message.body).toContain('https://example.org/story');
    expect(message.body).not.toContain('alert('); expect(message.body).not.toContain('<img');
  });
});
