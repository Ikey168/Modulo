import { useState } from 'react';
import { Button } from '@/ui';
import { accountOfPartition, legacyRecoveryFile, storageFromRecoveryFile } from '../../services/legacy/legacyRecovery';
import { usePlugins } from './plugins/PluginProvider';
import { replayLegacyStorage, type ReplayResult } from './legacyReplay';
import { Panel } from './viewkit';

/**
 * Browser data that migrated into this account keeps a durable recovery copy
 * on this device. Export it, or replay an export after the browser keys were
 * retired; replay is create-only and never overwrites differing server data.
 */
export function LegacyRecoveryPanel() {
  const plugins = usePlugins();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReplayResult>();
  const account = plugins.preferences ? accountOfPartition(plugins.preferences.partition) : undefined;

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setResult(undefined);
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Recovery failed.'); }
    finally { setBusy(false); }
  };
  const download = () => run(async () => {
    if (!account) throw new Error('Sign in to export this account’s migration recovery data.');
    const file = await legacyRecoveryFile(account);
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'modulo-legacy-recovery.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const replay = (file?: File) => run(async () => {
    if (!file) return;
    if (!account) throw new Error('Sign in to the account this export belongs to.');
    const storage = storageFromRecoveryFile(JSON.parse(await file.text()), account);
    setResult(await replayLegacyStorage(storage, { workspace: plugins.workspaceState, plugin: plugins.state,
      preferences: plugins.preferences, catalog: plugins.catalog }));
  });

  return <Panel title="Browser data migration">
    <p className="text-sm text-muted-foreground">
      Data imported from this browser’s older local storage keeps a recovery copy on this device. Replaying an export only adds
      records that are missing on the server and reports anything that differs.
    </p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy || !account} onClick={() => void download()}>Download recovery file</Button>
      <label className="min-w-0 max-w-full text-sm">
        <span className="sr-only">Replay a recovery file</span>
        <input className="max-w-full" type="file" accept="application/json" disabled={busy || !account}
          onChange={event => { void replay(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="mt-2 space-y-1 text-sm">
      <p>Replayed {result.imported.length} store{result.imported.length === 1 ? '' : 's'}.</p>
      {result.skipped.map(item => <p key={item.key} className="text-muted-foreground">{item.key}: {item.reason}</p>)}
    </div>}
  </Panel>;
}
