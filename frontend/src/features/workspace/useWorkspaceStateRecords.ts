import { useEffect, useMemo, useState } from 'react';
import type { StateView } from '../../services/pluginStateClient';
import { usePlugins } from './plugins/PluginProvider';

export type WorkspaceNamespaceRecords = Record<string, Record<string, StateView>>;

/** Read-only subscriptions to shared server namespaces, including pending offline edits. */
export function useWorkspaceStateRecords(namespaces: string[]): WorkspaceNamespaceRecords {
  const plugins = usePlugins();
  const namespaceKey = [...new Set(namespaces)].sort().join('|');
  const stableNamespaces = useMemo(
    () => namespaceKey ? namespaceKey.split('|') : [],
    [namespaceKey],
  );
  const [snapshot, setSnapshot] = useState<{
    session: string;
    key: string;
    records: WorkspaceNamespaceRecords;
  }>({ session: '', key: '', records: {} });

  useEffect(() => {
    let active = true;
    const stops: (() => void)[] = [];
    const records: WorkspaceNamespaceRecords = {};
    const publish = () => {
      if (!active) return;
      setSnapshot({
        session: plugins.stateSessionKey,
        key: namespaceKey,
        records: Object.fromEntries(
          Object.entries(records).map(([namespace, values]) => [
            namespace,
            { ...values },
          ]),
        ),
      });
    };
    setSnapshot({ session: plugins.stateSessionKey, key: namespaceKey, records: {} });
    if (!plugins.stateSessionKey) return () => { active = false; };

    for (const namespace of stableNamespaces) {
      void plugins.workspaceState(namespace).then((client) => {
        if (!active || client.status === 'closed') return;
        const update = () => {
          if (!active || client.status === 'closed') return;
          records[namespace] = Object.fromEntries(
            client.list().map((record) => [record.key, record]),
          );
          publish();
        };
        stops.push(client.watch(update));
        update();
      }).catch(() => {
        records[namespace] = {};
        publish();
      });
    }
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
    // Session identity and namespace membership define subscription lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins.stateSessionKey, namespaceKey]);

  return snapshot.session === plugins.stateSessionKey && snapshot.key === namespaceKey
    ? snapshot.records
    : {};
}
