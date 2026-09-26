import { useEffect, useRef, useState } from 'react';
import { usePlugins } from './PluginProvider';
import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';
import { browserLegacyRecovery, browserLegacyValue, importBrowserLegacyState } from '../../../services/legacy/legacyStateImport';
import { Capacitor } from '@capacitor/core';

type RecordOwner = { kind: 'plugin' | 'workspace'; id: string };

function useStateRecord<T>(
  owner: RecordOwner,
  key: string,
  schemaId: string,
  initial: T,
  validate: (value: unknown) => T,
  legacyKey?: string | string[],
  legacyImporter?: (client: PluginStateClient) => Promise<void>,
) {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [value, setValue] = useState(initial);
  const [loadedScope, setLoadedScope] = useState('');
  const current = useRef(initial);
  const [error, setError] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [, redraw] = useState(0);
  const generation = useRef({ value: 0 });
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(false);
  const enabled = owner.kind === 'workspace' || plugins.isEnabled(owner.id);
  const legacyKeys = legacyKey === undefined ? [] : Array.isArray(legacyKey) ? legacyKey : [legacyKey];
  const legacySignature = JSON.stringify(legacyKeys);
  const scope = JSON.stringify([plugins.stateSessionKey, owner.kind, owner.id, key, schemaId]);

  useEffect(() => {
    const epoch = generation.current;
    const token = ++epoch.value;
    let disposed = false;
    let stop: (() => void) | undefined;
    current.current = initial;
    setValue(initial);
    setClient(undefined);
    setLoadedScope('');
    setError(undefined);
    setInvalid(false);
    queue.current = Promise.resolve();
    pending.current = 0;
    failed.current = false;

    const refreshLegacy = () => {
      setLegacy(Capacitor.getPlatform() !== 'android' && legacyKeys.some(candidate => browserLegacyValue(candidate) !== null));
    };
    refreshLegacy();
    window.addEventListener('modulo:legacy-state-changed', refreshLegacy);

    const open = owner.kind === 'workspace' ? plugins.workspaceState(owner.id) : plugins.state(owner.id);
    void open.then(state => {
      if (disposed) return;
      const refresh = () => {
        if (disposed || state.status === 'closed') return;
        redraw(n => n + 1);
        if (pending.current || failed.current) return;
        try {
          const record = state.get(key);
          if (record && !record.deleted && (record.schemaId !== schemaId || record.schemaVersion !== 1)) {
            throw new Error('Unsupported record version. Export the data for recovery.');
          }
          const next = record && !record.deleted ? validate(record.value) : initial;
          current.current = next;
          setValue(next);
          setLoadedScope(scope);
          setInvalid(false);
        } catch (reason) {
          setInvalid(true);
          setError(reason instanceof Error ? reason.message : 'Invalid record');
        }
      };
      setClient(state);
      stop = state.watch(refresh);
      refresh();
    }).catch(reason => {
      if (!disposed) setError(String(reason));
    });

    return () => {
      disposed = true;
      stop?.();
      window.removeEventListener('modulo:legacy-state-changed', refreshLegacy);
      if (epoch.value === token) epoch.value++;
    };
    // Validators/defaults and state openers are immutable consumer definitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.kind, owner.id, key, schemaId, plugins.stateSessionKey, enabled, legacySignature]);

  const active = loadedScope === scope && client?.status !== 'closed' ? client : undefined;
  const save = (next: T | ((previous: T) => T)): boolean => {
    if (!active || invalid) {
      setError('Wait for a valid account cache before editing.');
      return false;
    }
    const token = generation.current.value;
    let resolved: T;
    try {
      resolved = validate(typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invalid record');
      return false;
    }
    current.current = resolved;
    setValue(resolved);
    pending.current++;
    queue.current = queue.current
      .then(() => active.set(key, JSON.parse(JSON.stringify(resolved)) as StateJson, schemaId, 1))
      .catch(reason => {
        if (generation.current.value === token) {
          failed.current = true;
          setError(String(reason));
        }
      })
      .finally(() => {
        if (generation.current.value === token) {
          pending.current--;
          redraw(n => n + 1);
        }
      });
    return true;
  };

  const action = async (work: () => Promise<void>) => {
    const token = generation.current.value;
    try {
      await work();
      if (token !== generation.current.value) return;
      setError(undefined);
      const record = active?.get(key);
      if (record && !record.deleted) {
        if (record.schemaId !== schemaId || record.schemaVersion !== 1) throw new Error('Unsupported record version.');
        current.current = validate(record.value);
        setValue(current.current);
        setInvalid(false);
      }
    } catch (reason) {
      if (token === generation.current.value) setError(String(reason));
    }
  };

  const importLegacy = () => action(async () => {
    if (Capacitor.getPlatform() === 'android' || !active || legacyKeys.length === 0) {
      throw new Error('Sign in with the original browser to import its data.');
    }
    const token = generation.current.value;
    if (legacyImporter) await legacyImporter(active);
    else {
      if (legacyKeys.length !== 1) throw new Error('This record needs a custom legacy importer.');
      await importBrowserLegacyState(
        active,
        legacyKeys[0],
        key,
        schemaId,
        raw => JSON.parse(JSON.stringify(validate(raw))) as StateJson,
      );
    }
    if (token === generation.current.value) {
      setLegacy(legacyKeys.some(candidate => browserLegacyValue(candidate) !== null));
      window.dispatchEvent(new CustomEvent('modulo:legacy-state-changed', { detail: legacyKeys }));
    }
  });

  return {
    value: loadedScope === scope ? value : initial,
    sessionKey: plugins.stateSessionKey,
    set: save,
    ready: !!active && !invalid,
    error,
    legacy,
    status: error ? 'error' : active?.status ?? 'loading',
    conflict: active?.get(key)?.conflict,
    retry: () => action(async () => {
      if (!active) throw new Error('Sign in to synchronize.');
      const token = generation.current.value;
      await queue.current;
      if (token !== generation.current.value) return;
      if (failed.current) {
        await active.set(key, JSON.parse(JSON.stringify(current.current)) as StateJson, schemaId, 1);
        failed.current = false;
      }
      await active.refreshAll();
      await active.synchronize();
    }),
    resolve: (choice: 'local' | 'remote') => action(async () => {
      if (active) await active.resolve(key, choice);
    }),
    importLegacy,
    exportRecovery: () => {
      const blob = new Blob([JSON.stringify({
        legacy: Capacitor.getPlatform() === 'android' ? null : Object.fromEntries(legacyKeys.map(candidate => [candidate, browserLegacyRecovery(candidate)])),
        cache: active?.recoverySnapshot(),
        local: current.current,
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = owner.kind + '-' + owner.id + '-recovery.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}

/** A schema-checked plugin-private record with optimistic edits and explicit browser-data claiming. */
export function useDurableRecord<T>(
  pluginId: string,
  key: string,
  schemaId: string,
  initial: T,
  validate: (value: unknown) => T,
  legacyKey?: string | string[],
  legacyImporter?: (client: PluginStateClient) => Promise<void>,
) {
  return useStateRecord({ kind: 'plugin', id: pluginId }, key, schemaId, initial, validate, legacyKey, legacyImporter);
}

/** Shared workspace-owned server state used by multiple plugins in one domain family. */
export function useWorkspaceDurableRecord<T>(
  namespace: string,
  key: string,
  schemaId: string,
  initial: T,
  validate: (value: unknown) => T,
  legacyKey?: string | string[],
  legacyImporter?: (client: PluginStateClient) => Promise<void>,
) {
  return useStateRecord({ kind: 'workspace', id: namespace }, key, schemaId, initial, validate, legacyKey, legacyImporter);
}
