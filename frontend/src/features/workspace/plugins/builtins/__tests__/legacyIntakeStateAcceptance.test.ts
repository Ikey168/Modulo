import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { PluginStateClient, StateRequestError,
  type StateRecord, type StateTransport } from '../../../../../services/pluginStateClient';
import { BrowserStatePersistence } from '../../../../../services/pluginStateTransport';
import { importLegacyIntake, planLegacyIntakeMigration } from '../legacyIntakeMigration';

beforeAll(() => vi.stubGlobal('crypto', webcrypto));
const clients: PluginStateClient[] = [];
afterEach(() => { clients.forEach(client => client.close()); clients.length = 0; localStorage.clear(); });

it('replays a queued Research Workflow migration after restart and discovers it on a second device', async () => {
  const records = new Map<string, StateRecord>();
  const generation = '00000000-0000-0000-0000-000000000001';
  let online = false;
  const transport = (): StateTransport => {
    let pinned: string | undefined;
    const available = () => { if (!online) throw new TypeError('offline'); };
    return {
      generation: async () => { available(); return generation; },
      useGeneration: value => { pinned = value; },
      get: async key => { available(); return records.get(key); },
      list: async () => { available(); return { records: [...records.values()] }; },
      put: async (key, request) => {
        available();
        if (pinned !== generation) throw new StateRequestError(412, 'generation_changed');
        const prior = records.get(key);
        if ((prior?.version ?? 0) !== request.expectedVersion)
          throw new StateRequestError(409, 'conflict', prior);
        const record: StateRecord = { key, schemaId: request.schemaId,
          schemaVersion: request.schemaVersion, value: request.value,
          version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
        records.set(key, record);
        return record;
      },
      delete: async () => { throw new Error('Unexpected deletion'); },
    };
  };
  const open = async (replica: string, storage: Storage) => {
    const client = await PluginStateClient.open({ origin: 'https://modulo.example',
      issuer: 'https://identity.example', subject: 'researcher', workspace: 'personal',
      namespace: 'information-intake', replica }, new BrowserStatePersistence(storage),
    transport(), { autoRetry: false });
    clients.push(client);
    return client;
  };
  const raw = JSON.stringify({ version: 1,
    items: [{ id: 'item-1', title: 'Saved source', url: 'https://example.org/a',
      userNote: 'Keep this exact note', createdAt: '2026-09-01T10:00:00Z' }],
    projects: [{ id: 'project-1', title: 'Topic', noteIds: [42], sourceIds: ['item-1'] }],
    transitions: [{ id: 'transition-1', itemId: 'item-1', projectId: 'project-1',
      fromMode: 'Exploration', toMode: 'Deep Research', reason: 'Investigate further' }],
  });
  const firstStorage = localStorage;
  let first = await open('device-one', firstStorage);
  const plan = await planLegacyIntakeMigration(raw, first);
  expect(plan).toMatchObject({ status: 'ready', toCreate: 3 });
  const queued = await importLegacyIntake(plan, first);
  expect(queued).toMatchObject({ staged: 3, confirmed: 0, pending: 3, reportPending: true });
  expect(records.size).toBe(0);
  first.close();

  online = true;
  first = await open('device-one', firstStorage);
  await first.synchronize();
  expect(first.status).toBe('idle');
  expect(records.size).toBe(4);
  const replay = await planLegacyIntakeMigration(raw, first);
  expect(replay).toMatchObject({ status: 'ready', toCreate: 0,
    alreadyPresent: 3, reportExists: true });
  expect((await importLegacyIntake(replay, first)).staged).toBe(0);
  expect(records.size).toBe(4);

  const secondValues = new Map<string, string>();
  const secondStorage = {
    getItem: (key: string) => secondValues.get(key) ?? null,
    setItem: (key: string, value: string) => { secondValues.set(key, value); },
  } as Storage;
  const second = await open('device-two', secondStorage);
  await second.refreshAll();
  const secondPlan = await planLegacyIntakeMigration(raw, second);
  expect(secondPlan).toMatchObject({ status: 'ready', toCreate: 0,
    alreadyPresent: 3, reportExists: true });
  const item = second.get(secondPlan.records.find(record => record.value.collection === 'items')!.key);
  expect(item?.value).toMatchObject({ legacyId: 'item-1',
    payload: { userNote: 'Keep this exact note', createdAt: '2026-09-01T10:00:00Z' } });
  expect(secondPlan.records.find(record => record.value.collection === 'transitions')?.value.payload)
    .toMatchObject({ itemId: 'item-1', projectId: 'project-1', reason: 'Investigate further' });
});
