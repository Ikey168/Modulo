import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginStateClient, type StateRecord, type StateTransport } from '../../../../services/pluginStateClient';
import { useToolStore } from '../shared';

const host = vi.hoisted(() => ({ state: vi.fn(), stateSessionKey: 'first-account', isEnabled: () => true }));
vi.mock('../../plugins/PluginProvider', () => ({ usePlugins: () => host }));
vi.mock('../../../../services/authenticatedRequest', () => ({ authenticatedRequest: async () => new Response(null, { status: 204 }) }));
const initial = { count: 0 };
function validate(value: unknown) {
  if (!value || typeof value !== 'object' || !Number.isSafeInteger((value as typeof initial).count)) throw new Error('Invalid count');
  return value as typeof initial;
}
function record(data: unknown, deleted = false): StateRecord {
  return { key: 'records', schemaId: 'workspace-tool', schemaVersion: 1, version: 1, value: { version: 1, data } as StateRecord['value'], deleted, createdAt: '', updatedAt: '' };
}
async function client(value?: StateRecord) {
  let remote = value;
  const transport: StateTransport = { list: async () => ({ records: remote ? [remote] : [] }), get: async () => remote,
    put: async (key, body) => remote = { ...record(null), key, ...body, version: body.expectedVersion + 1 }, delete: vi.fn() };
  const state = await PluginStateClient.open({ origin: 'https://modulo.test', issuer: 'issuer', subject: host.stateSessionKey, workspace: 'personal', namespace: 'test', replica: 'tab' }, { load: async () => null, save: async () => {} }, transport, { autoRetry: false });
  return { state, remote: (next?: StateRecord) => { remote = next; } };
}
beforeEach(() => { host.stateSessionKey = 'first-account'; host.state.mockReset(); });
describe('workspace tool account state', () => {
  it('serializes edits against the latest saved value and can await server progress', async () => {
    const { state } = await client(); host.state.mockResolvedValue(state);
    const { result, unmount } = renderHook(() => useToolStore('test', initial, validate));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await Promise.all([result.current.save(old => ({ count: old.count + 1 })), result.current.save(old => ({ count: old.count + 1 }), true)]); });
    expect(result.current.value.count).toBe(2); expect(state.get('records')?.pending).toBe(false); unmount(); state.close();
  });
  it('does not overwrite an invalid server record', async () => {
    const { state } = await client(record({ count: 'broken' })); host.state.mockResolvedValue(state);
    const { result, unmount } = renderHook(() => useToolStore('test', initial, validate));
    await waitFor(() => expect(result.current.error).toContain('Invalid count'));
    expect(result.current.ready).toBe(false);
    await expect(result.current.save({ count: 3 })).rejects.toThrow('Resolve synchronization');
    expect(state.get('records')?.pending).toBe(false); unmount(); state.close();
  });
  it('clears the view when a record is deleted remotely', async () => {
    const connection = await client(record({ count: 8 })); host.state.mockResolvedValue(connection.state);
    const { result, unmount } = renderHook(() => useToolStore('test', initial, validate));
    await waitFor(() => expect(result.current.value.count).toBe(8));
    connection.remote(record(null, true)); await act(() => connection.state.refreshAll());
    expect(result.current.value).toEqual(initial); unmount(); connection.state.close();
  });
  it('recovers from invalid state after the server record is repaired', async () => {
    const connection = await client(record({ count: null })); host.state.mockResolvedValue(connection.state);
    const { result, unmount } = renderHook(() => useToolStore('test', initial, validate));
    await waitFor(() => expect(result.current.error).toContain('Invalid count'));
    connection.remote({ ...record({ count: 4 }), version: 2 }); await act(() => connection.state.refreshAll());
    await waitFor(() => expect(result.current.ready).toBe(true)); expect(result.current.value.count).toBe(4); unmount(); connection.state.close();
  });
  it('rejects an edit queued by a previous account', async () => {
    const first = await client(record({ count: 5 })); host.state.mockResolvedValue(first.state);
    const { result, rerender, unmount } = renderHook(() => useToolStore('test', initial, validate));
    await waitFor(() => expect(result.current.ready).toBe(true)); const oldSave = result.current.save;
    host.stateSessionKey = 'second-account'; const second = await client(record({ count: 9 })); host.state.mockResolvedValue(second.state); first.state.close(); rerender();
    await waitFor(() => expect(result.current.value.count).toBe(9));
    await expect(oldSave({ count: 99 })).rejects.toThrow('Resolve synchronization');
    expect(result.current.value.count).toBe(9); unmount(); second.state.close();
  });
});
