import { usePlugins } from '../plugins/PluginProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { field, request, useAction } from '../workspaceTools/shared';
interface Status { configured: boolean; connected: boolean; email: string; searchQuery: string; enabled: boolean; lastSync: string; error: string; importedCount: number; connectionId: string }
export function GmailConnection({ onSynced }: { onSynced: () => Promise<void> }) {
  const { stateSessionKey } = usePlugins(); const session = useRef(stateSessionKey); session.current = stateSessionKey;
  const [status, setStatus] = useState<Status>(); const [failure, setFailure] = useState(''); const [query, setQuery] = useState('label:newsletters newer_than:30d');
  const [waiting, setWaiting] = useState(0); const popup = useRef<Window | null>(null); const originalConnection = useRef(''); const dirty = useRef(false); const action = useAction();
  const refresh = useCallback(async () => { try { const result = await request<Status>('/api/newsletters/gmail'); if (session.current !== stateSessionKey) return undefined; setStatus(result); if (!dirty.current) setQuery(result.searchQuery); setFailure(''); return result; } catch { if (session.current !== stateSessionKey) return undefined; setFailure('Gmail connection settings could not be loaded.'); return undefined; } }, [stateSessionKey]);
  useEffect(() => { setStatus(undefined); setFailure(''); setWaiting(0); dirty.current = false; popup.current?.close(); popup.current = null; void refresh(); const focus = () => { void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
  useEffect(() => { if (!waiting) return; let active = true; let polling = false; const timer = window.setInterval(() => {
    if (polling) return;
    if (Date.now() - waiting > 10 * 60 * 1000) { setWaiting(0); setFailure('Google sign-in timed out. Start again.'); return; }
    polling = true;
    void refresh().then(next => { if (!active) return; if (next?.connected && next.connectionId !== originalConnection.current) { setWaiting(0); popup.current?.close(); popup.current = null; } }).finally(() => { polling = false; });
  }, 2500); return () => { active = false; window.clearInterval(timer); }; }, [waiting, refresh]);
  const connect = () => {
    popup.current = window.open('about:blank', 'modulo-gmail-connect', 'width=600,height=760');
    if (!popup.current) { setFailure('Allow a popup for Modulo to connect Gmail.'); return; }
    const target = popup.current; originalConnection.current = status?.connectionId ?? '';
    void action.run(async () => { try { const result = await request<{ url: string }>('/api/newsletters/gmail/connect', {}); const url = new URL(result.url); if (url.origin !== 'https://accounts.google.com') throw new Error('Unexpected Google sign-in address.'); target.location.href = url.href; setWaiting(Date.now()); } catch (failure) { target.close(); throw failure; } });
  };
  return <section className="space-y-3 border-y border-border py-4"><h2 className="font-medium">Gmail / Google Workspace</h2>{action.alert}
    {failure && <p role="alert" className="text-sm">{failure} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}
    {!status && !failure && <p className="text-sm">Loading connection…</p>}
    {status && !status.configured && <p className="text-sm text-muted-foreground">Google sign-in needs to be configured on this Modulo server before an account can connect.</p>}
    {status?.configured && <>
      {status.connected && <p className="text-sm">Connected: {status.email} · {status.enabled ? 'Automatic sync on' : 'Sync paused'}</p>}
      {Capacitor.isNativePlatform() ? <p className="text-sm">Connect or reconnect Gmail from the Modulo website in your browser. Once connected, newsletters sync to this app too.</p> : <button className={field} disabled={action.busy || !!waiting} onClick={connect}>{waiting ? 'Waiting for Google sign-in…' : status.connected ? 'Reconnect Google account' : 'Connect Google account'}</button>}
      {waiting > 0 && <button className={field} onClick={() => { setWaiting(0); popup.current?.close(); }}>Cancel</button>}
      <p className="text-sm text-muted-foreground">Google grants read-only Gmail access. Modulo imports only messages matching your search. Saving or archiving here leaves Gmail unchanged.</p>
      {status.connected && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void action.run(async () => { await request('/api/newsletters/gmail', { query, enabled: true }, 'PUT'); dirty.current = false; await request('/api/newsletters/gmail/sync', {}); await refresh(); await onSynced(); }); }}>
        <label className="grid gap-1 text-sm">Gmail search<input className={field} value={query} onChange={event => { dirty.current = true; setQuery(event.target.value); }} required maxLength={500}/></label>
        <p className="text-xs text-muted-foreground">For example: label:newsletters newer_than:30d or category:promotions newer_than:7d. Create the Newsletters label in Gmail if you use the first search.</p>
        <div className="flex flex-wrap gap-2"><button className={field} disabled={action.busy}>Save search and sync</button><button type="button" className={field} disabled={action.busy || !status.enabled} onClick={() => void action.run(async () => { await request('/api/newsletters/gmail/sync', {}); await refresh(); await onSynced(); })}>Sync now</button>
          <button type="button" className={field} disabled={action.busy || !status.enabled} onClick={() => void action.run(async () => { await request('/api/newsletters/gmail', { query: status.searchQuery, enabled: false }, 'PUT'); await refresh(); })}>Pause sync</button>
          <button type="button" className={field} disabled={action.busy} onClick={() => void action.run(async () => { await request('/api/newsletters/gmail', {}, 'DELETE'); await refresh(); })}>Disconnect</button></div>
        <p className="text-xs text-muted-foreground">{status.importedCount} issues imported{status.lastSync ? ` · Last sync ${new Date(status.lastSync).toLocaleString()}` : ''}. Oracle checks for new issues about every 15 minutes.</p>
        {status.error && <p role="alert" className="text-sm">{status.error}</p>}
      </form>}
    </>}
  </section>;
}
