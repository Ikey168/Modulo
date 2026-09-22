import { useEffect, useRef, useState } from 'react';
import { usePlugins } from '../plugins/PluginProvider';
import { PluginStateNotice } from '../plugins/PluginStateNotice';
import type { PluginStateClient, StateJson } from '../../../services/pluginStateClient';
import { download, request } from '../workspaceTools/shared';
import { EMPTY_NEWSLETTERS, validateNewsletters, type Newsletters } from './model';

// Each issue is a separate synchronized record, so message bodies do not all
// compete for the one-record size limit or overwrite unrelated triage edits.
export function useNewsletterStore() {
  const plugins = usePlugins(); const [client, setClient] = useState<PluginStateClient>();
  const [value, setValue] = useState(EMPTY_NEWSLETTERS); const [error, setError] = useState(''); const [ready, setReady] = useState(false);
  const epoch = useRef(0); const queue = useRef(Promise.resolve()); const connect = useRef<() => Promise<void>>();
  const enabled = plugins.isEnabled('newsletter-inbox');
  function read(state: PluginStateClient): Newsletters {
    return validateNewsletters({ items: state.list().filter(entry => entry.key.startsWith('issue-')).map(entry => {
      if (entry.schemaId !== 'newsletter' || entry.schemaVersion !== 1) throw new Error('Unsupported newsletter version. Export recovery data before editing.');
      if (entry.key !== `issue-${(entry.value as { id?: string })?.id}`) throw new Error('Newsletter ID does not match its storage key.');
      return entry.value;
    }) });
  }
  useEffect(() => {
    const generation = ++epoch.current; let disposed = false; let stop: (() => void) | undefined; let poll: number | undefined; let connected = false;
    setClient(undefined); setReady(false); setValue(EMPTY_NEWSLETTERS); setError(''); queue.current = Promise.resolve();
    void (async () => {
      const state = await plugins.state('newsletter-inbox'); if (disposed || state.status === 'closed') return;
      setClient(state);
      const refresh = () => { if (disposed || state.status === 'closed') return; try { setValue(read(state)); setReady(connected && !state.conflicts().length); setError(''); } catch (cause) { setReady(false); setError(String(cause)); } };
      stop = state.watch(refresh); refresh();
      connect.current = async () => {
        await request('/api/workspaces/personal/plugin-state-schemas/newsletter-inbox/newsletter/1', { type: 'object', required: ['id', 'title', 'sender', 'body', 'url', 'receivedAt', 'messageId', 'status'], additionalProperties: false, properties: {
          id: { type: 'string' }, title: { type: 'string', maxLength: 1000 }, sender: { type: 'string', maxLength: 1000 }, body: { type: 'string', maxLength: 200000 }, url: { type: 'string', maxLength: 4000 }, receivedAt: { type: 'string' }, messageId: { type: 'string', maxLength: 1000 }, status: { type: 'string', enum: ['Unread', 'Saved', 'Archived'] },
        } }, 'PUT');
        if (disposed) return; await state.refreshAll(); if (disposed) return; connected = true; refresh();
      };
      await connect.current();
      if (!disposed) poll = window.setInterval(() => { if (document.visibilityState !== 'hidden' && state.status !== 'closed') void state.refreshAll().catch(() => {}); }, 60000);
    })().catch(cause => { if (!disposed) setError(String(cause)); });
    return () => { disposed = true; stop?.(); if (poll) window.clearInterval(poll); if (epoch.current === generation) epoch.current++; };
    // Records and schema are fixed for this account-scoped plugin session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins.stateSessionKey, enabled]);
  const active = client?.status !== 'closed' ? client : undefined;
  const save = (update: Newsletters | ((previous: Newsletters) => Newsletters)) => {
    const generation = epoch.current;
    const operation = queue.current.then(async () => {
      const check = () => { if (generation !== epoch.current || !active || active.status === 'closed' || !ready || active.conflicts().length) throw new Error('Resolve synchronization before editing newsletters.'); };
      check(); const before = read(active!); const next = validateNewsletters(typeof update === 'function' ? update(before) : update);
      for (const item of next.items) { const previous = before.items.find(old => old.id === item.id); if (JSON.stringify(previous) !== JSON.stringify(item)) { check(); await active!.set(`issue-${item.id}`, JSON.parse(JSON.stringify(item)) as StateJson, 'newsletter', 1); } }
      for (const item of before.items) if (!next.items.some(nextItem => nextItem.id === item.id)) { check(); await active!.delete(`issue-${item.id}`); }
      check(); setValue(read(active!));
    });
    queue.current = operation.catch(() => {}); return operation;
  };
  return { value, save, refresh: async () => { if (!active) throw new Error('Newsletter storage is unavailable'); await active.refreshAll(); }, ready: !!active && ready && !error, notice: <><PluginStateNotice status={error ? 'error' : active?.status ?? 'loading'} error={error || active?.error} conflict={active?.conflicts().length ? true : undefined}
    retry={async () => { if (!active) throw new Error('Reload this view to reconnect.'); await connect.current?.(); await active.synchronize(); }}
    resolve={async choice => { if (!active) return; for (const entry of active.conflicts()) await active.resolve(entry.key, choice); }}/>
    {error && active && <button className="text-sm underline" onClick={() => download('newsletter-recovery.json', active.recoverySnapshot())}>Export recovery data</button>}</> };
}
