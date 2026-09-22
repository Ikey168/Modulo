import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletterStore } from '../useNewsletterStore';
import type { Newsletter } from '../model';
const mock = vi.hoisted(() => ({ entries: new Map<string, any>(), watchers: new Set<() => void>(), writes: [] as string[], closed: false }));
const client = {
  get status() { return mock.closed ? 'closed' : 'idle'; }, error: undefined,
  list: () => [...mock.entries.values()], conflicts: () => [],
  watch: (fn: () => void) => { mock.watchers.add(fn); return () => mock.watchers.delete(fn); },
  refreshAll: async () => {}, synchronize: async () => {},
  set: async (key: string, value: unknown, schemaId: string, schemaVersion: number) => { mock.writes.push(key); mock.entries.set(key, { key, value, schemaId, schemaVersion }); for (const fn of mock.watchers) fn(); },
  delete: async (key: string) => { mock.entries.delete(key); for (const fn of mock.watchers) fn(); },
};
vi.mock('../../plugins/PluginProvider', () => ({ usePlugins: () => ({ stateSessionKey: 'account-one', isEnabled: () => true, state: async () => client }) }));
vi.mock('../../workspaceTools/shared', async importOriginal => ({ ...await importOriginal<object>(), request: vi.fn().mockResolvedValue({}) }));
const issue = (id: string): Newsletter => ({ id, title: id, sender: '', body: 'A newsletter body', url: '', messageId: id, receivedAt: '2026-09-13', status: 'Unread' });
beforeEach(() => { mock.entries.clear(); mock.watchers.clear(); mock.writes.length = 0; mock.closed = false; });
describe('newsletter record storage', () => {
  it('stores issues separately and updates only the triaged issue', async () => {
    const { result, unmount } = renderHook(() => useNewsletterStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(() => result.current.save({ items: [issue('one'), issue('two')] }));
    expect(mock.writes).toEqual(['issue-one', 'issue-two']); mock.writes.length = 0;
    await act(() => result.current.save(previous => ({ items: previous.items.map(item => item.id === 'one' ? { ...item, status: 'Archived' } : item) })));
    expect(mock.writes).toEqual(['issue-one']); expect(mock.entries.get('issue-two').value.status).toBe('Unread');
    unmount();
    const reopened = renderHook(() => useNewsletterStore());
    await waitFor(() => expect(reopened.result.current.value.items).toHaveLength(2));
    expect(reopened.result.current.value.items.find(item => item.id === 'one')?.status).toBe('Archived'); reopened.unmount();
  });
  it('refuses writes after the account client closes', async () => {
    const { result, unmount } = renderHook(() => useNewsletterStore());
    await waitFor(() => expect(result.current.ready).toBe(true)); mock.closed = true;
    await expect(result.current.save({ items: [issue('one')] })).rejects.toThrow(/synchronization/);
    expect(mock.writes).toEqual([]); unmount();
  });
});
