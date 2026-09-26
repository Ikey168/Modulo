import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ subject: 'alice' }));
vi.mock('../../auth/authService', () => ({ authService: { stateSession: () => ({ issuer: 'issuer', subject: auth.subject }) } }));
import { getNoteDraft, noteDraftKey, flushNoteDrafts } from '../noteDrafts';
beforeEach(() => { localStorage.clear(); auth.subject = 'alice'; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());
describe('account-scoped editor drafts', () => {
  it('does not replay another account’s pending draft or expose its recovered text', async () => {
    const note = { id: 45, title: 'Title', content: 'Original', tags: [] };
    const save = vi.fn(async () => true);
    const alice = getNoteDraft(note, save); alice.change({ content: 'Private Alice draft' }); const aliceKey = noteDraftKey(45);
    auth.subject = 'bob';
    expect(getNoteDraft(note, vi.fn()).snapshot.content).toBe('Original');
    await vi.advanceTimersByTimeAsync(1000); await flushNoteDrafts();
    expect(save).not.toHaveBeenCalled(); expect(localStorage.getItem(aliceKey)).toContain('Private Alice draft');
    expect(noteDraftKey(45)).not.toBe(aliceKey);
  });
});
