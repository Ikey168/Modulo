import { useState } from 'react';

interface StateNoticeProps {
  status: string;
  error?: string;
  conflict?: unknown;
  retry: () => Promise<void>;
  resolve: (choice: 'local' | 'remote') => Promise<void>;
}

/** Shared accessible sync controls; consumer views can place them beside their save controls. */
export function PluginStateNotice(state: StateNoticeProps) {
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setFailure(undefined);
    try { await action(); } catch (reason) { setFailure(reason instanceof Error ? reason.message : 'Synchronization failed'); }
    finally { setBusy(false); }
  };
  if (state.conflict) return <div role="alert" className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
    <span>This record changed on another device. Your local edit is preserved.</span>
    <button type="button" className="underline" disabled={busy} onClick={() => void run(() => state.resolve('local'))}>Keep local edit</button>
    <button type="button" className="underline" disabled={busy} onClick={() => void run(() => state.resolve('remote'))}>Use server version</button>
    {failure && <span role="alert">{failure}</span>}
  </div>;
  if (failure || state.status === 'offline' || state.status === 'error') return <div role="status" className="flex items-center gap-3 border-b px-4 py-2 text-sm">
    <span>{state.status === 'offline' ? 'Offline. Saved edits will sync when the connection returns.' : state.error || 'Synchronization needs attention.'}</span>
    <button type="button" className="underline" disabled={busy} onClick={() => void run(state.retry)}>Retry sync</button>
    {failure && <span role="alert">{failure}</span>}
  </div>;
  if (state.status === 'syncing') return <span role="status" className="text-sm text-muted-foreground">Syncing…</span>;
  return null;
}
