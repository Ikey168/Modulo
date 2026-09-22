import { useState, useSyncExternalStore } from 'react';
import { SystemBanner } from './mobile/SystemBanner';
import {
  subscribeWorkspaceLegacy,
  workspaceLegacyRevision,
  workspaceLegacySources,
} from './workspaceLegacyMigration';

export function WorkspaceLegacyStateNotice() {
  useSyncExternalStore(subscribeWorkspaceLegacy, workspaceLegacyRevision, () => 0);
  const sources = workspaceLegacySources();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!sources.length) return null;

  const importAll = async () => {
    setBusy(true);
    setError(undefined);
    try {
      for (const source of sources) await source.importLegacy();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Legacy data import failed.');
    } finally {
      setBusy(false);
    }
  };

  return <SystemBanner tone={error ? 'alert' : 'neutral'} aria-label="Workspace data migration">
    <span className="min-w-0 flex-1">
      Browser-only data is available for {sources.map(source => source.label).join(', ')}.
      Import it explicitly to make the server copy authoritative.
    </span>
    <button type="button" disabled={busy} onClick={() => void importAll()}>
      {busy ? 'Importing…' : 'Import into this account'}
    </button>
    <button type="button" disabled={busy} onClick={() => sources.forEach(source => source.exportRecovery())}>
      Export recovery
    </button>
    {error && <span role="alert" className="basis-full">{error}</span>}
  </SystemBanner>;
}
