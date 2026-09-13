import { webcrypto } from 'node:crypto';
import { beforeAll, expect, it, vi } from 'vitest';
import type { StateJson, StateView } from '../../../../../services/pluginStateClient';
import { importLegacyIntake, planLegacyIntakeMigration, undoLegacyIntake } from '../legacyIntakeMigration';

beforeAll(() => vi.stubGlobal('crypto', webcrypto));

function stateFixture() {
  const records = new Map<string, StateView>();
  return {
    records,
    get: (key: string) => records.get(key),
    create: vi.fn(async (key: string, value: StateJson, schemaId: string, schemaVersion: number) => {
      if (records.has(key)) throw new Error('Duplicate state key');
      records.set(key, { key, value, schemaId, schemaVersion, deleted: false, pending: true });
    }),
    set: vi.fn(async (key: string, value: StateJson, schemaId: string, schemaVersion: number) => {
      records.set(key, { key, value, schemaId, schemaVersion, deleted: false, pending: true });
    }),
    delete: vi.fn(async (key: string) => {
      const record = records.get(key);
      if (record) records.set(key, { ...record, value: null, deleted: true, pending: true });
    }),
    synchronize: vi.fn(async () => {
      for (const record of records.values()) record.pending = false;
    }),
  };
}

it('previews and imports exact Modulo records with a resumable report', async () => {
  const client = stateFixture();
  const source = {
    version: 1,
    items: [
      { id: 'item-1', title: 'First', url: 'https://example.org/a', customNote: 'Keep verbatim' },
      { id: 'item-2', title: 'Second', url: 'https://example.org/a', projectId: 'project-1' },
    ],
    sessions: [{ id: 'session-1', itemId: 'item-1', mode: 'Awareness', date: '2026-09-13' }],
    projects: [{ id: 'project-1', title: 'Research', noteIds: [17] }],
  };
  const raw = JSON.stringify(source);
  const plan = await planLegacyIntakeMigration(raw, client);
  expect(plan.status).toBe('ready');
  expect(plan.counts.items).toBe(2);
  expect(plan.toCreate).toBe(4);
  expect(plan.warnings).toEqual([expect.stringContaining('share URL')]);
  expect(client.create).not.toHaveBeenCalled();
  const result = await importLegacyIntake(plan, client);
  expect(result).toMatchObject({ staged: 4, confirmed: 4, pending: 0, conflicts: 0 });
  expect(client.get(result.reportKey)?.schemaId).toBe('modulo.intake.import-report');
  expect(client.records.get(plan.records[0].key)?.value).toMatchObject({
    legacyId: 'item-1', payload: { customNote: 'Keep verbatim' },
  });
  const replay = await planLegacyIntakeMigration(raw, client);
  expect(replay).toMatchObject({ status: 'ready', toCreate: 0, alreadyPresent: 4, reportExists: true });
  expect((await importLegacyIntake(replay, client)).staged).toBe(0);
  expect(client.create).toHaveBeenCalledTimes(5);
  expect(await undoLegacyIntake(replay, client)).toEqual({ pending: 0, conflicts: 0 });
  expect(client.delete).toHaveBeenCalledTimes(5);
  const restored = await planLegacyIntakeMigration(raw, client);
  expect(restored).toMatchObject({ status: 'ready', toCreate: 4, reportExists: false });
  expect((await importLegacyIntake(restored, client)).staged).toBe(4);
  expect(client.set).toHaveBeenCalledTimes(5);
  expect(raw).toBe(JSON.stringify(source));
});

it('refuses undo if an imported record has been edited', async () => {
  const client = stateFixture();
  const raw = JSON.stringify({ version: 1, items: [{ id: 'one', title: 'Original' }] });
  const plan = await planLegacyIntakeMigration(raw, client);
  await importLegacyIntake(plan, client);
  const record = client.records.get(plan.records[0].key)!;
  client.records.set(record.key, { ...record,
    value: { ...(record.value as Record<string, StateJson>), payload: { id: 'one', title: 'Edited' } },
  });
  const preview = await planLegacyIntakeMigration(raw, client);
  expect(preview.status).toBe('blocked');
  await expect(undoLegacyIntake(preview, client)).rejects.toThrow();
  expect(client.delete).not.toHaveBeenCalled();
});

it('blocks changed remote records and unknown local fields before writing', async () => {
  const client = stateFixture();
  const raw = JSON.stringify({ version: 1, items: [{ id: 'one', title: 'Original' }] });
  const first = await planLegacyIntakeMigration(raw, client);
  client.records.set(first.records[0].key, {
    key: first.records[0].key, deleted: false, pending: false,
    value: { ...first.records[0].value, sourceDigest: 'changed' },
  });
  const conflict = await planLegacyIntakeMigration(raw, client);
  expect(conflict.status).toBe('blocked');
  expect(conflict.blockers).toEqual([expect.stringContaining('differs from plugin state')]);
  await expect(importLegacyIntake(conflict, client)).rejects.toThrow('Preflight');
  const unknown = await planLegacyIntakeMigration(
    JSON.stringify({ version: 1, items: [], unknownCollection: [{ id: 'hidden' }] }), client);
  expect(unknown.status).toBe('blocked');
  expect(client.create).not.toHaveBeenCalled();
});
