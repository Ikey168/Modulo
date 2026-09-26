import { useState } from 'react';
import { Button } from '@/ui';
import { authenticatedRequest } from '../../services/authenticatedRequest';
import { usePlugins } from './plugins/PluginProvider';
import { exportWorkspaceState, parseWorkspaceBackup, restoreWorkspaceState, type RestoreReport, type WorkspaceBackup } from './fullBackup';
import { Panel } from './viewkit';

async function accountNamespaces(): Promise<string[]> {
  const response = await authenticatedRequest('/api/workspaces/personal/plugin-state');
  if (!response.ok) throw new Error('The server did not list this account’s data. Check the connection and try again.');
  const rows = await response.json() as Array<{ namespace: string }>;
  return rows.map(row => row.namespace);
}

/**
 * Full workspace backup (#496): every plugin record of this account in one
 * file, restorable on any device. Restore adds and updates; removing records
 * that are not in the backup is a separate, explicit choice.
 */
export function FullBackupPanel() {
  const plugins = usePlugins();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<WorkspaceBackup>();
  const [replace, setReplace] = useState(false);
  const [report, setReport] = useState<RestoreReport>();

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Backup failed.'); }
    finally { setBusy(false); }
  };
  const download = () => run(async () => {
    const backup = await exportWorkspaceState(await accountNamespaces(), plugins.backupState);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `modulo-workspace-${backup.exportedAt.slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const choose = (file?: File) => run(async () => {
    setReport(undefined); setPending(undefined);
    if (!file) return;
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON.'); }
    setPending(parseWorkspaceBackup(raw));
  });
  const restore = () => run(async () => {
    if (!pending) return;
    setReport(await restoreWorkspaceState(pending, plugins.backupState, { replace }));
    setPending(undefined);
  });
  const count = pending ? Object.values(pending.namespaces).reduce((total, records) => total + records.length, 0) : 0;

  return <Panel title="Full workspace backup">
    <p className="text-sm text-muted-foreground">
      Every plugin record of this account, across all plugins, in one JSON file. Restore it on any device signed in to a Modulo
      account; records are written through normal synchronization and verified on the server. Notes and attachments are backed
      up by the server; use the note export for Markdown copies.
    </p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}>Download backup</Button>
      <label className="min-w-0 max-w-full text-sm">
        <span className="sr-only">Choose a workspace backup to restore</span>
        <input className="max-w-full" type="file" accept="application/json" disabled={busy}
          onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
    </div>
    {pending && <div className="mt-3 space-y-2 rounded-md border border-border p-3 text-sm">
      <p>Backup from {new Date(pending.exportedAt).toLocaleString()}: {count} records in {Object.keys(pending.namespaces).length} plugins.</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={replace} onChange={event => setReplace(event.target.checked)} />
        <span>Also delete records that are not in the backup (only in the plugins it contains).</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void restore()}>{busy ? 'Restoring…' : 'Restore'}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(undefined)}>Cancel</Button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {report && <div role="status" className="mt-2 space-y-1 text-sm">
      <p>Restored: {report.written} written, {report.unchanged} already up to date{report.removed ? `, ${report.removed} removed` : ''}.</p>
      {report.skipped.map(item => <p key={item.namespace} className="text-muted-foreground">{item.namespace}: {item.reason}</p>)}
    </div>}
  </Panel>;
}
