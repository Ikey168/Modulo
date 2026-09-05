import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginStateClient, StateRequestError, type StateRecord, type StateTransport } from '../../../../services/pluginStateClient';
import { importLegacyState } from '../../../../services/legacyStateImport';
import { useDurableRecord } from '../useDurableRecord';
import { validateSavedSearches } from '../../savedSearchesStore';
const api = vi.hoisted(() => ({ state: vi.fn(), stateSessionKey: 'alice', isEnabled: () => true }));
vi.mock('../PluginProvider', () => ({ usePlugins: () => api }));
const schema = 'modulo.saved-searches';
const searches = [{ id: 'one', name: 'Research', text: 'paper', tags: ['work'] }];
const jsonSearches = (value: unknown) => JSON.parse(JSON.stringify(validateSavedSearches(value)));
async function setup() {
  const records = new Map<string, StateRecord>();
  const transport: StateTransport = {
    get: async key => records.get(key), list: async () => ({ records: [...records.values()] }),
    put: vi.fn(async (key, request) => {
      const old = records.get(key);
      if ((old?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'conflict', old);
      const record: StateRecord = { key, ...request, version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record); return record;
    }),
    delete: async () => { throw new Error('unused'); },
  };
  const client = await PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice',
    workspace: 'personal', namespace: 'saved-searches', replica: 'one' }, { load: async () => null, save: async () => {} }, transport, { autoRetry: false });
  return { client, transport, records };
}
afterEach(() => { localStorage.clear(); api.stateSessionKey = 'alice'; vi.clearAllMocks(); });
describe('durable settings', () => {
  it('imports a complete query and removes its source only after the marker is durable', async () => {
    const { client, records } = await setup();
    localStorage.setItem('legacy', JSON.stringify(searches));
    await importLegacyState(client, localStorage, 'legacy', 'queries', schema, jsonSearches);
    expect(records.get('queries')?.value).toEqual(searches);
    expect(records.has('migration.queries')).toBe(true); expect(localStorage.getItem('legacy')).toBeNull();
    await importLegacyState(client, localStorage, 'legacy', 'queries', schema, jsonSearches);
    expect(records.get('queries')?.version).toBe(1);
  });
  it('preserves browser data when newer server settings exist or the source is malformed', async () => {
    const { client } = await setup(); await client.set('queries', [], schema, 1); await client.synchronize();
    localStorage.setItem('legacy', JSON.stringify(searches));
    await expect(importLegacyState(client, localStorage, 'legacy', 'queries', schema, jsonSearches)).rejects.toThrow('differ');
    expect(localStorage.getItem('legacy')).not.toBeNull(); expect(client.get('queries')?.value).toEqual([]);
    localStorage.setItem('legacy', '[{"id":"one","name":"Incomplete"}]');
    await expect(importLegacyState(client, localStorage, 'legacy', 'queries', schema, jsonSearches)).rejects.toThrow('Invalid');
    expect(localStorage.getItem('legacy')).not.toBeNull();
  });
  it('retains source data and queued edits when import is offline', async () => {
    const { client, transport } = await setup(); vi.mocked(transport.put).mockRejectedValue(new Error('offline'));
    localStorage.setItem('legacy', JSON.stringify(searches));
    await expect(importLegacyState(client, localStorage, 'legacy', 'queries', schema, jsonSearches)).rejects.toThrow();
    expect(client.get('queries')?.value).toEqual(searches); expect(client.get('queries')?.pending).toBe(true);
    expect(localStorage.getItem('legacy')).not.toBeNull();
  });
  it('shows defaults on first launch, saves edits, and clears them on account switching', async () => {
    const alice = await setup(); const bob = await setup(); api.state.mockResolvedValue(alice.client);
    const hook = renderHook(() => useDurableRecord('saved-searches', 'queries', schema, [], validateSavedSearches));
    await waitFor(() => expect(hook.result.current.ready).toBe(true)); expect(hook.result.current.value).toEqual([]);
    act(() => hook.result.current.set(searches));
    await waitFor(() => expect(alice.client.get('queries')?.value).toEqual(searches));
    alice.client.close(); api.stateSessionKey = 'bob'; api.state.mockResolvedValue(bob.client); hook.rerender();
    await waitFor(() => expect(hook.result.current.ready).toBe(true)); expect(hook.result.current.value).toEqual([]);
    hook.unmount();
  });
  it('loads cached records offline and refuses unknown schemas without discarding their bytes', async () => {
    const { client } = await setup(); await client.set('queries', searches, schema, 2); api.state.mockResolvedValue(client);
    const hook = renderHook(() => useDurableRecord('saved-searches', 'queries', schema, [], validateSavedSearches));
    await waitFor(() => expect(hook.result.current.error).toMatch(/Unsupported/));
    expect(hook.result.current.ready).toBe(false); expect(client.recoverySnapshot().entries[0].pending?.schemaVersion).toBe(2);
    hook.unmount();
  });
});
