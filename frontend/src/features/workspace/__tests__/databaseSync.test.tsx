import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, addRow, updateCell, renameColumn, useDatabase } from '../database';
import { DATABASE_LEGACY_KEY, DATABASE_SCHEMA, importLegacyDatabases, validateDatabase } from '../databaseSync';
import { PluginStateClient, StateRequestError, type StateJson, type StateRecord, type StateTransport } from '../../../services/pluginStateClient';
const api = vi.hoisted(() => ({ state: vi.fn(), stateSessionKey: 'alice', isEnabled: () => true }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => api }));
async function setup() {
  const records = new Map<string, StateRecord>();
  const transport: StateTransport = {
    get: async key => records.get(key), list: async () => ({ records: [...records.values()].filter(record => !record.deleted) }),
    put: async (key, request) => {
      const previous = records.get(key);
      if ((previous?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'conflict', previous);
      const record = { key, ...request, version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record); return record;
    }, delete: async () => { throw new Error('unused'); },
  };
  const open = () => PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice', workspace: 'personal',
    namespace: 'notion-database', replica: crypto.randomUUID() }, { load: async () => null, save: async () => {} }, transport, { autoRetry: false });
  return { records, client: await open(), open };
}
const json = (value: unknown): StateJson => JSON.parse(JSON.stringify(value));
const example = () => updateCell(addRow(createDatabase('research', 'Research')), 'r1', 'c1', 'Paper');
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); });
describe('synchronized embedded databases', () => {
  it('migrates rows, typed columns and select options once and survives an empty cache', async () => {
    const { client, open, records } = await setup(); const db = { ...example(), view: 'board' };
    localStorage.setItem(DATABASE_LEGACY_KEY, JSON.stringify({ research: db }));
    await importLegacyDatabases(client, localStorage); expect(localStorage.getItem(DATABASE_LEGACY_KEY)).toBeNull();
    await importLegacyDatabases(client, localStorage); expect(records.get('database.research')?.version).toBe(1);
    const fresh = await open(); await fresh.refreshAll(); expect(fresh.get('database.research')?.value).toEqual(db);
  });
  it('preserves browser bytes if the server differs or rows are malformed', async () => {
    const { client } = await setup(); await client.set('database.research', json(example()), DATABASE_SCHEMA, 1); await client.synchronize();
    const legacy = JSON.stringify({ research: { ...example(), title: 'Changed' } }); localStorage.setItem(DATABASE_LEGACY_KEY, legacy);
    await expect(importLegacyDatabases(client, localStorage)).rejects.toThrow('differs'); expect(localStorage.getItem(DATABASE_LEGACY_KEY)).toBe(legacy);
    expect(() => validateDatabase({ ...example(), rows: [{ id: 'r1', cells: { unknown: 'lost' } }] })).toThrow('rows');
  });
  it('preserves concurrent cell and column edits for explicit conflict resolution', async () => {
    const { client: first, open } = await setup(); await first.set('database.research', json(example()), DATABASE_SCHEMA, 1); await first.synchronize();
    const second = await open(); await second.refreshAll();
    await first.set('database.research', json(updateCell(example(), 'r1', 'c1', 'Local cell')), DATABASE_SCHEMA, 1);
    await second.set('database.research', json(renameColumn(example(), 'c1', 'Remote column')), DATABASE_SCHEMA, 1);
    await second.synchronize(); await first.synchronize();
    expect(first.get('database.research')?.conflict).toBeDefined();
    expect(first.get('database.research')?.value).toEqual(updateCell(example(), 'r1', 'c1', 'Local cell'));
    await first.resolve('database.research', 'remote');
    expect(first.get('database.research')?.value).toEqual(renameColumn(example(), 'c1', 'Remote column'));
  });
  it('retains a database when its fence unmounts and does not copy it into a different fence ID', async () => {
    const { client } = await setup(); api.state.mockResolvedValue(client);
    const hook = renderHook(({ source }) => useDatabase(source), { initialProps: { source: 'id: research\ntitle: Research' } });
    await waitFor(() => expect(hook.result.current.sync.ready).toBe(true));
    act(() => hook.result.current.addRow({ c1: 'Retained' }));
    await waitFor(() => expect(client.get('database.research')?.pending).toBe(true));
    hook.rerender({ source: 'id: separate\ntitle: Separate' });
    await waitFor(() => expect(hook.result.current.db.id).toBe('separate')); expect(hook.result.current.db.rows).toEqual([]);
    hook.unmount(); await client.synchronize(); expect(client.get('database.research')?.value).toMatchObject({ rows: [{ cells: { c1: 'Retained' } }] });
    expect(client.get('database.separate')).toBeUndefined();
  });
});
