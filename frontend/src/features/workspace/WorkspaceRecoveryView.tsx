import { LegacyRecoveryPanel } from './LegacyRecoveryPanel';
import { useEffect, useState } from 'react';
import { Button } from '@/ui';
import { EmptyPanel, Panel, ViewShell } from './viewkit';
import type { WorkspaceData } from './useCoreWorkspace';
import {
  readRecovery,
  recoverEntry,
  RECOVERY_EVENT,
  type NoteRevision,
} from './workspaceRecovery';
import { WORKSPACE_STORAGE_EVENT } from './workspaceStorage';

export function WorkspaceRecoveryView({ data }: { data: WorkspaceData }) {
  const [revision, refresh] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    for (const event of ['storage', RECOVERY_EVENT, WORKSPACE_STORAGE_EVENT])
      window.addEventListener(event, update);
    return () => {
      for (const event of ['storage', RECOVERY_EVENT, WORKSPACE_STORAGE_EVENT])
        window.removeEventListener(event, update);
    };
  }, []);
  void revision;
  const history = readRecovery();
  const versions: NoteRevision[] = data.noteRevisions ?? [];
  const run = async (
    action: () => void | boolean | Promise<void | boolean>,
  ) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if ((await action()) === false)
        throw new Error(
          'Could not restore this item. Retry after resolving the save error.',
        );
      setMessage('Restored.');
      refresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recovery failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ViewShell
      title="Recovery"
      subtitle="Trash and recent changes on this device."
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <LegacyRecoveryPanel />
      <Panel title="Trash">
        {(data.trashedNotes?.length || 0) === 0 &&
          !history.some((entry) => entry.deleted) && (
            <EmptyPanel
              title="Trash is empty"
              description="Deleted notes and records appear here."
            />
          )}
        {data.trashedNotes?.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-3 border-b border-border py-3"
          >
            <span className="min-w-0 flex-1 truncate">{note.title}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => data.restoreNote?.(note.id))}
            >
              Restore note
            </Button>
          </div>
        ))}
        {history
          .filter((entry) => entry.deleted)
          .map((entry) => (
            <RecoveryRow
              key={entry.id}
              entry={entry}
              disabled={busy}
              onRestore={() => void run(() => recoverEntry(entry.id))}
            />
          ))}
      </Panel>
      <Panel title="Recent local edits and moves">
        {!history.some((entry) => !entry.deleted) && (
          <EmptyPanel
            title="No recent changes"
            description="Saved edits and note moves can be undone here."
          />
        )}
        {history
          .filter((entry) => !entry.deleted)
          .map((entry) => (
            <RecoveryRow
              key={entry.id}
              entry={entry}
              disabled={busy}
              onRestore={() => void run(() => recoverEntry(entry.id))}
            />
          ))}
      </Panel>
      <Panel title="Previous note versions">
        {versions.length === 0 && (
          <EmptyPanel
            title="No previous versions"
            description="Saving a note keeps its previous text here."
          />
        )}
        {versions.map((version) => (
          <details key={version.id} className="border-b border-border py-3">
            <summary className="cursor-pointer">
              {version.title} · {new Date(version.date).toLocaleString()}
            </summary>
            <pre className="my-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
              {version.content}
            </pre>
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy || !data.notes.some((note) => note.id === version.noteId)
              }
              onClick={() =>
                void run(() =>
                  data.updateNote(version.noteId, {
                    title: version.title,
                    content: version.content,
                    markdownContent: version.content,
                  }),
                )
              }
            >
              Restore this version
            </Button>
          </details>
        ))}
      </Panel>
    </ViewShell>
  );
}
function RecoveryRow({
  entry,
  disabled,
  onRestore,
}: {
  entry: ReturnType<typeof readRecovery>[number];
  disabled: boolean;
  onRestore: () => void;
}) {
  const titles = entry.changes.flatMap((change) => {
    try {
      const value = JSON.parse(change.before || change.after);
      const records =
        value && typeof value === 'object'
          ? Object.values(value).filter(Array.isArray).flat()
          : [];
      const after = JSON.parse(change.after);
      const next =
        after && typeof after === 'object'
          ? (Object.values(after).filter(Array.isArray).flat() as Array<{
              id?: unknown;
            }>)
          : [];
      return (records as Array<{ id?: unknown; title?: string; name?: string }>)
        .filter(
          (item) =>
            item &&
            (!entry.deleted || !next.some((record) => record?.id === item.id)),
        )
        .map((item) => item.title || item.name)
        .filter(Boolean)
        .slice(0, 3);
    } catch {
      return [];
    }
  });
  return (
    <div className="flex items-center gap-3 border-b border-border py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {titles.join(', ') ||
            (entry.changes.some((change) => change.key === 'modulo-note-tree')
              ? 'Note move'
              : 'Workspace change')}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(entry.date).toLocaleString()}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onRestore}
      >
        {entry.deleted ? 'Restore' : 'Undo'}
      </Button>
    </div>
  );
}
