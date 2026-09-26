import { useEffect, useMemo, useState } from 'react';
import type { CoreNote } from '@modulo/core';
import { collectLifeOsEntities, type LifeOsEntity } from './lifeOs';
import { usePlugins } from './plugins/PluginProvider';
import { stateEntities } from './searchIndex';
import { useLifeOsServerSnapshot } from './useLifeOsServerSnapshot';

export function useWorkspaceIndex(notes: CoreNote[] = []) {
  const plugins = usePlugins();
  const key = ['project-workspaces', 'executable-runbooks', 'decision-journal'].filter(plugins.isEnabled).join(',');
  const stores = useLifeOsServerSnapshot();
  const [snapshot, setSnapshot] = useState<{ session: string; key: string; entities: LifeOsEntity[] }>({ session: '', key: '', entities: [] });
  useEffect(() => {
    let active = true;
    const stops: (() => void)[] = [];
    const records = new Map<string, LifeOsEntity[]>();
    setSnapshot({ session: plugins.stateSessionKey, key, entities: [] });
    for (const id of key.split(',').filter(Boolean)) void plugins.state(id).then(client => {
      if (!active || client.status === 'closed') return;
      const update = () => {
        if (!active) return;
        records.set(id, client.status === 'closed' ? [] : client.list().flatMap(entry => entry.schemaId === 'workspace-tool' && entry.schemaVersion === 1 ? stateEntities(id, plugins.manifest(id)?.name ?? id, entry.value) : []));
        setSnapshot({ session: plugins.stateSessionKey, key, entities: [...records.values()].flat() });
      };
      stops.push(client.watch(update)); update();
    }).catch(() => { /* Unavailable namespaces contribute no cached results. */ });
    return () => { active = false; stops.forEach(stop => stop()); };
    // Session and enabled namespace identity determine subscription lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins.stateSessionKey, key]);
  return useMemo(() => {
    const legacy = collectLifeOsEntities(notes, stores);
    const current = snapshot.session === plugins.stateSessionKey && snapshot.key === key ? snapshot.entities : [];
    return [...legacy.filter(entity => !(entity.route === 'decision-journal' && key.split(',').includes('decision-journal'))), ...current];
  }, [notes, stores, snapshot, plugins.stateSessionKey, key]);
}
