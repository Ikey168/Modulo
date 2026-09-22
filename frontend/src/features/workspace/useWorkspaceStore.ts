import { useCallback, useEffect, useState } from 'react';
import type { PluginStateClient } from '../../services/pluginStateClient';
import { useWorkspaceDurableRecord } from './plugins/useDurableRecord';
import { registerWorkspaceLegacySource } from './workspaceLegacyMigration';

export type StoreUpdate<T> = T | ((current: T) => T);
export type WorkspaceStore<T> = [T, (next: StoreUpdate<T>) => boolean];

/**
 * Legacy device-local helper retained for core workspace recovery only.
 * Plugin-owned durable data must use useServerWorkspaceStore instead.
 */
export function useWorkspaceStore<T>(
  read: () => T,
  write: (data: T) => boolean,
  changedEvent: string,
): WorkspaceStore<T> {
  const [data, setData] = useState(read);
  useEffect(() => {
    const refresh = () => setData(read());
    refresh();
    window.addEventListener(changedEvent, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(changedEvent, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [read, changedEvent]);
  const persist = useCallback(
    (next: StoreUpdate<T>): boolean => {
      const current = read();
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (!write(resolved)) return false;
      setData(resolved);
      return true;
    },
    [read, write],
  );
  return [data, persist];
}

/**
 * Server-authoritative workspace data shared by a plugin family.
 * IndexedDB/native persistence is only the PluginStateClient cache/outbox.
 */
export function useServerWorkspaceStore<T>(
  namespace: string,
  key: string,
  schemaId: string,
  initial: T,
  validate: (value: unknown) => T,
  legacyKey?: string | string[],
  label = namespace,
  legacyImporter?: (client: PluginStateClient) => Promise<void>,
): WorkspaceStore<T> {
  const durable = useWorkspaceDurableRecord(namespace, key, schemaId, initial, validate, legacyKey, legacyImporter);

  useEffect(() => {
    if (!durable.legacy) return;
    return registerWorkspaceLegacySource({
      id: namespace + ':' + key,
      label,
      importLegacy: durable.importLegacy,
      exportRecovery: durable.exportRecovery,
    });
    // Actions are bound to the active durable record. Re-register only when legacy ownership changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durable.legacy, namespace, key, label]);

  return [durable.value, durable.set];
}
