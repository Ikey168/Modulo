import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { PluginRuntime } from './runtime';
import { CATALOG } from './catalog';
import type { Contributions, InstallPhase, PluginManifest } from './types';
import { authService } from '../../auth/authService';
import { WorkspaceStateHost, acquireStateReplica } from '../../../services/workspaceStateHost';
import { BrowserStatePersistence } from '../../../services/pluginStateTransport';
import type { PluginStateClient } from '../../../services/pluginStateClient';
import { installationStorage, importWorkspacePreferences } from './installationState';
import { PluginStateNotice } from './PluginStateNotice';

export interface PluginsApi {
  state: (id: string) => Promise<PluginStateClient>;
  stateSessionKey: string;
  preferences?: PluginStateClient;
  /** True once the initial activation of installed plugins has finished. */
  ready: boolean;
  catalog: PluginManifest[];
  contributions: Contributions;
  installedIds: Set<string>;
  isInstalled: (id: string) => boolean;
  isEnabled: (id: string) => boolean;
  phaseOf: (id: string) => InstallPhase;
  errorOf: (id: string) => string | undefined;
  dependents: (id: string) => string[];
  manifest: (id: string) => PluginManifest | undefined;
  install: (id: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
}

const PluginsContext = createContext<PluginsApi | null>(null);

export function PluginProvider({ children }: { children: ReactNode }) {
  const [stateHost, setStateHost] = useState<WorkspaceStateHost>();
  const [preferences, setPreferences] = useState<PluginStateClient>();
  const [legacySettings, setLegacySettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string>();
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const lease = navigator.locks ? acquireStateReplica(sessionStorage, navigator.locks) : {
      replica: Promise.reject<string>(new Error('This browser does not support safe offline cache locking')),
      close: () => {},
    };
    void lease.replica.catch(() => {});
    const host = new WorkspaceStateHost({ origin: window.location.origin, replica: lease.replica,
      persistence: new BrowserStatePersistence(localStorage), session: () => authService.stateSession() });
    const unsubscribe = authService.subscribeSession(() => host.sessionChanged());
    const stop = host.start(window);
    const observe = host.subscribe(bump);
    setStateHost(host);
    return () => { unsubscribe(); stop(); observe(); host.close(); lease.close(); };
  }, []);

  const identity = stateHost?.sessionKey ?? '';
  useEffect(() => {
    let disposed = false;
    setPreferences(undefined); setSettingsError(undefined);
    try { setLegacySettings(['modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs'].some(key => localStorage.getItem(key) !== null)); } catch { setLegacySettings(false); }
    if (stateHost && identity) void stateHost.open('workspace-settings').then(client => {
      if (!disposed) setPreferences(client);
    }).catch(reason => { if (!disposed) setSettingsError(String(reason)); });
    return () => { disposed = true; };
  }, [stateHost, identity]);

  const activePreferences = preferences?.status !== 'closed' ? preferences : undefined;
  const runtime = useMemo(() => {
    const storage = installationStorage(activePreferences, CATALOG);
    try { return new PluginRuntime(CATALOG, undefined, storage); }
    catch { return new PluginRuntime(CATALOG, undefined, {
      load: () => installationStorage(undefined, CATALOG).load(),
      save: async () => { throw new Error('Plugin settings require recovery before editing.'); },
    }); }
  }, [activePreferences]);

  const runOperation = useMemo(() => {
    let queue = Promise.resolve();
    return (action: () => Promise<void>) => {
      const result = queue.then(action); queue = result.catch(() => {}); return result;
    };
  }, [runtime]);

  useEffect(() => {
    runtime.setStateHost(stateHost);
    return () => { runtime.setStateHost(undefined); };
  }, [runtime, stateHost]);

  useEffect(() => {
    if (!activePreferences) return;
    let disposed = false;
    let queued = Promise.resolve();
    const refresh = () => {
      queued = queued.then(async () => {
        if (disposed || activePreferences.status === 'closed') return;
        await runOperation(() => runtime.applyInstallations(installationStorage(activePreferences, CATALOG).load()));
      }).catch(reason => { if (!disposed) setSettingsError(String(reason)); });
    };
    const stop = activePreferences.watch(refresh); refresh();
    return () => { disposed = true; stop(); };
  }, [runtime, activePreferences, runOperation]);

  useEffect(() => {
    const unsub = runtime.subscribe(bump);
    let disposed = false; setReady(false);
    void runOperation(() => runtime.init()).catch(reason => { if (!disposed) setSettingsError(String(reason)); }).finally(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; unsub(); runtime.setStateHost(undefined); void runtime.dispose(); };
  }, [runtime, runOperation]);

  const value = useMemo<PluginsApi>(
    () => ({
      state: (id) => runtime.state(id),
      preferences: activePreferences,
      stateSessionKey: stateHost?.sessionKey ?? '',
      ready,
      catalog: runtime.getCatalog(),
      contributions: runtime.contributions(),
      installedIds: runtime.installedIds(),
      isInstalled: (id) => runtime.isInstalled(id),
      isEnabled: (id) => runtime.isEnabled(id),
      phaseOf: (id) => runtime.phaseOf(id),
      errorOf: (id) => runtime.errorOf(id),
      dependents: (id) => runtime.dependents(id),
      manifest: (id) => runtime.getManifest(id),
      install: (id) => runOperation(() => runtime.install(id)),
      uninstall: (id) => runOperation(() => runtime.uninstall(id)),
      setEnabled: (id, enabled) => runOperation(() => runtime.setEnabled(id, enabled)),
    }),
    // `version` bumps on every runtime change so derived values recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, ready, version, stateHost, activePreferences, runOperation],
  );

  return <PluginsContext.Provider value={value}>
    <PluginStateNotice status={settingsError ? 'error' : activePreferences?.status ?? 'loading'}
      error={settingsError ?? activePreferences?.error} conflict={activePreferences?.conflicts().length ? activePreferences.conflicts() : undefined}
      retry={async () => { if (activePreferences) { await activePreferences.refreshAll(); await activePreferences.synchronize(); setSettingsError(undefined); } }}
      resolve={async choice => { for (const entry of activePreferences?.conflicts() ?? []) await activePreferences?.resolve(entry.key, choice); }} />
    {legacySettings && <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-sm">
      <span>Plugin settings are available in this browser.</span>
      <button type="button" className="underline" disabled={!activePreferences} onClick={() => {
        if (!activePreferences) return;
        void importWorkspacePreferences(activePreferences, localStorage, CATALOG).then(() => {
          if (activePreferences.status !== 'closed') setLegacySettings(false);
        }).catch(reason => { if (activePreferences.status !== 'closed') setSettingsError(String(reason)); });
      }}>Import into this account</button>
    </div>}
    {(legacySettings || settingsError) && <button type="button" className="px-3 py-2 text-left text-sm underline" onClick={() => {
      const legacy = Object.fromEntries(['modulo-plugins-installed', 'modulo-plugins', 'modulo-hub-tabs'].map(key => [key, localStorage.getItem(key)]));
      const url = URL.createObjectURL(new Blob([JSON.stringify({ legacy, cache: activePreferences?.recoverySnapshot() }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'workspace-settings-recovery.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export settings recovery data</button>}
    {children}
  </PluginsContext.Provider>;
}

export function usePlugins(): PluginsApi {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error('usePlugins must be used within a PluginProvider');
  return ctx;
}
