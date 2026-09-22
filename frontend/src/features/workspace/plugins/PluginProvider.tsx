import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { PluginRuntime } from './runtime';
import { CATALOG } from './catalog';
import type { Contributions, InstallPhase, PluginManifest } from './types';
import { authService } from '../../auth/authService';
import { WorkspaceStateHost, acquireStateReplica } from '../../../services/workspaceStateHost';
import { androidStateReplica, createStatePersistence } from '../../../services/androidStatePersistence';
import { Capacitor } from '@capacitor/core';
import type { PluginStateClient } from '../../../services/pluginStateClient';
import { installationStorage } from './installationState';
import { browserPluginSettings, hasBrowserPluginSettings, importBrowserPluginSettings } from './legacyInstallationMigration';
import { PluginStateNotice } from './PluginStateNotice';
import { SystemBanner } from '../mobile/SystemBanner';
import { WorkspaceLegacyStateNotice } from '../WorkspaceLegacyStateNotice';
import webSocketService from '../../../services/websocket';

export interface PluginsApi {
  state: (id: string) => Promise<PluginStateClient>;
  workspaceState: (namespace: string) => Promise<PluginStateClient>;
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
    const lease = Capacitor.getPlatform() === 'android' ? { replica: androidStateReplica(), close: () => {} }
      : navigator.locks ? acquireStateReplica(sessionStorage, navigator.locks) : {
      replica: Promise.reject<string>(new Error('This browser does not support safe offline cache locking')),
      close: () => {},
    };
    void lease.replica.catch(() => {});
    const persistence = createStatePersistence();
    const host = new WorkspaceStateHost({ origin: window.__MODULO_CONFIG__?.serverOrigin ?? window.location.origin, replica: lease.replica,
      persistence, session: () => authService.stateSession() });
    const unsubscribe = authService.subscribeSession(() => host.sessionChanged());
    const unsubscribeState = webSocketService.subscribeState(event => {
      if (event.workspace !== 'personal') return;
      void host.refresh(event.namespace, event.key).catch(() => {
        // Focus/reconnect polling remains the recovery path for a transient fetch failure.
      });
    });
    void webSocketService.connect();
    const stop = host.start(window);
    const observe = host.subscribe(bump);
    setStateHost(host);
    // Release the tab lease before the next document starts. Otherwise an
    // immediate reload can mistake its predecessor for a cloned tab and leave
    // unacknowledged edits in a different replica partition.
    const leave = () => { host.close(); lease.close(); };
    const resume = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', resume);
    return () => { window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', resume); unsubscribe(); unsubscribeState(); stop(); observe(); leave(); };
  }, []);

  const identity = stateHost?.sessionKey ?? '';
  useEffect(() => {
    let disposed = false;
    setPreferences(undefined); setSettingsError(undefined);
    setLegacySettings(Capacitor.getPlatform() !== 'android' && hasBrowserPluginSettings());
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

  // A replacement account/runtime must not inherit pending work from the old one.
  const operationQueues = useRef(new WeakMap<PluginRuntime, Promise<void>>());
  const runOperation = useCallback((action: () => Promise<void>) => {
    const queue = operationQueues.current.get(runtime) ?? Promise.resolve();
    const result = queue.then(action);
    operationQueues.current.set(runtime, result.catch(() => {}));
    return result;
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
      workspaceState: (namespace) => {
        if (!stateHost?.sessionKey) return Promise.reject(new Error('Workspace synchronization is unavailable'));
        if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,117}$/.test(namespace)) return Promise.reject(new Error('Invalid workspace state namespace'));
        return stateHost.open('workspace-' + namespace);
      },
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
    <WorkspaceLegacyStateNotice />
    <PluginStateNotice status={settingsError ? 'error' : activePreferences?.status ?? 'loading'}
      error={settingsError ?? activePreferences?.error} conflict={activePreferences?.conflicts().length ? activePreferences.conflicts() : undefined}
      retry={async () => { if (activePreferences) { await activePreferences.refreshAll(); await activePreferences.synchronize(); setSettingsError(undefined); } }}
      resolve={async choice => { for (const entry of activePreferences?.conflicts() ?? []) await activePreferences?.resolve(entry.key, choice); }} />
    {/* One strip, not three stacked ones: on a 360dp screen each extra
        full-width notice was another line of chrome ahead of the app bar. */}
    {(legacySettings || settingsError) && <SystemBanner tone={settingsError ? 'alert' : 'neutral'} aria-label="Plugin settings recovery">
      {legacySettings && <>
        <span className="min-w-0 flex-1">Plugin settings are available in this browser.</span>
        <button type="button" disabled={!activePreferences} onClick={() => {
          if (!activePreferences) return;
          void importBrowserPluginSettings(activePreferences, CATALOG).then(() => {
            if (activePreferences.status !== 'closed') setLegacySettings(false);
          }).catch(reason => { if (activePreferences.status !== 'closed') setSettingsError(String(reason)); });
        }}>Import into this account</button>
      </>}
      <button type="button" onClick={() => {
        const legacy = Capacitor.getPlatform() === 'android' ? null : browserPluginSettings();
        const url = URL.createObjectURL(new Blob([JSON.stringify({ legacy, cache: activePreferences?.recoverySnapshot() }, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'workspace-settings-recovery.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export settings recovery data</button>
    </SystemBanner>}
    {children}
  </PluginsContext.Provider>;
}

export function usePlugins(): PluginsApi {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error('usePlugins must be used within a PluginProvider');
  return ctx;
}
