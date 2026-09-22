import { useEffect, useRef, useState } from 'react';
import type { CanvasState } from './canvasStore';
import { CANVAS_PLUGIN_ID } from './plugins';
import { usePlugins } from './plugins/PluginProvider';
import { emptySyncedCanvas, importLegacyCanvas, LEGACY_CANVAS_KEY, readSyncedCanvas, saveCanvasDiff } from './canvasSync';
import type { PluginStateClient } from '../../services/pluginStateClient';

export function useCanvasState() {
  const plugins = usePlugins();
  const [state, setState] = useState(emptySyncedCanvas);
  const current = useRef(state);
  const [client, setClient] = useState<PluginStateClient>();
  const [error, setError] = useState<string>();
  const [legacy, setLegacy] = useState(false);
  const [version, redraw] = useState(0);
  const queued = useRef(Promise.resolve());
  const writes = useRef(0);
  const failed = useRef<{ previous: CanvasState; next: CanvasState }[]>([]);
  const generation = useRef(0);
  const [readError, setReadError] = useState(false);
  const session = plugins.stateSessionKey;
  useEffect(() => {
    generation.current++;
    let disposed = false; let unsubscribe: (() => void) | undefined;
    current.current = emptySyncedCanvas(); setState(current.current); setClient(undefined); setError(undefined);
    queued.current = Promise.resolve(); writes.current = 0; failed.current = []; setReadError(false);
    try { setLegacy(localStorage.getItem(LEGACY_CANVAS_KEY) !== null); } catch { setLegacy(false); }
    void plugins.state(CANVAS_PLUGIN_ID).then(stateClient => {
      if (disposed) return;
      const refresh = () => {
        if (disposed || stateClient.status === 'closed') return;
        redraw(value => value + 1);
        if (writes.current || failed.current.length) return;
        try { current.current = readSyncedCanvas(stateClient); setState(current.current); }
        catch (reason) { setReadError(true); setError(reason instanceof Error ? reason.message : 'Canvas requires recovery'); }
      };
      setClient(stateClient); refresh(); unsubscribe = stateClient.watch(refresh);
    }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Canvas unavailable'); });
    return () => { disposed = true; unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const update = (next: CanvasState | ((previous: CanvasState) => CanvasState)) => {
    if (readError) return;
    if (!client || client.status === 'closed') { setError('Sign in and wait for the canvas cache to load before editing.'); return; }
    const token = generation.current;
    const previous = current.current;
    const resolved = typeof next === 'function' ? next(previous) : next;
    current.current = resolved; setState(resolved); writes.current++;
    queued.current = queued.current.then(() => saveCanvasDiff(client, previous, resolved)).catch(reason => {
      if (token !== generation.current) return;
      failed.current.push({ previous, next: resolved });
      setError(reason instanceof Error ? reason.message : 'Canvas could not be saved');
    }).finally(() => { if (token === generation.current) { writes.current--; redraw(value => value + 1); } });
  };
  const active = client?.status !== 'closed' ? client : undefined;
  const conflicts = active?.conflicts() ?? [];
  const recover = async (action: () => Promise<void>) => {
    const token = generation.current;
    try { await action(); if (token !== generation.current || active?.status === 'closed') return; setError(undefined); if (active) { current.current = readSyncedCanvas(active); setState(current.current); setReadError(false); } }
    catch (reason) { if (token === generation.current) setError(reason instanceof Error ? reason.message : 'Canvas action failed'); }
  };
  return { state, setState: update, ready: !!active && !readError, error, legacy, version,
    status: error ? 'error' : active?.status ?? 'loading', conflict: conflicts.length ? conflicts : undefined,
    retry: () => recover(async () => {
      if (!active) throw new Error('Sign in to synchronize');
      const token = generation.current;
      await queued.current;
      while (token === generation.current && failed.current.length) {
        const failure = failed.current[0]; await saveCanvasDiff(active, failure.previous, failure.next);
        if (token !== generation.current) return;
        failed.current.shift();
      }
      await active.refreshAll(); await active.synchronize();
    }),
    resolve: (choice: 'local' | 'remote') => recover(async () => {
      if (!active) return; for (const conflict of conflicts) await active.resolve(conflict.key, choice);
    }),
    importLegacy: () => recover(async () => {
      if (!active) throw new Error('Sign in to import canvas boards');
      await importLegacyCanvas(active, localStorage); setLegacy(localStorage.getItem(LEGACY_CANVAS_KEY) !== null);
    }),
    exportRecovery: () => {
      const raw = JSON.stringify({ legacy: localStorage.getItem(LEGACY_CANVAS_KEY),
        synchronized: active?.recoverySnapshot(), localDisplay: current.current }, null, 2);
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'canvas-recovery.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
