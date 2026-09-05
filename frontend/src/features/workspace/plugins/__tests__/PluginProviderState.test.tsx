import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginProvider, usePlugins, type PluginsApi } from '../PluginProvider';
import { PluginStateClient } from '../../../../services/pluginStateClient';
const control = vi.hoisted(() => ({ client: undefined as unknown, identity: 'alice', onAuth: () => {}, notify: () => {} }));
vi.mock('../../../auth/authService', () => ({ authService: { stateSession: () => null,
  subscribeSession: (listener: () => void) => { control.onAuth = listener; return () => {}; } } }));
vi.mock('../catalog', () => ({ CATALOG: ['notes', 'optional'].map(id => ({ id, name: id, description: '', category: 'test',
  icon: () => null, builtin: id === 'notes', load: async () => ({ default: { activate: () => {} } }) })) }));
vi.mock('../../../../services/workspaceStateHost', () => ({
  acquireStateReplica: () => ({ replica: Promise.resolve('replica'), close: () => {} }),
  WorkspaceStateHost: class {
    get sessionKey() { return control.identity; }
    sessionChanged() { control.notify(); }
    open() { return Promise.resolve(control.client); }
    subscribe(listener: () => void) { control.notify = listener; return () => {}; }
    start() { return () => {}; }
    close() {}
    revoke() {}
  },
}));
async function client(subject: string) {
  return PluginStateClient.open({ origin: 'https://app', issuer: 'https://id', subject, workspace: 'personal', namespace: 'workspace-settings', replica: 'one' },
    { load: async () => null, save: async () => {} }, {
      get: async () => undefined,
      put: async () => { throw new Error('offline'); }, delete: async () => { throw new Error('unused'); },
    }, { autoRetry: false });
}
afterEach(() => localStorage.clear());
describe('plugin provider state lifecycle', () => {
  it('loads account defaults, queues an installation offline, and resets on account change', async () => {
    const alice = await client('alice'); control.client = alice; control.identity = 'alice';
    let api!: PluginsApi;
    function Consumer() { api = usePlugins(); return <span>{[...api.installedIds].join(',')}</span>; }
    const view = render(<PluginProvider><Consumer /></PluginProvider>);
    await waitFor(() => expect(api.preferences).toBe(alice));
    await waitFor(() => expect(api.ready).toBe(true));
    await act(async () => { await api.install('optional'); });
    expect(api.isInstalled('optional')).toBe(true); expect(alice.get('installed')?.pending).toBe(true);
    const bob = await client('bob');
    act(() => { alice.close(); control.identity = 'bob'; control.client = bob; control.onAuth(); });
    await waitFor(() => expect(api.preferences).toBe(bob));
    await waitFor(() => expect(api.ready).toBe(true));
    expect(api.isInstalled('optional')).toBe(false); expect(bob.get('installed')).toBeUndefined();
    view.unmount();
  });
});
