import { useEffect, useReducer, useState } from 'react';
import { usePlugins } from './PluginProvider';
import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';

/** Typed namespace-bound state for plugin surfaces. Cached data remains editable while offline. */
export function usePluginState<T extends StateJson>(pluginId: string, key: string, initial: T,
  schemaId: string, schemaVersion = 1) {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [error, setError] = useState<string>();
  const [, rerender] = useReducer(n => n + 1, 0);
  const enabled = plugins.isEnabled(pluginId);
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setClient(undefined); setError(undefined);
    void plugins.state(pluginId).then(state => {
      if (disposed) return;
      setClient(state); unsubscribe = state.watch(rerender);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'State unavailable'); });
    return () => { disposed = true; unsubscribe?.(); };
    // Account identity, not token refresh or unrelated runtime notifications, determines the client lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId, plugins.stateSessionKey, enabled]);
  const active = client?.status !== 'closed' ? client : undefined;
  const record = active?.get(key);
  const available = () => {
    if (!active) throw new Error(error ?? 'Workspace state is still loading');
    return active;
  };
  return {
    value: (record && !record.deleted && record.value !== undefined ? record.value : initial) as T,
    ready: !!active,
    pending: record?.pending ?? false,
    status: active?.status ?? (error ? 'error' : 'loading'),
    error: error ?? active?.error,
    conflict: record?.conflict,
    set: async (value: T) => { await available().set(key, value, schemaId, schemaVersion); },
    remove: async () => { await available().delete(key); },
    retry: async () => { await available().refreshAll(); await available().synchronize(); },
    resolve: async (choice: 'local' | 'remote') => { await available().resolve(key, choice); },
  };
}
