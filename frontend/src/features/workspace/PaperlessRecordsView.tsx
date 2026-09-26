import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileLock2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type { PluginStateClient, StateJson, StateView } from '../../services/pluginStateClient';
import { usePlugins } from './plugins/PluginProvider';
import { useParaStore } from './useParaStore';
import { newParaId } from './para';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui';
import {
  PAPERLESS_ACTION_SCHEMA, PAPERLESS_DOCUMENT_SCHEMA, PAPERLESS_SETTINGS_SCHEMA,
  filterPaperlessDocuments, isPaperlessHealthStale, paperlessDocumentUrl,
  parsePaperlessDocument, parsePaperlessHealth, type PaperlessDocument, type PaperlessFilters,
} from './paperless';

const inputClass = 'h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground/40';
const buttonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50';
const tabs = ['Register', 'Retention & expiry', 'Business & compliance', 'Sync'] as const;
type Tab = typeof tabs[number];

function useNamespace(id: string) {
  const plugins = usePlugins();
  const [client, setClient] = useState<PluginStateClient>();
  const [records, setRecords] = useState<StateView[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true; let stop: (() => void) | undefined;
    void plugins.state(id).then(async state => {
      if (!live) return;
      setClient(state);
      const update = () => { if (live && state.status !== 'closed') setRecords(state.list()); };
      stop = state.watch(update); update();
      await state.refreshAll(); update();
    }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { live = false; stop?.(); };
  }, [id, plugins.stateSessionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { client, records, error };
}

function dateLabel(value: string) {
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Never';
}

function unique(values: (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

function SelectFilter({ value, label, values, onChange }: { value: string; label: string; values: string[]; onChange: (value: string) => void }) {
  const allValue = '__all__';
  return <Select value={value || allValue} onValueChange={next => onChange(next === allValue ? '' : next)}>
    <SelectTrigger aria-label={label} className={inputClass}><SelectValue placeholder={`All ${label.toLocaleLowerCase()}`} /></SelectTrigger>
    <SelectContent>
      <SelectItem value={allValue}>All {label.toLocaleLowerCase()}</SelectItem>
      {values.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
    </SelectContent>
  </Select>;
}

export function PaperlessRecordsView() {
  const paperless = useNamespace('paperless');
  const actions = useNamespace('paperless-actions');
  const [para, persistPara] = useParaStore();
  const [tab, setTab] = useState<Tab>('Register');
  const [selected, setSelected] = useState<number>();
  const [notice, setNotice] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://paperless.zt');
  const [staleAfterMinutes, setStaleAfterMinutes] = useState(15);
  const [filters, setFilters] = useState<PaperlessFilters>({ query: '', classification: '', correspondent: '', tag: '', year: '', status: '' });

  useEffect(() => {
    const record = paperless.records.find(item => item.key === 'settings' && !item.deleted);
    const value = typeof record?.value === 'object' && record.value !== null ? record.value as Record<string, unknown> : undefined;
    if (typeof value?.baseUrl === 'string') setBaseUrl(value.baseUrl);
    if (typeof value?.staleAfterMinutes === 'number') setStaleAfterMinutes(Math.max(5, Math.min(10080, value.staleAfterMinutes)));
  }, [paperless.records]);

  const documents = useMemo(() => paperless.records
    .filter(record => record.schemaId === PAPERLESS_DOCUMENT_SCHEMA && !record.deleted)
    .map(record => parsePaperlessDocument(record.value)).filter((record): record is PaperlessDocument => Boolean(record)), [paperless.records]);
  const health = useMemo(() => parsePaperlessHealth(paperless.records.find(record => record.key === 'sync-health')?.value), [paperless.records]);
  const visible = useMemo(() => filterPaperlessDocuments(documents, filters), [documents, filters]);
  const active = documents.find(document => document.paperlessId === selected);
  const stale = isPaperlessHealthStale(health, staleAfterMinutes);
  const due = documents.filter(document => document.retentionUntil || document.expiryDate)
    .sort((a, b) => (a.expiryDate || a.retentionUntil).localeCompare(b.expiryDate || b.retentionUntil));
  const business = documents.filter(document => document.business && Object.values(document.business).some(Boolean));
  const setFilter = (key: keyof PaperlessFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));

  const saveSettings = async () => {
    if (!paperless.client || !paperlessDocumentUrl(baseUrl, 1)) { setNotice('Enter a valid HTTP or HTTPS Paperless address.'); return; }
    await paperless.client.set('settings', { baseUrl: baseUrl.replace(/\/$/, ''), staleAfterMinutes } as StateJson, PAPERLESS_SETTINGS_SCHEMA, 1);
    setNotice('Records settings saved.');
  };

  const queueAction = async (document: PaperlessDocument, kind: string, payload: Record<string, StateJson> = {}) => {
    if (!actions.client) return;
    const id = crypto.randomUUID();
    const destructive = kind === 'deletion.propose';
    if (destructive && !window.confirm('Record a deletion proposal? The sync identity cannot delete the document; final deletion stays in Paperless.')) return;
    await actions.client.create(`action-${id}`, {
      id, paperlessId: document.paperlessId, kind, status: destructive ? 'approved' : 'queued',
      requestedAt: new Date().toISOString(), requestedBy: 'modulo-owner', confirmed: true,
      payload, processedAt: '', result: '',
    } as StateJson, PAPERLESS_ACTION_SCHEMA, 1);
    setNotice(destructive ? 'Deletion proposal queued for human review.' : 'Write-back queued.');
  };

  const createReviewTask = async (document: PaperlessDocument, dueDate?: string) => {
    const id = newParaId('task');
    const reference = { pluginId: 'paperless', entityType: 'document', entityId: String(document.paperlessId) };
    const title = document.restrictedStub ? `Review restricted Paperless record #${document.paperlessId}` : `Review ${document.title || `Paperless record #${document.paperlessId}`}`;
    const saved = persistPara({ ...para, tasks: [...para.tasks, {
      id, title, status: dueDate ? 'Scheduled' as const : 'Next' as const, priority: 'P2' as const,
      energy: 'Low' as const, context: `paperless:${document.paperlessId}`, doDate: dueDate || undefined,
      deadline: dueDate || undefined, externalRefs: [reference],
    }] });
    if (!saved || !paperless.client) { setNotice('Could not create the PARA task yet.'); return; }
    const record = paperless.records.find(item => item.key === `document-${document.paperlessId}`);
    const current = parsePaperlessDocument(record?.value);
    if (current) await paperless.client.set(`document-${document.paperlessId}`, {
      ...current, paraLinks: { ...current.paraLinks, tasks: [...new Set([...current.paraLinks.tasks, id])] },
    } as unknown as StateJson, PAPERLESS_DOCUMENT_SCHEMA, 1);
    setNotice(dueDate ? 'Expiry reminder added to PARA and Planner.' : 'Review task linked in PARA.');
  };

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paperless-ngx</p>
        <h1 className="mt-1 text-xl font-semibold">Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">Metadata and links only. Documents remain in your home vault.</p>
      </div>
      <div className={`flex items-center gap-2 text-xs ${stale ? 'text-warning' : 'text-success'}`}>
        {stale ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
        {stale ? 'Sync needs attention' : `Synced ${dateLabel(health?.lastSuccess ?? '')}`}
      </div>
    </header>

    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Records sections">
      {tabs.map(item => <button key={item} type="button" onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === item ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item}</button>)}
    </nav>

    {(paperless.error || actions.error) && <div className="border-l-2 border-destructive px-3 py-2 text-sm text-destructive">{paperless.error || actions.error}</div>}
    {notice && <div className="flex items-center justify-between border-l-2 border-foreground/30 px-3 py-2 text-sm"><span>{notice}</span><button type="button" onClick={() => setNotice('')} className="text-muted-foreground">Dismiss</button></div>}

    {tab === 'Register' && <>
      <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(110px,auto))]">
        <label className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search records" className={`${inputClass} w-full pl-8`} value={filters.query} onChange={event => setFilter('query', event.target.value)} placeholder="Search metadata" /></label>
        <SelectFilter label="Classifications" value={filters.classification} values={unique(documents.map(item => item.classification))} onChange={value => setFilter('classification', value)} />
        <SelectFilter label="Correspondents" value={filters.correspondent} values={unique(documents.map(item => item.correspondent))} onChange={value => setFilter('correspondent', value)} />
        <SelectFilter label="Tags" value={filters.tag} values={unique(documents.flatMap(item => item.tags ?? []))} onChange={value => setFilter('tag', value)} />
        <SelectFilter label="Years" value={filters.year} values={unique(documents.map(item => item.year ? String(item.year) : undefined))} onChange={value => setFilter('year', value)} />
        <SelectFilter label="Statuses" value={filters.status} values={unique(documents.map(item => item.status))} onChange={value => setFilter('status', value)} />
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Record</th><th className="hidden px-3 py-2 font-medium sm:table-cell">Class</th><th className="hidden px-3 py-2 font-medium md:table-cell">Correspondent</th><th className="px-3 py-2 font-medium">Status</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-border">{visible.map(document => <tr key={document.paperlessId} className="hover:bg-muted/20">
            <td className="px-3 py-2.5"><button type="button" onClick={() => setSelected(current => current === document.paperlessId ? undefined : document.paperlessId)} className="flex min-w-0 items-center gap-2 text-left font-medium"><span className="text-muted-foreground">#{document.paperlessId}</span>{document.restrictedStub && <FileLock2 className="size-4 shrink-0" />}<span className="truncate">{document.restrictedStub ? 'Restricted record' : document.title || 'Untitled record'}</span></button></td>
            <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{document.classification}</td><td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">{document.restrictedStub ? '—' : document.correspondent || '—'}</td><td className="px-3 py-2.5 text-muted-foreground">{document.deleted ? 'Missing' : document.status}</td>
            <td className="px-3 py-2.5">{paperlessDocumentUrl(baseUrl, document.paperlessId) && <a aria-label={`Open record ${document.paperlessId} in Paperless`} href={paperlessDocumentUrl(baseUrl, document.paperlessId)} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>}</td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No records match these filters.</p>}
      </div>
      {active && <RecordDetails document={active} baseUrl={baseUrl} onReview={() => void createReviewTask(active)} onDelete={() => void queueAction(active, 'deletion.propose')} onAction={(kind, payload) => void queueAction(active, kind, payload)} />}
    </>}

    {tab === 'Retention & expiry' && <div className="divide-y divide-border rounded-md border border-border">{due.map(document => {
      const date = document.expiryDate || document.retentionUntil;
      return <div key={document.paperlessId} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_150px_auto] sm:items-center"><div><a className="text-sm font-medium hover:underline" href={paperlessDocumentUrl(baseUrl, document.paperlessId)} target="_blank" rel="noreferrer">{document.restrictedStub ? `Restricted record #${document.paperlessId}` : document.title || `Record #${document.paperlessId}`} <ExternalLink className="inline size-3" /></a><div className="text-xs text-muted-foreground">{document.retentionClass || 'Expiry review'}{document.retentionReason ? ` · ${document.retentionReason}` : ''}</div></div><time className="text-sm">{date}</time><button className={buttonClass} onClick={() => void createReviewTask(document, date)}>Add reminder</button></div>;
    })}{!due.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No retention or expiry dates are currently indexed.</p>}</div>}

    {tab === 'Business & compliance' && <div className="overflow-hidden rounded-md border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Record</th><th className="px-3 py-2 font-medium">Direction</th><th className="px-3 py-2 font-medium">E-invoice</th><th className="px-3 py-2 font-medium">Evidence</th></tr></thead><tbody className="divide-y divide-border">{business.map(document => <tr key={document.paperlessId}><td className="px-3 py-2.5"><a className="font-medium hover:underline" href={paperlessDocumentUrl(baseUrl, document.paperlessId)} target="_blank" rel="noreferrer">{document.title || `#${document.paperlessId}`} <ExternalLink className="inline size-3" /></a></td><td className="px-3 py-2.5 text-muted-foreground">{document.business?.invoiceDirection || '—'}</td><td className="px-3 py-2.5 text-muted-foreground">{document.business?.eInvoiceStatus || '—'}</td><td className="px-3 py-2.5 text-muted-foreground">{document.business?.evidenceType || '—'}</td></tr>)}</tbody></table>{!business.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No business compliance metadata is indexed.</p>}</div>}

    {tab === 'Sync' && <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-md border border-border"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Agent health</h2></div><dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
        <dt className="text-muted-foreground">Last incremental</dt><dd>{dateLabel(health?.lastIncremental ?? '')}</dd><dt className="text-muted-foreground">Last full reconciliation</dt><dd>{dateLabel(health?.lastFull ?? '')}</dd><dt className="text-muted-foreground">Indexed documents</dt><dd>{health?.documentCount === -1 ? 'Unchanged' : health?.documentCount ?? '—'}</dd><dt className="text-muted-foreground">Tombstones</dt><dd>{health?.tombstoneCount ?? '—'}</dd><dt className="text-muted-foreground">Queued actions</dt><dd>{health?.queueDepth ?? '—'}</dd><dt className="text-muted-foreground">Failures</dt><dd>{health?.failures ?? '—'}</dd><dt className="text-muted-foreground">Schema</dt><dd>v{health?.schemaVersion ?? '—'}</dd><dt className="text-muted-foreground">Grant expires</dt><dd>{dateLabel(health?.grantExpiresAt ?? '')}</dd>
      </dl></section>
      <section className="rounded-md border border-border"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Connection</h2></div><div className="space-y-4 p-4"><label className="block text-xs font-medium text-muted-foreground">Paperless address<input className={`${inputClass} mt-1 block w-full`} value={baseUrl} onChange={event => setBaseUrl(event.target.value)} /></label><label className="block text-xs font-medium text-muted-foreground">Warn after minutes without sync<input type="number" min={5} max={10080} className={`${inputClass} mt-1 block w-full`} value={staleAfterMinutes} onChange={event => setStaleAfterMinutes(Number(event.target.value))} /></label><div className="flex items-center gap-2"><button className={buttonClass} onClick={() => void saveSettings()}>Save</button><button className={buttonClass} onClick={() => void Promise.all([paperless.client?.refreshAll(), actions.client?.refreshAll()])}><RefreshCw className="size-3.5" />Refresh</button></div><p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />The browser receives metadata records, never OCR text, thumbnails, credentials, or document files.</p></div></section>
    </div>}
  </div>;
}

function RecordDetails({ document, baseUrl, onReview, onDelete, onAction }: { document: PaperlessDocument; baseUrl: string; onReview: () => void; onDelete: () => void; onAction: (kind: string, payload: Record<string, StateJson>) => void }) {
  const [kind, setKind] = useState('tag.add');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  return <section className="rounded-md border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold"><a className="hover:underline" href={paperlessDocumentUrl(baseUrl, document.paperlessId)} target="_blank" rel="noreferrer">{document.restrictedStub ? `Restricted record #${document.paperlessId}` : document.title || `Record #${document.paperlessId}`} <ExternalLink className="inline size-3" /></a></h2><p className="mt-1 text-xs text-muted-foreground">PARA: {document.paraLinks.projects.length} projects · {document.paraLinks.areas.length} areas · {document.paraLinks.tasks.length} tasks</p></div><div className="flex gap-2"><button className={buttonClass} onClick={onReview}>Create review task</button><button className={buttonClass} onClick={onDelete}>Propose deletion</button></div></div>
    {!document.restrictedStub && <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4"><label className="text-xs text-muted-foreground">Controlled write-back<Select value={kind} onValueChange={setKind}><SelectTrigger aria-label="Controlled write-back action" className={`${inputClass} mt-1 block`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tag.add">Add tag</SelectItem><SelectItem value="custom-field.set">Set custom field</SelectItem><SelectItem value="legal-hold.set">Set legal hold</SelectItem></SelectContent></Select></label><label className="text-xs text-muted-foreground">{kind === 'tag.add' ? 'Tag ID' : 'Field ID'}<input inputMode="numeric" className={`${inputClass} mt-1 block w-28`} value={field} onChange={event => setField(event.target.value)} /></label>{kind !== 'tag.add' && <label className="text-xs text-muted-foreground">Value<input className={`${inputClass} mt-1 block`} value={value} onChange={event => setValue(event.target.value)} /></label>}<button className={buttonClass} disabled={!/^\d+$/.test(field)} onClick={() => onAction(kind, kind === 'tag.add' ? { tagId: Number(field) } : { fieldId: Number(field), value })}>Queue update</button></div>}
  </section>;
}
