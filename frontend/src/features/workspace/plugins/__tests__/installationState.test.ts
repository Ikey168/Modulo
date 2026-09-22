import { describe, expect, it, afterEach, vi } from 'vitest';
import { PluginRuntime } from '../runtime';
import { installationStorage, importWorkspacePreferences, validateInstallations } from '../installationState';
import { PluginStateClient, type StateRecord, type StateTransport } from '../../../../services/pluginStateClient';
import type { PluginManifest } from '../types';
const catalog: PluginManifest[] = [
  { id: 'notes', name: 'Notes', description: '', category: 'test', icon: (() => null) as never, builtin: true,
    load: async () => ({ default: { activate: () => {} } }) },
  { id: 'outline', name: 'Outline', description: '', category: 'test', icon: (() => null) as never, dependencies: ['notes'],
    load: async () => ({ default: { activate: () => {} } }) },
];
async function setup() {
  const records = new Map<string, StateRecord>();
  const transport: StateTransport = {
    get: async key => records.get(key), list: async () => ({ records: [...records.values()] }),
    put: async (key, request) => {
      const record = { key, ...request, version: request.expectedVersion + 1, deleted: false, createdAt: '', updatedAt: '' };
      records.set(key, record); return record;
    }, delete: async () => { throw new Error('unused'); },
  };
  const open = () => PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject: 'alice', workspace: 'personal',
    namespace: 'workspace-settings', replica: crypto.randomUUID() }, { load: async () => null, save: async () => {} }, transport, { autoRetry: false });
  return { records, client: await open(), open };
}
afterEach(() => localStorage.clear());
describe('account installation preferences', () => {
  it('uses safe defaults instead of another browser account’s installation list', async () => {
    localStorage.setItem('modulo-plugins-installed', JSON.stringify([{ id: 'outline', enabled: true }]));
    const { client } = await setup(); const runtime = new PluginRuntime(catalog, undefined, installationStorage(client, catalog));
    expect(runtime.installationRecords()).toEqual([{ id: 'notes', enabled: true }]);
  });
  it('synchronizes enabled states and keeps dependency uninstall checks', async () => {
    const { client, open } = await setup(); const first = new PluginRuntime(catalog, undefined, installationStorage(client, catalog));
    await first.init(); await first.install('outline'); await first.setEnabled('outline', false); await client.synchronize();
    const secondClient = await open(); await secondClient.refreshAll();
    const second = new PluginRuntime(catalog, undefined, installationStorage(secondClient, catalog));
    await second.init(); expect(second.isInstalled('outline')).toBe(true); expect(second.isEnabled('outline')).toBe(false);
    await expect(second.uninstall('notes')).rejects.toThrow('depend');
    await second.uninstall('outline'); await secondClient.synchronize(); await client.refreshAll();
    await first.applyInstallations(installationStorage(client, catalog).load()); expect(first.isInstalled('outline')).toBe(false);
  });
  it('rolls back a local enable/uninstall if durable persistence fails', async () => {
    const save = vi.fn(async () => { throw new Error('disk full'); });
    const runtime = new PluginRuntime(catalog, undefined, { load: () => [{ id: 'notes', enabled: true }], save });
    await runtime.init(); await expect(runtime.setEnabled('notes', false)).rejects.toThrow('disk full');
    expect(runtime.isEnabled('notes')).toBe(true); await expect(runtime.uninstall('notes')).rejects.toThrow('disk full');
    expect(runtime.isInstalled('notes')).toBe(true); expect(runtime.isActive('notes')).toBe(true);
  });
  it('migrates installs and hub tabs once, preserving disabled states and removing confirmed legacy keys', async () => {
    const { client, records } = await setup();
    localStorage.setItem('modulo-plugins-installed', JSON.stringify([{ id: 'notes', enabled: true }, { id: 'outline', enabled: false }]));
    localStorage.setItem('modulo-plugins', '["notes"]'); localStorage.setItem('modulo-hub-tabs', '{"productivity":"calendar"}');
    await importWorkspacePreferences(client, localStorage, catalog);
    expect(installationStorage(client, catalog).load()[1].enabled).toBe(false);
    expect(records.get('tab.productivity')?.value).toBe('calendar'); expect(localStorage.length).toBe(0);
    await importWorkspacePreferences(client, localStorage, catalog); expect(records.get('installed')?.version).toBe(1);
  });
  it('rejects invalid dependencies before changing settings and preserves newer remote tabs', async () => {
    expect(() => validateInstallations([{ id: 'outline', enabled: true }], catalog)).toThrow('Missing dependency');
    const { client } = await setup(); await client.set('tab.productivity', 'planner', 'modulo.workspace.hub-tab', 1); await client.synchronize();
    localStorage.setItem('modulo-hub-tabs', '{"productivity":"calendar"}');
    await expect(importWorkspacePreferences(client, localStorage, catalog)).rejects.toThrow('differ');
    expect(client.get('tab.productivity')?.value).toBe('planner'); expect(localStorage.getItem('modulo-hub-tabs')).not.toBeNull();
  });
  it('rejects actions on a disposed account runtime', async () => {
    const { client } = await setup(); const runtime = new PluginRuntime(catalog, undefined, installationStorage(client, catalog));
    await runtime.dispose(); await expect(runtime.install('outline')).rejects.toThrow('closed'); expect(client.get('installed')).toBeUndefined();
  });
});
