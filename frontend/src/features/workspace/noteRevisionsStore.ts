import { legacyBrowserStorage } from '../../services/legacy/browserLegacyStorage';
import { decodeLegacyJson, preserveLegacySource, retireLegacySource } from '../../services/legacy/legacyStateImport';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginStateClient, StateJson, StateView } from '../../services/pluginStateClient';
import { usePlugins } from './plugins/PluginProvider';
import { NOTE_REVISIONS_KEY, type NoteRevision } from './workspaceRecovery';

/** Previous note versions, one server record per revision so long notes never hit the record size limit. */
export const NOTE_REVISIONS_NAMESPACE = 'note-revisions';
export const NOTE_REVISION_SCHEMA = 'modulo.workspace.note-revision';
export const MAX_NOTE_REVISIONS = 100;

export function parseNoteRevision(value: unknown): NoteRevision | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.noteId !== 'number' || typeof raw.date !== 'string') return undefined;
  return {
    id: raw.id,
    noteId: raw.noteId,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    date: raw.date,
  };
}

/** Newest first. */
export function revisionsFromRecords(records: Array<Pick<StateView, 'deleted' | 'schemaId' | 'value'>>): NoteRevision[] {
  return records
    .filter((record) => !record.deleted && record.schemaId === NOTE_REVISION_SCHEMA)
    .map((record) => parseNoteRevision(record.value))
    .filter((revision): revision is NoteRevision => Boolean(revision))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function addRevisions(client: PluginStateClient, revisions: NoteRevision[]): Promise<void> {
  for (const revision of revisions) {
    await client.set(revision.id, JSON.parse(JSON.stringify(revision)) as StateJson, NOTE_REVISION_SCHEMA, 1);
  }
  const overflow = revisionsFromRecords(client.list()).slice(MAX_NOTE_REVISIONS);
  for (const old of overflow) await client.delete(old.id);
}

/** Move revisions saved by older builds in this browser to the server, then drop the local copy. */
export async function importLegacyRevisions(client: PluginStateClient, storage: Storage | null = legacyBrowserStorage()): Promise<void> {
  const raw = storage?.getItem(NOTE_REVISIONS_KEY) ?? null;
  if (!storage || raw === null) return;
  const legacy = decodeLegacyJson(NOTE_REVISIONS_KEY, raw, value => {
    if (!Array.isArray(value)) throw new Error('Expected a revision list');
    return value.map(parseNoteRevision)
      .filter((revision): revision is NoteRevision => Boolean(revision) && /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/.test(revision!.id));
  });
  await preserveLegacySource(client, { [NOTE_REVISIONS_KEY]: raw });
  await client.refreshAll();
  const existing = new Set(client.list().map((record) => record.key));
  await addRevisions(client, legacy.filter((revision) => !existing.has(revision.id)));
  await client.synchronize();
  if (client.list().some((record) => record.pending || record.conflict)) return;
  retireLegacySource(storage, { [NOTE_REVISIONS_KEY]: raw });
}

export function useNoteRevisions(): { revisions: NoteRevision[]; record: (revision: NoteRevision) => void } {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [records, setRecords] = useState<StateView[]>([]);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    setClient(undefined);
    setRecords([]);
    if (!plugins.stateSessionKey) return;
    void plugins.workspaceState(NOTE_REVISIONS_NAMESPACE).then((state) => {
      if (disposed || state.status === 'closed') return;
      const refresh = () => { if (!disposed && state.status !== 'closed') setRecords(state.list()); };
      setClient(state);
      stop = state.watch(refresh);
      refresh();
      void importLegacyRevisions(state).catch(() => undefined);
    }).catch(() => undefined);
    return () => { disposed = true; stop?.(); };
    // Account identity, not provider re-renders, determines the subscription lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins.stateSessionKey]);

  const revisions = useMemo(() => revisionsFromRecords(records), [records]);
  const record = useCallback((revision: NoteRevision) => {
    if (client && client.status !== 'closed') void addRevisions(client, [revision]).catch(() => undefined);
  }, [client]);
  return { revisions, record };
}
