import { useEffect, useReducer, useState } from 'react';
import { offlineNotes, OFFLINE_NOTES_EVENT } from '../../services/workspaceOfflineNotes';
import { authService } from '../auth/authService';
import { legacyOfflineNotesForRecovery } from '../../services/legacy/legacyOfflineNotesImport';
import { SystemBanner } from './mobile/SystemBanner';

export function OfflineNotesNotice({ refresh }: { refresh: () => Promise<void> }) {
  const [, redraw] = useReducer(n => n + 1, 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const client = offlineNotes();
  let snapshot: ReturnType<NonNullable<typeof client>['snapshot']> | undefined;
  try { snapshot = client?.snapshot(); } catch { /* Recovery remains available below. */ }
  const pending = Object.entries(snapshot?.pending ?? {});
  useEffect(() => {
    const update = () => redraw();
    const sync = () => { void offlineNotes()?.synchronize().then(() => refresh()).catch(reason => setError(String(reason))); };
    const focus = () => { const active = offlineNotes(); if (active) void active.refreshCache().then(update).catch(reason => setError(String(reason))); };
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('modulo-offline-notes');
    if (channel) channel.onmessage = event => { if (event.data === offlineNotes()?.key) focus(); };
    const stop = authService.subscribeSession?.(update);
    window.addEventListener(OFFLINE_NOTES_EVENT, update); window.addEventListener('focus', focus); window.addEventListener('online', sync);
    const timer = window.setInterval(() => { try { const active = offlineNotes(); if (active && Object.keys(active.snapshot().pending).length) sync(); } catch (reason) { setError(String(reason)); } }, 30000);
    return () => { stop?.(); channel?.close(); clearInterval(timer); window.removeEventListener(OFFLINE_NOTES_EVENT, update); window.removeEventListener('focus', focus); window.removeEventListener('online', sync); };
  }, [refresh]);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return; setBusy(true); setError('');
    try { await work(); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  if (!pending.length && !error && !client?.cacheError && (!client || snapshot)) return null;
  const conflicts = pending.filter(([, edit]) => edit.conflict || edit.error);
  return <SystemBanner tone={error || client?.cacheError ? 'alert' : 'neutral'} aria-label="Offline note synchronization" className="flex-col items-stretch">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <p className="min-w-0 flex-1">{pending.length ? `${pending.length} note edit${pending.length === 1 ? '' : 's'} saved on this device; waiting to sync.` : client?.cacheError ? 'Online notes are available, but this device could not cache them for offline use.' : 'Offline note cache needs recovery.'}</p>
    {(error || client?.cacheError) && <p role="alert" className="basis-full text-destructive">{error || client?.cacheError}</p>}
    <button className="underline" disabled={busy} onClick={() => void run(async () => client?.retry())}>Retry note sync</button><button className="underline" onClick={() => {
      const recovery = { cache: client?.snapshot() ?? null, legacy: client ? legacyOfflineNotesForRecovery(client.key) : null };
      const url = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'offline-notes-recovery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export local edits</button></div>
    {conflicts.map(([id, edit]) => <details key={id} className="mt-2 border-t border-border pt-2"><summary className="min-h-touch py-2">{edit.body.title} — {edit.error || 'Changed on the server'}</summary>
      <div className="grid gap-3 py-2 sm:grid-cols-2"><div><p>Local edit</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap">{edit.body.markdownContent ?? edit.body.content}</pre></div><div><p>Server copy</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap">{edit.conflict?.markdownContent ?? edit.conflict?.content ?? 'Retry to retrieve the server copy.'}</pre></div></div>
      <div className="flex gap-3"><button className="underline" disabled={busy || !edit.conflict} onClick={() => void run(async () => client?.resolve(Number(id), 'local'))}>Keep local edit</button><button className="underline" disabled={busy} onClick={() => void run(async () => client?.resolve(Number(id), 'remote'))}>Use server copy</button></div>
    </details>)}
  </SystemBanner>;
}
