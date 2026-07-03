import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { PluginRuntime } from './runtime';
import { CATALOG } from './catalog';
import type { Contributions, InstallPhase, PluginManifest } from './types';

export interface PluginsApi {
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
  const runtime = useMemo(() => new PluginRuntime(CATALOG), []);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = runtime.subscribe(bump);
    runtime.init().finally(() => setReady(true));
    return unsub;
  }, [runtime]);

  const value = useMemo<PluginsApi>(
    () => ({
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
      install: (id) => runtime.install(id),
      uninstall: (id) => runtime.uninstall(id),
      setEnabled: (id, enabled) => runtime.setEnabled(id, enabled),
    }),
    // `version` bumps on every runtime change so derived values recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, ready, version],
  );

  return <PluginsContext.Provider value={value}>{children}</PluginsContext.Provider>;
}

export function usePlugins(): PluginsApi {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error('usePlugins must be used within a PluginProvider');
  return ctx;
}
