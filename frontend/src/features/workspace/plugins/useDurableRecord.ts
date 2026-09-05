import { useEffect, useRef, useState } from 'react';
import { usePlugins } from './PluginProvider';
import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';
import { importLegacyState } from '../../../services/legacyStateImport';

/** A schema-checked record with optimistic edits and explicit browser-data claiming. */
export function useDurableRecord<T>(pluginId: string, key: string, schemaId: string,
  initial: T, validate: (value: unknown) => T, legacyKey?: string) {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const [error, setError] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [, redraw] = useState(0);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(false);
  const enabled = plugins.isEnabled(pluginId);
  useEffect(() => {
    const token = ++generation.current;
    let disposed = false; let stop: (() => void) | undefined;
    current.current = initial; setValue(initial); setClient(undefined); setError(undefined); setInvalid(false);
    queue.current = Promise.resolve(); pending.current = 0; failed.current = false;
    try { setLegacy(!!legacyKey && localStorage.getItem(legacyKey) !== null); } catch { setLegacy(false); }
    void plugins.state(pluginId).then(state => {
      if (disposed) return;
      const refresh = () => {
        if (disposed || state.status === 'closed') return;
        redraw(n => n + 1);
        if (pending.current || failed.current) return;
        try {
          const record = state.get(key);
          if (record && !record.deleted && (record.schemaId !== schemaId || record.schemaVersion !== 1)) throw new Error('Unsupported record version. Export the data for recovery.');
          const next = record && !record.deleted ? validate(record.value) : initial;
          current.current = next; setValue(next); setInvalid(false);
        } catch (reason) { setInvalid(true); setError(reason instanceof Error ? reason.message : 'Invalid record'); }
      };
      setClient(state); stop = state.watch(refresh); refresh();
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; stop?.(); if (generation.current === token) generation.current++; };
    // Validators and defaults are immutable consumer definitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId, key, schemaId, plugins.stateSessionKey, enabled]);
  const active = client?.status !== 'closed' ? client : undefined;
  const save = (next: T | ((previous: T) => T)) => {
    if (!active || invalid) { setError('Wait for a valid account cache before editing.'); return; }
    const token = generation.current;
    const resolved = validate(typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next);
    current.current = resolved; setValue(resolved); pending.current++;
    queue.current = queue.current.then(() => active.set(key, JSON.parse(JSON.stringify(resolved)) as StateJson, schemaId, 1))
      .catch(reason => { if (generation.current === token) { failed.current = true; setError(String(reason)); } })
      .finally(() => { if (generation.current === token) { pending.current--; redraw(n => n + 1); } });
  };
  const action = async (work: () => Promise<void>) => {
    const token = generation.current;
    try {
      await work();
      if (token !== generation.current) return;
      setError(undefined);
      const record = active?.get(key);
      if (record && !record.deleted) {
        if (record.schemaId !== schemaId || record.schemaVersion !== 1) throw new Error('Unsupported record version.');
        current.current = validate(record.value); setValue(current.current); setInvalid(false);
      }
    } catch (reason) { if (token === generation.current) setError(String(reason)); }
  };
  return { value, set: save, ready: !!active && !invalid, error, legacy,
    status: error ? 'error' : active?.status ?? 'loading', conflict: active?.get(key)?.conflict,
    retry: () => action(async () => {
      if (!active) throw new Error('Sign in to synchronize.');
      const token = generation.current; await queue.current;
      if (token !== generation.current) return;
      if (failed.current) { await active.set(key, JSON.parse(JSON.stringify(current.current)) as StateJson, schemaId, 1); failed.current = false; }
      await active.refreshAll(); await active.synchronize();
    }),
    resolve: (choice: 'local' | 'remote') => action(async () => { if (active) await active.resolve(key, choice); }),
    importLegacy: () => action(async () => {
      if (!active || !legacyKey) throw new Error('Sign in to import browser data.');
      const token = generation.current;
      await importLegacyState(active, localStorage, legacyKey, key, schemaId, raw => JSON.parse(JSON.stringify(validate(raw))) as StateJson);
      if (token === generation.current) setLegacy(localStorage.getItem(legacyKey) !== null);
    }),
    exportRecovery: () => {
      const blob = new Blob([JSON.stringify({ legacy: legacyKey ? localStorage.getItem(legacyKey) : null,
        cache: active?.recoverySnapshot(), local: current.current }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
      link.download = `${pluginId}-recovery.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
