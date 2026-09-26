import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  PluginStateClient, StateRequestError,
  type StateJson, type StatePersistence, type StateRecord, type StateTransport,
} from '../../services/pluginStateClient';
import { IndexedDbStatePersistence } from '../../services/pluginStateTransport';
import { AndroidStatePersistence } from '../../services/androidStatePersistence';
import type { NativeStateCacheBridge } from '../../services/nativeStateCacheBridge';
import { LEGACY_KEY_REGISTRY } from '../../services/legacy/legacyKeyRegistry';
import { exportWorkspaceState, parseWorkspaceBackup, restoreWorkspaceState } from '../../features/workspace/fullBackup';

/**
 * Cross-device synchronization acceptance (#496). A desktop client (IndexedDB
 * queue) and an Android client (SQLite queue through the native bridge) share
 * one account on an in-memory server that implements the plugin-state
 * protocol: optimistic versions, tombstones, listings without tombstones and a
 * storage generation. Each journey below is one acceptance criterion.
 */
class StateServer {
  online = true;
  generation = '00000000-0000-4000-8000-000000000001';
  readonly records = new Map<string, StateRecord>();
  writes = 0;

  private guard() {
    if (!this.online) throw new TypeError('Failed to fetch');
  }

  transport(): StateTransport {
    return {
      generation: async () => { this.guard(); return this.generation; },
      list: async () => { this.guard(); return { records: [...this.records.values()].filter(record => !record.deleted), nextCursor: null }; },
      get: async key => { this.guard(); return this.records.get(key); },
      put: async (key, request) => {
        this.guard();
        const current = this.records.get(key);
        if ((current?.version ?? 0) !== request.expectedVersion) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', current);
        const record: StateRecord = { key, schemaId: request.schemaId, schemaVersion: request.schemaVersion, value: request.value,
          version: request.expectedVersion + 1, deleted: false, createdAt: current?.createdAt ?? 't', updatedAt: 't' };
        this.records.set(key, record);
        this.writes += 1;
        return record;
      },
      delete: async (key, expectedVersion) => {
        this.guard();
        const current = this.records.get(key);
        if (!current || current.version !== expectedVersion) throw new StateRequestError(409, 'STATE_VERSION_CONFLICT', current);
        const record: StateRecord = { ...current, value: null, deleted: true, version: current.version + 1 };
        this.records.set(key, record);
        this.writes += 1;
        return record;
      },
    };
  }
}

function sqliteBridge(): Pick<NativeStateCacheBridge, 'load' | 'save'> {
  const rows = new Map<string, string>();
  return { load: async ({ partition }) => ({ snapshot: rows.get(partition) ?? null }), save: async ({ partition, snapshot }) => { rows.set(partition, snapshot); } };
}

const SCHEMA = 'modulo.workspace.para';
const scope = (replica: string, namespace = 'para') => ({ origin: 'https://modulo.example', issuer: 'https://id.example', subject: 'alice',
  workspace: 'personal', namespace, replica });

interface Device { persistence: StatePersistence; replica: string; client?: PluginStateClient }
const open: PluginStateClient[] = [];
async function start(device: Device, server: StateServer): Promise<PluginStateClient> {
  device.client = await PluginStateClient.open(scope(device.replica), device.persistence, server.transport(), { autoRetry: false });
  open.push(device.client);
  await device.client.refreshAll().catch(() => {});
  return device.client;
}
const desktop = (): Device => ({ persistence: new IndexedDbStatePersistence(new IDBFactory()), replica: 'desktop-1' });
const android = (): Device => ({ persistence: new AndroidStatePersistence(sqliteBridge()), replica: 'android-1' });
const value = (client: PluginStateClient, key = 'data') => client.get(key)?.value;
const areas = (checked: Record<string, string[]>): StateJson =>
  ({ areas: Object.entries(checked).map(([id, requirements]) => ({ id, requirements })) });

afterEach(() => { for (const client of open.splice(0)) if (client.status !== 'closed') client.close(); });

describe('cross-device synchronization (#496)', () => {
  it('shows desktop-created data on Android and Android edits on desktop without an export', async () => {
    const server = new StateServer();
    const pc = await start(desktop(), server);
    await pc.set('data', areas({ health: ['sleep', 'walk'] }), SCHEMA, 1);
    await pc.synchronize();

    const phone = await start(android(), server);
    expect(value(phone)).toEqual(areas({ health: ['sleep', 'walk'] }));
    await phone.set('data', areas({ health: ['sleep', 'walk', 'stretch'] }), SCHEMA, 1);
    await phone.synchronize();

    await pc.refreshAll();
    expect(value(pc)).toEqual(areas({ health: ['sleep', 'walk', 'stretch'] }));
  });

  it('keeps pending edits through a force-stop and delivers them once on relaunch', async () => {
    const server = new StateServer();
    const device = android();
    const phone = await start(device, server);
    server.online = false;
    await phone.set('data', areas({ home: ['clean'] }), SCHEMA, 1);
    await phone.set('journal', { entries: [{ id: 'j1', text: 'offline' }] }, SCHEMA, 1);
    phone.close(); // process death: nothing reached the server

    server.online = true;
    const relaunched = await start(device, server);
    expect(value(relaunched)).toEqual(areas({ home: ['clean'] }));
    expect(relaunched.get('data')?.pending).toBe(true);
    await relaunched.synchronize();
    await relaunched.synchronize(); // a second pass must not write again
    expect(server.writes).toBe(2);
    expect(server.records.get('data')).toMatchObject({ version: 1, value: areas({ home: ['clean'] }) });
    expect(relaunched.get('data')?.pending).toBe(false);
  });

  it('merges concurrent edits to different records and surfaces true conflicts with both versions kept', async () => {
    const server = new StateServer();
    const pc = await start(desktop(), server);
    await pc.set('data', areas({ health: ['sleep'], home: ['clean'] }), SCHEMA, 1);
    await pc.synchronize();
    const phone = await start(android(), server);

    // Different records: both changes survive in either order.
    await pc.set('data', areas({ health: ['sleep', 'walk'], home: ['clean'] }), SCHEMA, 1);
    await phone.set('data', areas({ health: ['sleep'], home: ['clean', 'laundry'] }), SCHEMA, 1);
    await pc.synchronize();
    await phone.synchronize();
    await pc.refreshAll();
    expect(value(phone)).toEqual(areas({ health: ['sleep', 'walk'], home: ['clean', 'laundry'] }));
    expect(value(pc)).toEqual(value(phone));

    // Same field on both devices: nothing is overwritten; the later writer reviews it.
    await pc.set('title', { text: 'Desk title' }, 'modulo.plugin.note', 1);
    await pc.synchronize();
    await phone.refreshAll();
    await pc.set('title', { text: 'Desk edit' }, 'modulo.plugin.note', 1);
    await phone.set('title', { text: 'Phone edit' }, 'modulo.plugin.note', 1);
    await pc.synchronize();
    await phone.synchronize().catch(() => {});
    expect(server.records.get('title')?.value).toEqual({ text: 'Desk edit' });
    const conflict = phone.conflicts().find(item => item.key === 'title');
    expect(conflict?.value).toEqual({ text: 'Phone edit' });
    expect(conflict?.conflict?.remote?.value).toEqual({ text: 'Desk edit' });
    await phone.resolve('title', 'local');
    await phone.synchronize();
    expect(server.records.get('title')?.value).toEqual({ text: 'Phone edit' });
  });

  it('does not resurrect a record deleted elsewhere when a stale client reconnects', async () => {
    const server = new StateServer();
    const pc = await start(desktop(), server);
    await pc.set('project-7', { id: 7, title: 'Old project' }, SCHEMA, 1);
    await pc.synchronize();
    const device = android();
    const phone = await start(device, server);
    expect(value(phone, 'project-7')).toEqual({ id: 7, title: 'Old project' });
    phone.close(); // the phone is offline while the desktop deletes

    await pc.delete('project-7');
    await pc.synchronize();
    expect(server.records.get('project-7')?.deleted).toBe(true);

    const reconnected = await start(device, server);
    expect(reconnected.get('project-7')?.value ?? null).toBeNull();
    await reconnected.synchronize();
    expect(server.records.get('project-7')?.deleted).toBe(true);
    expect(reconnected.list().map(item => item.key)).not.toContain('project-7');
  });

  it('keeps removed Area requirements removed across devices', async () => {
    const server = new StateServer();
    const pc = await start(desktop(), server);
    await pc.set('data', areas({ health: ['sleep', 'walk', 'meditate'] }), SCHEMA, 1);
    await pc.synchronize();
    const phone = await start(android(), server);
    await phone.set('data', areas({ health: ['sleep', 'meditate'] }), SCHEMA, 1); // removes "walk"
    await phone.synchronize();
    await pc.refreshAll();
    expect(value(pc)).toEqual(areas({ health: ['sleep', 'meditate'] }));
  });

  it('reconstructs acknowledged data on a fresh device from the server alone', async () => {
    const server = new StateServer();
    const pc = await start(desktop(), server);
    await pc.set('data', areas({ work: ['inbox zero'] }), SCHEMA, 1);
    await pc.set('settings', { theme: 'dark' }, 'modulo.workspace.settings', 1);
    await pc.synchronize();
    const fresh = await start(android(), server);
    expect(fresh.list().map(item => [item.key, item.value])).toEqual(expect.arrayContaining([
      ['data', areas({ work: ['inbox zero'] })], ['settings', { theme: 'dark' }],
    ]));
  });

  it('holds edits made during a server outage and retries once the server is back', async () => {
    const server = new StateServer();
    const phone = await start(android(), server);
    server.online = false;
    await phone.set('data', areas({ travel: ['passport'] }), SCHEMA, 1);
    await phone.synchronize().catch(() => {});
    expect(phone.get('data')?.pending).toBe(true);
    expect(server.records.size).toBe(0);
    server.online = true;
    await phone.synchronize();
    expect(server.records.get('data')?.value).toEqual(areas({ travel: ['passport'] }));
  });

  it('refuses to replay queued edits onto a restored server generation without review', async () => {
    const server = new StateServer();
    const device = android();
    const phone = await start(device, server);
    await phone.set('data', areas({ health: ['sleep'] }), SCHEMA, 1);
    await phone.synchronize();
    server.online = false;
    await phone.set('data', areas({ health: ['sleep', 'walk'] }), SCHEMA, 1);
    phone.close();

    // The server was restored from a backup: new generation, older data.
    server.records.clear();
    server.generation = '00000000-0000-4000-8000-000000000002';
    server.online = true;
    const relaunched = await start(device, server);
    await new Promise(resolve => setTimeout(resolve, 0));
    await relaunched.synchronize().catch(() => {});
    expect(server.records.size).toBe(0);
    expect(relaunched.conflicts().map(item => item.key)).toContain('data');
    expect(relaunched.get('data')?.value).toEqual(areas({ health: ['sleep', 'walk'] }));
  });
});

describe('full workspace backup across all registered schemas (#496)', () => {
  const destinations = LEGACY_KEY_REGISTRY.flatMap(entry => entry.destination
    ? [{ ...entry.destination, key: entry.destination.key.replace(/\{[a-z]+\}/g, 'sample') }] : []);

  function cluster() {
    const servers = new Map<string, StateServer>();
    return (namespace: string) => {
      let server = servers.get(namespace);
      if (!server) servers.set(namespace, (server = new StateServer()));
      return server;
    };
  }
  function opener(persistence: StatePersistence, replica: string, server: (namespace: string) => StateServer) {
    return async (namespace: string) => {
      const client = await PluginStateClient.open(scope(replica, namespace), persistence, server(namespace).transport(), { autoRetry: false });
      open.push(client);
      return client;
    };
  }

  it('exports every schema from one device and restores it losslessly into a fresh account on another', async () => {
    expect(destinations.length).toBeGreaterThan(30);
    const source = cluster();
    const pc = opener(new IndexedDbStatePersistence(new IDBFactory()), 'desktop-1', source);
    for (const [index, destination] of destinations.entries()) {
      const client = await pc(destination.namespace);
      await client.set(destination.key, { id: index, schema: destination.schemaId, nested: { list: [1, 'ä', null] } }, destination.schemaId, 1);
      await client.synchronize();
    }
    const namespaces = [...new Set(destinations.map(destination => destination.namespace))];
    const backup = parseWorkspaceBackup(JSON.parse(JSON.stringify(await exportWorkspaceState(namespaces, pc))));
    const exported = Object.values(backup.namespaces).flat();
    expect(new Set(exported.map(record => record.schemaId))).toEqual(new Set(destinations.map(destination => destination.schemaId)));

    const target = cluster();
    const phone = opener(new AndroidStatePersistence(sqliteBridge()), 'android-1', target);
    const report = await restoreWorkspaceState(backup, phone);
    expect(report).toMatchObject({ written: exported.length, unchanged: 0, removed: 0, skipped: [] });
    for (const [namespace, records] of Object.entries(backup.namespaces)) {
      for (const record of records) {
        expect(target(namespace).records.get(record.key)).toMatchObject({ schemaId: record.schemaId, value: record.value, deleted: false });
      }
    }
    // Restoring again changes nothing.
    expect(await restoreWorkspaceState(backup, phone)).toMatchObject({ written: 0, unchanged: exported.length });
  });

  it('removes records absent from the backup only when asked, and only in the backed-up namespaces', async () => {
    const servers = cluster();
    const device = opener(new IndexedDbStatePersistence(new IDBFactory()), 'desktop-1', servers);
    const para = await device('para');
    await para.set('data', { v: 1 }, SCHEMA, 1);
    await para.set('extra', { v: 2 }, SCHEMA, 1);
    await para.synchronize();
    const other = await device('todo-lists');
    await other.set('t1', { v: 3 }, 'modulo.todo', 1);
    await other.synchronize();
    const backup = parseWorkspaceBackup({ format: 'modulo.workspace-state', version: 1, exportedAt: 'x',
      namespaces: { para: [{ key: 'data', schemaId: SCHEMA, schemaVersion: 1, value: { v: 1 } }] } });
    expect(await restoreWorkspaceState(backup, device)).toMatchObject({ removed: 0, unchanged: 1 });
    expect(await restoreWorkspaceState(backup, device, { replace: true })).toMatchObject({ removed: 1 });
    expect(servers('para').records.get('extra')?.deleted).toBe(true);
    expect(servers('todo-lists').records.get('t1')?.deleted).toBe(false);
    expect(() => parseWorkspaceBackup({ format: 'other' })).toThrow('not a Modulo workspace backup');
  });
});
