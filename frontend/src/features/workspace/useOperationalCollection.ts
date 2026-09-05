import { useEffect, useRef, useState } from 'react';
import { usePlugins } from './plugins/PluginProvider';
import type { PluginStateClient } from '../../services/pluginStateClient';
import { importCollection, readCollection, saveCollection, validateCollection, type OperationalCollection } from './operationalState';

/** Each entity has its own CAS version and offline queue; failed local changes remain exportable. */
export function useOperationalCollection<T extends { id: string }>(definition: OperationalCollection<T>) {
  const plugins = usePlugins();
  const [value, setValue] = useState<T[]>([]);
  const current = useRef<T[]>([]);
  const [client, setClient] = useState<PluginStateClient>();
  const [error, setError] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [, redraw] = useState(0);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const failures = useRef<{ previous: T[]; next: T[] }[]>([]);
  const enabled = plugins.isEnabled(definition.namespace);
  useEffect(() => {
    const token = ++generation.current; let disposed = false; let stop: (() => void) | undefined;
    current.current = []; setValue([]); setClient(undefined); setError(undefined); setInvalid(false);
    pending.current = 0; queue.current = Promise.resolve(); failures.current = [];
    try { setLegacy(localStorage.getItem(definition.legacyKey) !== null); } catch { setLegacy(false); }
    void plugins.state(definition.namespace).then(state => {
      if (disposed) return;
      const refresh = () => {
        if (disposed || state.status === 'closed') return;
        redraw(n => n + 1);
        if (pending.current || failures.current.length) return;
        try { current.current = readCollection(state, definition); setValue(current.current); setInvalid(false); }
        catch (reason) { setInvalid(true); setError(String(reason)); }
      };
      setClient(state); stop = state.watch(refresh); refresh();
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; stop?.(); if (generation.current === token) generation.current++; };
  }, [definition, plugins.stateSessionKey, enabled]); // Definitions are module constants.
  const active = client?.status !== 'closed' ? client : undefined;
  const set = (next: T[] | ((previous: T[]) => T[])) => {
    if (!active || invalid) { setError('Wait for a valid account cache before editing.'); return; }
    try {
      const previous = current.current;
      const resolved = validateCollection(definition, typeof next === 'function' ? next(previous) : next);
      const token = generation.current;
      current.current = resolved; setValue(resolved); pending.current++;
      queue.current = queue.current.then(() => saveCollection(active, definition, previous, resolved))
        .catch(reason => { if (generation.current === token) { failures.current.push({ previous, next: resolved }); setError(String(reason)); } })
        .finally(() => { if (generation.current === token) { pending.current--; redraw(n => n + 1); } });
    } catch (reason) { setError(String(reason)); }
  };
  const action = async (work: () => Promise<void>) => {
    const token = generation.current;
    try {
      await work(); if (token !== generation.current || !active || active.status === 'closed') return;
      current.current = readCollection(active, definition); setValue(current.current); setInvalid(false); setError(undefined);
    } catch (reason) { if (token === generation.current) setError(String(reason)); }
  };
  const conflicts = active?.conflicts().filter(record => record.key.startsWith('record.')) ?? [];
  return { value: active ? value : [], sessionKey: plugins.stateSessionKey, set, ready: !!active && !invalid, error, legacy,
    status: error ? 'error' : active?.status ?? 'loading', conflict: conflicts.length ? conflicts : undefined,
    retry: () => action(async () => {
      if (!active) throw new Error('Sign in to synchronize.');
      const token = generation.current; await queue.current;
      while (token === generation.current && failures.current.length) {
        const failed = failures.current[0]; await saveCollection(active, definition, failed.previous, failed.next);
        if (token !== generation.current) return; failures.current.shift();
      }
      await active.refreshAll(); await active.synchronize();
    }),
    resolve: (choice: 'local' | 'remote') => action(async () => {
      if (active) for (const conflict of conflicts) await active.resolve(conflict.key, choice);
    }),
    importLegacy: () => action(async () => {
      if (!active) throw new Error('Sign in to import browser data.');
      const token = generation.current; await importCollection(active, definition, localStorage);
      if (token === generation.current) setLegacy(localStorage.getItem(definition.legacyKey) !== null);
    }),
    exportRecovery: () => {
      const raw = JSON.stringify({ legacy: localStorage.getItem(definition.legacyKey), cache: active?.recoverySnapshot(), local: current.current }, null, 2);
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${definition.namespace}-recovery.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
