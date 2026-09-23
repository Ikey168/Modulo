import { useEffect, useState } from 'react';
import { usePlugins } from '../PluginProvider';
import { usePluginState } from '../usePluginState';
import type { PluginStateClient, StateJson, StateView } from '../../../../services/pluginStateClient';
import { intakeCall } from './noesisIntakeApi';

const PLUGIN_ID = 'flashcards-spaced-repetition';
const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
type RecordValue = Record<string, StateJson>;
type PluginRecord = { record_id: string; authoritative_version: number; schema_id: string;
  schema_version: number; fields: string[]; relation_ids: string[]; attachment_ids: string[];
  content_sha256: string; source_locator: RecordValue | null; metadata_gaps?: string[] };
type MigrationInventory = { workspace_id: string; account_id: string; observed_at_ms: number;
  source: 'caller_supplied_plugin_state'; plugins: { plugin_id: string; installed_version: string | null;
    collections: { collection: string; schema_id: string; schema_version: number;
      persistence: 'authenticated_plugin_state'; records: PluginRecord[] }[] }[] };
type PreviewRecord = { plugin_id: string; collection: string; record_id: string;
  authoritative_version: number; content_sha256: string; action: string; requires_review: boolean;
  schema_id?: string; schema_version?: number; relation_ids?: string[]; attachment_ids?: string[];
  source_locator?: RecordValue | null; unsupported_fields?: string[]; metadata_gaps?: string[] };
type Preview = { preview_id: string; counts: { records: number; legacy_import_required: number;
  review_required: number; link_in_place: number }; records: PreviewRecord[]; next_offset: number | null };
type SourceValue = { plugin_id: string; collection: string; record_id: string;
  authoritative_version: number; content_sha256: string; value: RecordValue; mastery_criterion: string };
type PendingPreview = { request_key: string; inventory: MigrationInventory };
type PendingImport = { preview_id: string; request_key: string; title: string; source_values: SourceValue[] };
type LocalState = { namespace: string; preview_id?: string; preview_request?: PendingPreview;
  import_request?: PendingImport; imported_pack_id?: string };
type SourceCollection = { collection: string; schema_id: string; schema_version: number;
  persistence: 'authenticated_plugin_state'; records: PluginRecord[] };

function canonical(value: StateJson): string {
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function sha256(value: StateJson): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function objectValue(value: StateJson | undefined): RecordValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}

function stringList(value: StateJson | undefined, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim()))
    throw new Error(`${field} must be an array of nonempty IDs.`);
  return value as string[];
}

function sourceLocator(value: StateJson | undefined): RecordValue | null {
  if (value === undefined || value === null) return null;
  const locator = objectValue(value);
  if (!locator || Object.keys(locator).some(key => !['url', 'page', 'start', 'end', 'section'].includes(key)))
    throw new Error('A source locator has unsupported fields.');
  return locator;
}

async function buildInventory(client: PluginStateClient, installedVersion: string | null): Promise<MigrationInventory> {
  await client.refreshAll();
  if (client.status === 'offline' || client.status === 'error' || client.status === 'conflict' || client.conflicts().length)
    throw new Error('The flashcard plugin state is not synchronized. Resolve its offline or conflict state first.');
  const stateRows = client.list();
  if (stateRows.length > 1000) throw new Error('This preview is limited to 1,000 plugin records.');
  if (stateRows.some(row => row.pending || row.conflict))
    throw new Error('Sync pending flashcard edits and resolve conflicts before previewing migration.');
  const partition = JSON.parse(client.partition) as unknown;
  if (!Array.isArray(partition) || partition.length < 4 ||
      partition.slice(1, 4).some(item => typeof item !== 'string' || !item))
    throw new Error('The signed-in Modulo workspace identity is unavailable.');
  const [issuer, subject, workspace] = partition.slice(1, 4) as string[];
  const accountId = await sha256(JSON.stringify([issuer, subject]));
  const schemas = new Map<string, SourceCollection>();
  const remoteByKey = new Map(client.recoverySnapshot().entries.map(entry => [entry.key, entry.remote]));
  for (const row of stateRows) {
    const schemaId = row.schemaId;
    const schemaVersion = row.schemaVersion;
    const remoteVersion = remoteByKey.get(row.key)?.version;
    if (!schemaId || typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)
        || typeof remoteVersion !== 'number' || !Number.isInteger(remoteVersion) || !row.value)
      throw new Error(`Plugin record ${row.key} has no authoritative schema or value.`);
    const fields = objectValue(row.value) ? Object.keys(objectValue(row.value)!).sort() : [];
    const value = objectValue(row.value);
    const relations = stringList(value?.relation_ids, 'relation_ids');
    const attachments = stringList(value?.attachment_ids, 'attachment_ids');
    const locator = sourceLocator(value?.source_locator);
    const metadataGaps = ['collection'];
    if (!value || !('relation_ids' in value)) metadataGaps.push('relation_ids');
    if (!value || !('attachment_ids' in value)) metadataGaps.push('attachment_ids');
    if (!value || !('source_locator' in value)) metadataGaps.push('source_locator');
    const identity = `${row.schemaId}\u0000${row.schemaVersion}`;
    const collection = schemas.get(identity) ?? { collection: 'unclassified', schema_id: schemaId,
      schema_version: schemaVersion, persistence: 'authenticated_plugin_state' as const, records: [] };
    schemas.set(identity, collection);
    collection.records.push({ record_id: row.key, authoritative_version: remoteVersion,
      schema_id: schemaId, schema_version: schemaVersion, fields,
      relation_ids: relations, attachment_ids: attachments, source_locator: locator,
      content_sha256: await sha256(row.value), metadata_gaps: metadataGaps });
  }
  const inventory: MigrationInventory = {
    workspace_id: workspace, account_id: accountId, observed_at_ms: Date.now(),
    source: 'caller_supplied_plugin_state',
      plugins: [{ plugin_id: PLUGIN_ID, installed_version: installedVersion,
      collections: [...schemas.values()] }],
  };
  if (new TextEncoder().encode(JSON.stringify(inventory)).length > 900_000)
    throw new Error('The inventory is too large for one safe preview. Reduce the plugin record count and retry.');
  return inventory;
}

/** Metadata preview and explicit card-by-card import from the authenticated Modulo plugin state. */
export function NoesisFlashcardMigrationView({ namespace, available }: {
  namespace: string; available: boolean;
}) {
  const plugins = usePlugins();
  const enabled = plugins.isEnabled(PLUGIN_ID);
  const local = usePluginState<LocalState>('information-intake', 'practice-migration.last',
    { namespace }, 'modulo.intake.practice-migration');
  const activeLocal = local.value.namespace === namespace ? local.value : { namespace };
  const [source, setSource] = useState<PluginStateClient>();
  const [preview, setPreview] = useState<Preview>();
  const [records, setRecords] = useState<PreviewRecord[]>([]);
  const [previewRecords, setPreviewRecords] = useState<{ previewId: string; records: PreviewRecord[] }>({
    previewId: '', records: [],
  });
  const [sourceRows, setSourceRows] = useState<StateView[]>([]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('Imported Modulo flashcards');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [importedPack, setImportedPack] = useState<string>();

  useEffect(() => {
    let active = true;
    setSource(undefined); setError(undefined); setPreview(undefined); setRecords([]);
    if (!enabled) return () => { active = false; };
    void plugins.state(PLUGIN_ID).then(client => { if (active) setSource(client); })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [enabled, plugins.stateSessionKey]);

  const inspectPage = async (previewId: string, pageOffset: number) => {
    const page = await intakeCall<Preview>('inspect_modulo_intake_migration', {
      namespace, preview_id: previewId, limit: 100, offset: pageOffset,
    });
    setPreview(page); setRecords(page.records); setOffset(pageOffset);
    setPreviewRecords(current => {
      const byId = new Map((current.previewId === previewId ? current.records : [])
        .map(record => [record.record_id, record]));
      page.records.forEach(record => byId.set(record.record_id, record));
      return { previewId, records: [...byId.values()] };
    });
  };

  useEffect(() => {
    if (!available || !activeLocal.preview_id || activeLocal.preview_request) return;
    void inspectPage(activeLocal.preview_id, 0).catch(cause => setError(String(cause)));
  // The preview is immutable; reload it when namespace or saved preview changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, activeLocal.preview_id, activeLocal.preview_request, namespace]);

  useEffect(() => {
    if (activeLocal.imported_pack_id) setImportedPack(activeLocal.imported_pack_id);
  }, [activeLocal.imported_pack_id]);

  const requestPreview = async () => {
    if (!source || !available || !local.ready || local.conflict) return;
    setBusy(true); setError(undefined); setImportedPack(undefined);
    try {
      let pending = activeLocal.preview_request;
      if (!pending) {
        setPreview(undefined); setRecords([]); setPreviewRecords({ previewId: '', records: [] });
        setSelected([]); setCriteria({});
        const inventory = await buildInventory(source, null);
        pending = { request_key: `modulo-flashcard-preview-${crypto.randomUUID()}`, inventory };
        await local.set({ ...activeLocal, preview_request: pending, imported_pack_id: undefined });
        await local.retry();
      }
      const result = await intakeCall<Preview>('preview_modulo_intake_migration', {
        namespace, request_key: pending.request_key, inventory: pending.inventory, mappings: [],
      });
      await local.set({ namespace, preview_id: result.preview_id });
      await local.retry();
      await inspectPage(result.preview_id, 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const toggle = (recordId: string) => setSelected(current => current.includes(recordId)
    ? current.filter(identity => identity !== recordId)
    : current.length >= 20 ? current : [...current, recordId]);

  const importSelected = async () => {
    if (!source || !preview?.preview_id || !selected.length || !local.ready || local.conflict) return;
    setBusy(true); setError(undefined);
    try {
      let request = activeLocal.import_request;
      if (!request) {
        if (!title.trim()) throw new Error('Give the imported pack a title.');
        const sourceById = new Map(sourceRows.filter(row => !row.deleted).map(row => [row.key, row]));
        const sourceValues: SourceValue[] = [];
        for (const recordId of selected) {
          const previewRecord = previewRecords.previewId === preview.preview_id
            ? previewRecords.records.find(item => item.record_id === recordId) : undefined;
          const row = sourceById.get(recordId);
          const value = objectValue(row?.value);
          const masteryCriterion = criteria[recordId]?.trim();
          if (!previewRecord || !row || !value || !masteryCriterion)
            throw new Error(`Select a current flashcard and add a mastery criterion for ${recordId}.`);
          if (!('question' in value || 'prompt' in value) || typeof value.answer !== 'string')
            throw new Error(`Record ${recordId} does not expose a supported question/prompt and answer.`);
          const remoteVersion = source.recoverySnapshot().entries.find(entry => entry.key === recordId)?.remote?.version;
          const digest = await sha256(row.value!);
          if (typeof remoteVersion !== 'number' || remoteVersion !== previewRecord.authoritative_version
              || digest !== previewRecord.content_sha256)
            throw new Error(`Flashcard ${recordId} changed after preview. Refresh the preview before importing.`);
          sourceValues.push({ plugin_id: PLUGIN_ID, collection: previewRecord.collection,
            record_id: recordId, authoritative_version: remoteVersion,
            content_sha256: digest, value, mastery_criterion: masteryCriterion });
        }
        const valuesBytes = new TextEncoder().encode(JSON.stringify(sourceValues)).length;
        if (valuesBytes > 220_000) throw new Error('Select fewer cards; this import must fit one bounded request.');
        request = { preview_id: preview.preview_id,
          request_key: `modulo-flashcard-import-${crypto.randomUUID()}`,
          title: title.trim(), source_values: sourceValues };
        await local.set({ ...activeLocal, import_request: request });
        await local.retry();
      }
      const result = await intakeCall<Record<string, unknown>>('import_modulo_flashcards', {
        namespace, preview_id: request.preview_id, request_key: request.request_key,
        title: request.title, source_values: request.source_values,
      });
      const packId = typeof result.pack_id === 'string' ? result.pack_id : 'created';
      await local.set({ namespace, preview_id: request.preview_id, imported_pack_id: packId });
      await local.retry();
      setImportedPack(packId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!source || !available || !preview?.preview_id) return;
    let active = true;
    void source.refreshAll().then(() => {
      if (active) setSourceRows(source.list());
    }).catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [available, preview?.preview_id, source]);

  const pendingImport = activeLocal.import_request;
  const canImport = !!preview?.preview_id && selected.length > 0 && !busy && available && !!source
    && !local.conflict && selected.every(identity => !!criteria[identity]?.trim());
  return <section className="space-y-3 border-b border-border pb-5">
    <div><h2 className="font-semibold">Import Modulo flashcards</h2>
      <p className="text-sm text-muted-foreground">Review a metadata-only snapshot, then select cards to copy into a native Noesis practice pack.</p></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {local.conflict && <p role="alert">Resolve the Information Intake plugin-state conflict before continuing.</p>}
    {!available && <p role="status">Connect to the Noesis intake service to preview or import plugin state.</p>}
    {!enabled && <p className="text-sm">Enable the installed <code>{PLUGIN_ID}</code> plugin to inventory its signed-in state.</p>}
    {enabled && <button type="button" className={buttonClass} disabled={busy || !available || !source || !local.ready || !!local.conflict}
      onClick={() => void requestPreview()}>{activeLocal.preview_request ? 'Retry saved preview' : 'Preview plugin state'}</button>}
    {preview && <div className="space-y-2">
      <p role="status" className="text-sm">Preview {preview.preview_id}: {preview.counts.records} records ·
        {' '}{preview.counts.review_required} need mapping/review · {preview.counts.legacy_import_required} legacy records.</p>
      <label className="grid gap-1 text-sm">Noesis pack title<input className={fieldClass} value={title}
        onChange={event => setTitle(event.target.value)} /></label>
      <div className="space-y-2">
        {records.map(record => {
          const row = sourceRows.find(item => item.key === record.record_id);
          const value = objectValue(row?.value);
          const importable = !!value && (typeof value.question === 'string' || typeof value.prompt === 'string')
            && typeof value.answer === 'string';
          return <div key={`${record.plugin_id}:${record.collection}:${record.record_id}`}
            className="rounded-md border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" disabled={!importable || busy || (selected.length >= 20 && !selected.includes(record.record_id))}
                checked={selected.includes(record.record_id)} onChange={() => toggle(record.record_id)} />
              <span>{String(value?.question ?? value?.prompt ?? record.record_id)} · source v{record.authoritative_version}
                {!importable && <span className="text-muted-foreground"> · unsupported flashcard shape</span>}</span>
            </label>
            <dl className="mt-2 grid gap-1 pl-6 text-xs text-muted-foreground">
              <div><dt className="inline font-medium">Schema: </dt><dd className="inline">{record.schema_id ?? 'unknown'}
                {record.schema_version ? ` v${record.schema_version}` : ''}</dd></div>
              <div><dt className="inline font-medium">Relations: </dt><dd className="inline">
                {record.relation_ids?.length ? record.relation_ids.join(', ')
                  : record.metadata_gaps?.includes('relation_ids') ? 'unknown' : 'none supplied'}</dd></div>
              <div><dt className="inline font-medium">Attachments: </dt><dd className="inline">
                {record.attachment_ids?.length ? record.attachment_ids.join(', ')
                  : record.metadata_gaps?.includes('attachment_ids') ? 'unknown' : 'none supplied'}</dd></div>
              <div><dt className="inline font-medium">Source locator: </dt><dd className="inline">
                {record.source_locator ? Object.entries(record.source_locator).map(([key, item]) => `${key}=${String(item)}`).join(' · ')
                  : record.metadata_gaps?.includes('source_locator') ? 'unknown' : 'none supplied'}</dd></div>
              {!!record.unsupported_fields?.length && <div><dt className="inline font-medium">Unsupported fields: </dt>
                <dd className="inline">{record.unsupported_fields.join(', ')}</dd></div>}
              {!!record.metadata_gaps?.length && <div><dt className="inline font-medium">Metadata gaps: </dt>
                <dd className="inline">{record.metadata_gaps.join(', ')}</dd></div>}
            </dl>
            {selected.includes(record.record_id) && <label className="mt-2 grid gap-1 text-xs">Mastery criterion
              <input className={fieldClass} value={criteria[record.record_id] ?? ''}
                onChange={event => setCriteria(current => ({ ...current, [record.record_id]: event.target.value }))} />
            </label>}
            {record.requires_review && <p className="mt-1 pl-6 text-xs text-muted-foreground">Review this source-to-card mapping before import; original state remains unchanged.</p>}
          </div>;
        })}
      </div>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} disabled={busy || offset === 0}
          onClick={() => void inspectPage(preview.preview_id, Math.max(0, offset - 100))}>Previous</button>
        <button type="button" className={buttonClass} disabled={busy || preview.next_offset === null}
          onClick={() => preview.next_offset !== null && void inspectPage(preview.preview_id, preview.next_offset)}>Next</button>
      </div>
      {pendingImport && <p role="status">An import may already have completed. Retry uses its exact saved IDs, hashes, history, and scheduler values.</p>}
      <button type="button" className={buttonClass} disabled={!pendingImport && !canImport}
        onClick={() => void importSelected()}>{pendingImport ? 'Retry saved import' : `Import selected (${selected.length})`}</button>
      {importedPack && <p role="status">Noesis practice pack {importedPack} imported. Original Modulo cards were not changed or deleted.</p>}
      <p className="text-xs text-muted-foreground">The import preserves source review history and schedule parameters as provenance. Schedule conversion and mastery need separate review.</p>
    </div>}
  </section>;
}
