import { useEffect, useMemo, useState } from 'react';
import {
  containsProhibitedSecuritySecret,
  emptyLifeCollection,
  lifeStoreKey,
  parseLifeCollection,
  SECURITY_SECRET_REJECTED_EVENT,
  type LifeCollectionData,
} from './lifeStore';
import { useServerWorkspaceStore } from './useWorkspaceStore';
import { usePlugins } from './plugins/PluginProvider';

export const LIFE_COLLECTION_SCHEMA = 'modulo.workspace.life-collection';

function validatedLifeCollection(pluginId: string, value: unknown): LifeCollectionData {
  const parsed = parseLifeCollection(value);
  if (pluginId.startsWith('security-') && containsProhibitedSecuritySecret(parsed)) {
    window.dispatchEvent(new CustomEvent(SECURITY_SECRET_REJECTED_EVENT, { detail: pluginId }));
    throw new Error('Security secrets must be stored in a secure credential provider, not workspace plugin state.');
  }
  return parsed;
}

export function useLifeCollection(
  pluginId: string,
): [LifeCollectionData, (next: LifeCollectionData | ((current: LifeCollectionData) => LifeCollectionData)) => boolean] {
  const validate = useMemo(() => (value: unknown) => validatedLifeCollection(pluginId, value), [pluginId]);
  return useServerWorkspaceStore(
    'life-collections',
    pluginId,
    LIFE_COLLECTION_SCHEMA,
    emptyLifeCollection(),
    validate,
    lifeStoreKey(pluginId),
    pluginId,
  );
}

/** Read several independently versioned life-collection records from one server namespace. */
export function useLifeCollections(pluginIds: string[]): Record<string, LifeCollectionData> {
  const plugins = usePlugins();
  const idsKey = [...pluginIds].sort().join('|');
  const ids = useMemo(() => idsKey ? idsKey.split('|') : [], [idsKey]);
  const [collections, setCollections] = useState<Record<string, LifeCollectionData>>({});

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    setCollections(Object.fromEntries(ids.map(id => [id, emptyLifeCollection()])));
    if (!plugins.stateSessionKey) return;

    void plugins.workspaceState('life-collections').then(state => {
      if (disposed) return;
      const refresh = () => {
        if (disposed || state.status === 'closed') return;
        setCollections(Object.fromEntries(ids.map(id => {
          const record = state.get(id);
          if (!record || record.deleted) return [id, emptyLifeCollection()];
          if (record.schemaId !== LIFE_COLLECTION_SCHEMA || record.schemaVersion !== 1) {
            return [id, emptyLifeCollection()];
          }
          try { return [id, parseLifeCollection(record.value)]; }
          catch { return [id, emptyLifeCollection()]; }
        })));
      };
      stop = state.watch(refresh);
      refresh();
    }).catch(() => {
      if (!disposed) setCollections(Object.fromEntries(ids.map(id => [id, emptyLifeCollection()])));
    });

    return () => {
      disposed = true;
      stop?.();
    };
    // The workspace state opener is stable for a session; idsKey captures collection membership.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, plugins.stateSessionKey]);

  return collections;
}
