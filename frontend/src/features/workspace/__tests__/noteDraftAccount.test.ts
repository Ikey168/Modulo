import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDeviceDocuments, type DeviceDocuments } from '../../../services/deviceDocuments';
const auth = vi.hoisted(() => ({ subject: 'alice' }));
vi.mock('../../auth/authService', () => ({ authService: { stateSession: () => ({ issuer: 'issuer', subject: auth.subject }) } }));
import { getNoteDraft, noteDraftKey, flushNoteDrafts } from '../noteDrafts';

const values = new Map<string, unknown>();
const documents: DeviceDocuments = {
  get: async <T,>(key: string) => values.get(key) as T | undefined,
  set: async (key, value) => { values.set(key, value); },
  remove: async key => { values.delete(key); },
  removeIfEqual: async (key, expected) => {
    if (JSON.stringify(values.get(key)) !== JSON.stringify(expected)) return false;
    values.delete(key); return true;
  },
};
beforeEach(() => { values.clear(); setDeviceDocuments(documents); auth.subject = 'alice'; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); setDeviceDocuments(undefined); });
describe('account-scoped editor drafts', () => {
  it('does not replay another account’s pending draft or expose its recovered text', async () => {
    const note = { id: 45, title: 'Title', content: 'Original', tags: [] };
    const save = vi.fn(async () => true);
    const alice = getNoteDraft(note, save); alice.change({ content: 'Private Alice draft' }); const aliceKey = noteDraftKey(45);
    auth.subject = 'bob';
    const bob = getNoteDraft(note, vi.fn());
    await bob.loaded;
    expect(bob.snapshot.content).toBe('Original');
    await vi.advanceTimersByTimeAsync(1000); await flushNoteDrafts();
    expect(save).not.toHaveBeenCalled(); expect(values.get(aliceKey)).toMatchObject({ content: 'Private Alice draft' });
    expect(noteDraftKey(45)).not.toBe(aliceKey);
  });
});
