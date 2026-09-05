import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PluginStateClient, type StateRecord } from '../../../services/pluginStateClient';
import { TODO_COLLECTION, TIME_COLLECTION, EXPENSE_COLLECTION } from '../operationalSchemas';
import { useOperationalCollection } from '../useOperationalCollection';
const { api } = vi.hoisted(() => ({ api: { stateSessionKey: 'alice', isEnabled: () => true, state: vi.fn() } }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => api }));
const opened: PluginStateClient[] = [];
afterEach(() => { opened.forEach(client => client.close()); opened.length = 0; localStorage.clear(); });
async function client(subject: string, namespace: string) {
  const records = new Map<string, StateRecord>();
  const value = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject, workspace: 'personal', namespace, replica: 'tab' },
    { load: async () => null, save: async () => {} }, {
      list: async () => ({ records: [...records.values()] }), get: async key => records.get(key),
      put: async (key, request) => { const record = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion, value: request.value,
        version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' }; records.set(key, record); return record; },
      delete: async () => { throw new Error('unused'); },
    }, { autoRetry: false }); opened.push(value); return value;
}
const cases = [
  [TODO_COLLECTION, { id: 'todo', title: 'Private task', priority: 'HIGH', done: false, list: 'Inbox' }],
  [TIME_COLLECTION, { id: 'time', date: '2026-09-05', engagement: 'Private', description: 'Work', minutes: 60, rateEur: 100, billable: true, billed: false }],
  [EXPENSE_COLLECTION, { id: 'expense', date: '2026-09-05', vendor: 'Private', description: 'Tools', netEur: 100, vatRate: 19, category: 'IT' }],
] as const;
for (const [definition, sample] of cases) {
  it(`clears ${definition.namespace} on account switch and never silently claims browser data`, async () => {
    const alice = await client('alice', definition.namespace); const bob = await client('bob', definition.namespace);
    await alice.set(`record.${sample.id}`, sample, definition.schemaId, 1);
    localStorage.setItem(definition.legacyKey, JSON.stringify([sample]));
    api.stateSessionKey = 'alice'; api.state.mockResolvedValue(alice);
    const hook = renderHook(() => useOperationalCollection(definition as typeof TODO_COLLECTION));
    await waitFor(() => expect(hook.result.current.value).toHaveLength(1));
    act(() => { alice.close(); api.stateSessionKey = 'bob'; api.state.mockResolvedValue(bob); hook.rerender(); });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.value).toEqual([]);
    expect(bob.list()).toEqual([]); expect(localStorage.getItem(definition.legacyKey)).not.toBeNull();
    hook.unmount();
  });
}
