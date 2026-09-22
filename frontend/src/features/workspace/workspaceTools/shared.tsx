import { useEffect, useRef, useState } from 'react';
import { authenticatedRequest } from '../../../services/authenticatedRequest';
import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';
import { usePlugins } from '../plugins/PluginProvider';
import { PluginStateNotice } from '../plugins/PluginStateNotice';
import type { CoreNote } from '@modulo/core';

export const field = 'rounded border border-border bg-background px-3 py-2 text-sm';
export const bodyOf = (note: CoreNote) => note.markdownContent ?? note.content ?? '';
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await authenticatedRequest(path, body === undefined ? undefined : {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'Changed elsewhere. Refresh and review again.' : `Request failed (${response.status}).`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export async function replaceNote(expected: CoreNote, next: Pick<CoreNote, 'title' | 'content'>, tags = expected.tags) {
  if (!Number.isSafeInteger(expected.version)) throw new Error('Refresh this note before changing it.');
  return request<CoreNote>(`/api/notes/${expected.id}`, { ...next, markdownContent: next.content,
    version: expected.version, tagNames: tags.map(tag => tag.name) }, 'PUT');
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid or oversized text.');
  return value;
}

/** Separate account-scoped record per plugin. Await local persistence before side effects. */
export function useToolStore<T>(namespace: string, initial: T, validate: (value: unknown) => T) {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [, redraw] = useState(0);
  const current = useRef(initial);
  const queue = useRef(Promise.resolve());
  const generation = useRef({ value: 0 });
  const invalid = useRef(false);
  const initialized = useRef(false);
  const reconnect = useRef<() => Promise<void>>();
  const enabled = plugins.isEnabled(namespace);
  useEffect(() => {
    const epochState = generation.current;
    const epoch = ++epochState.value;
    let active = true; let stop: (() => void) | undefined;
    setClient(undefined); setValue(initial); current.current = initial; setError(''); invalid.current = false; initialized.current = false;
    queue.current = Promise.resolve();
    void (async () => {
      const state = await plugins.state(namespace);
      if (!active || state.status === 'closed') return;
      setClient(state);
      const refresh = () => {
        if (!active || state.status === 'closed') return;
        try {
          const entry = state.get('records');
          if (entry && !entry.deleted && (entry.schemaId !== 'workspace-tool' || entry.schemaVersion !== 1 || object(entry.value).version !== 1)) throw new Error('Unsupported record version. Export recovery data before making changes.');
          current.current = entry && !entry.deleted ? validate(object(entry.value).data) : initial;
          setValue(current.current); invalid.current = false; setError('');
        } catch (cause) { invalid.current = true; setError(String(cause)); }
        redraw(n => n + 1);
      };
      refresh(); stop = state.watch(refresh);
      const connect = async () => {
        await request(`/api/workspaces/personal/plugin-state-schemas/${namespace}/workspace-tool/1`,
          { type: 'object', required: ['version', 'data'], additionalProperties: false,
            properties: { version: { type: 'integer', enum: [1] }, data: { type: 'object' } } }, 'PUT');
        if (!active) return;
        await state.refreshAll();
        if (active) { initialized.current = true; refresh(); }
      };
      reconnect.current = connect;
      await connect();
    })().catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; stop?.(); if (epochState.value === epoch) epochState.value++; };
    // Defaults and validators are module constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, plugins.stateSessionKey, enabled]);
  const activeClient = client?.status !== 'closed' ? client : undefined;
  const save = (update: T | ((previous: T) => T), synchronize = false): Promise<void> => {
    const epoch = generation.current.value;
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current.value || !activeClient || activeClient.status === 'closed' || !initialized.current || invalid.current || activeClient.conflicts().length) throw new Error('Resolve synchronization before editing.');
      const next = validate(typeof update === 'function' ? (update as (previous: T) => T)(current.current) : update);
      if (new TextEncoder().encode(JSON.stringify(next)).length > 1000000) throw new Error('Plugin history exceeds 1 MB. Export and remove older records before saving more.');
      await activeClient.set('records', { version: 1, data: JSON.parse(JSON.stringify(next)) as StateJson }, 'workspace-tool', 1);
      if (epoch !== generation.current.value) throw new Error('The account changed. Reopen this view before continuing.');
      current.current = next; setValue(next);
      if (synchronize) {
        await activeClient.synchronize();
        if (epoch !== generation.current.value || activeClient.get('records')?.pending || activeClient.conflicts().length) throw new Error('Progress is saved locally. Resolve synchronization before continuing this operation.');
      }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  return { value, save, ready: !!activeClient && initialized.current && !invalid.current && !error && !activeClient.conflicts().length, error,
    notice: <><PluginStateNotice status={error ? 'error' : activeClient?.status ?? 'loading'} error={error || activeClient?.error}
      conflict={activeClient?.conflicts().length ? true : undefined}
      retry={async () => { if (!activeClient) throw new Error('Reload this view to reconnect.'); await reconnect.current?.(); await activeClient.synchronize(); }}
      resolve={async choice => { await activeClient?.resolve('records', choice); }} />
      {error && activeClient && <button className="text-sm underline" onClick={() => download(`${namespace}-recovery.json`, activeClient.recoverySnapshot())}>Export recovery data</button>}</> };
}

export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const locked = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { locked.current = false; setBusy(false); }
  };
  return { busy, run, error, alert: error ? <p role="alert">{error}</p> : null };
}
