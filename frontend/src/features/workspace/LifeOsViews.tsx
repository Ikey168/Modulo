import { restoreWorkspaceBackup } from './restoreWorkspace';
import { restorePortableServerStores } from './workspacePortableState';
import { usePlugins } from './plugins/PluginProvider';
import { entityPath } from './entityNavigation';
import { dayKey } from './noteDates';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Download, ExternalLink, FileArchive, FileJson, FolderSync, KeyRound, Link2, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/ui';
import type { WorkspaceViewProps } from './plugins/types';
import {
  collectLifeOsEntities, collectLifeOsHealth, createLifeOsBackup, lifeOsEntitiesCsv, lifeOsEntitiesMarkdown,
  LIFE_OS_RELATION_TYPES, newLifeOsId, parseLifeOsBackup, pruneBrokenLifeOsRelations, type LifeOsBackup, type LifeOsEntity, type LifeOsRelationType,
} from './lifeOs';
import { useLifeOsStore } from './useLifeOsStore';
import { useLifeOsServerSnapshot } from './useLifeOsServerSnapshot';
import { EntryPopover, EntryPopoverBody, PopoverEditor } from './EntryPopover';
import {
  EmptyPanel,
  Field,
  HealthLine,
  HealthList,
  Metric,
  Panel,
  ChoiceInline,
  ViewShell,
} from './viewkit';
import { nativeDesktop } from '@/services/desktop';

const today = () => dayKey(new Date());

function useIndex(props: WorkspaceViewProps) {
  const [store, setStore] = useLifeOsStore();
  const stores = useLifeOsServerSnapshot(true);
  const entities = collectLifeOsEntities(props.data.notes, stores);
  const health = collectLifeOsHealth(entities, store, stores);
  return { store, setStore, stores, entities, health };
}

export function LifeOsDashboardView(props: WorkspaceViewProps) {
  const { store, entities, health } = useIndex(props);
  const dated = entities.filter((entity) => entity.date);
  const recentCutoff = dayKey(new Date(Date.now() - 7 * 86_400_000));
  const recent = dated.filter((entity) => (entity.date ?? '').slice(0, 10) >= recentCutoff);
  const sources = new Set(entities.map((entity) => entity.source));
  const latestReview = [...store.reviews].sort((a, b) => b.date.localeCompare(a.date))[0];
  return <ViewShell title="Life OS" subtitle="A read-mostly integration layer across your specialist systems; source records stay in their own stores.">
    <div className="flex flex-wrap border-y border-border py-2">
      <Metric label="Indexed records" value={entities.length}/><Metric label="Connected systems" value={sources.size}/>
      <Metric label="Recent activity" value={recent.length}/><Metric label="Cross-links" value={store.relations.length}/>
      <Metric label="Health issues" value={health.length} tone={health.some((item) => item.severity === 'Error') ? 'danger' : 'default'}/>
    </div>
    <Panel title="Integration health">
      <HealthList>
      <HealthLine okay={health.length === 0}>{health.length ? `${health.length} issue${health.length === 1 ? '' : 's'} need attention in Data Health & Portability.` : 'Indexed data and cross-plugin relationships are healthy.'}</HealthLine>
      <HealthLine okay={store.reviews.length > 0}>{latestReview ? `Latest system review: ${latestReview.date} · Next focus: ${latestReview.nextFocus || 'not set'}` : 'No integrated weekly review has been saved yet.'}</HealthLine>
      <HealthLine okay={sources.size > 1}>{sources.size > 1 ? `${sources.size} systems contribute to the shared index.` : 'Add records in specialist plugins to make the integration index useful.'}</HealthLine>
      </HealthList>
    </Panel>
    <Panel title="Largest systems">
      <div className="divide-y divide-border border-y border-border">{[...sources].map((source) => ({ source, count: entities.filter((entity) => entity.source === source).length })).sort((a, b) => b.count - a.count).slice(0, 8).map((item) => <button key={item.source} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/20" onClick={() => props.navigateView('life-os-explorer')}><span className="min-w-0 flex-1 truncate text-xs">{item.source}</span><span className="text-sm font-semibold tabular-nums">{item.count}</span></button>)}</div>
    </Panel>
  </ViewShell>;
}

export function LifeOsExplorerView(props: WorkspaceViewProps) {
  const { entities } = useIndex(props);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('All');
  const [selected, setSelected] = useState<LifeOsEntity | null>(null);
  const sources = ['All', ...new Set(entities.map((entity) => entity.source))];
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = entities.filter((entity) => (scope === 'All' || entity.source === scope) && (!normalized || `${entity.title} ${entity.kind} ${entity.source} ${entity.status ?? ''} ${entity.tags.join(' ')}`.toLocaleLowerCase().includes(normalized)));
  const timeline = [...entities].filter((entity) => entity.date).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 12);
  const artifacts = entities.filter((entity) => entity.artifact).slice(0, 12);
  return <ViewShell title="Universal Explorer" subtitle="Search every local life-system record, then jump back to the specialist view that owns it.">
    <div className="grid gap-2 sm:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, types, status, and tags…"/></div><Select value={scope} onValueChange={setScope}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
    <Panel title={`${filtered.length} matching records`}><EntityGrid entities={filtered.slice(0, 48)} onOpen={setSelected}/>{filtered.length > 48 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 48 matches. Narrow the search to see more.</p>}</Panel>
    {!query && scope === 'All' && <><Panel title="Activity timeline"><EntityRows entities={timeline} onOpen={setSelected}/></Panel><Panel title="Artifact gallery"><EntityGrid entities={artifacts} onOpen={setSelected}/></Panel></>}
    <EntryPopover open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.title ?? 'Life OS record'} description={selected ? `${selected.source} · ${selected.kind}` : undefined}>{selected && <EntryPopoverBody><div className="space-y-5 p-5"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{selected.source}</Badge><Badge variant="outline">{selected.kind}</Badge>{selected.status && <Badge variant="outline">{selected.status}</Badge>}<Button className="ml-auto" size="sm" onClick={() => openEntity(props, selected)}>{selected.source === 'Notes' ? 'Edit note' : 'Open specialist view'}<ExternalLink className="size-3.5"/></Button></div>{selected.detail && <p className="text-sm leading-6">{selected.detail}</p>}<div className="grid gap-3 sm:grid-cols-2"><EntityFact label="Date" value={selected.date?.slice(0, 10)}/><EntityFact label="Source" value={selected.source}/><EntityFact label="Type" value={selected.kind}/><EntityFact label="Tags" value={selected.tags.join(', ')}/></div></div></EntryPopoverBody>}</EntryPopover>
  </ViewShell>;
}

export function LifeOsRelationsView(props: WorkspaceViewProps) {
  const { store, setStore, entities } = useIndex(props);
  const [fromUid, setFromUid] = useState(''); const [toUid, setToUid] = useState(''); const [type, setType] = useState<LifeOsRelationType>('Related'); const [label, setLabel] = useState('');
  const byId = new Map(entities.map((entity) => [entity.uid, entity]));
  const add = () => {
    if (!fromUid || !toUid || fromUid === toUid) return;
    setStore((current) => ({ ...current, relations: [...current.relations, { id: newLifeOsId('relation'), fromUid, toUid, type, label: label.trim() || type, createdAt: new Date().toISOString() }] }));
    setFromUid(''); setToUid(''); setType('Related'); setLabel('');
  };
  const repair = (id: string, side: 'fromUid' | 'toUid', uid: string) => setStore((current) => ({ ...current, relations: current.relations.map((relation) => relation.id === id ? { ...relation, [side]: uid } : relation) }));
  return <ViewShell title="Cross-Plugin Relations" subtitle="Add stable links without forcing specialist data into one schema.">
    <div className="space-y-4">
      <section className="divide-y divide-border rounded-md border border-border">{store.relations.length === 0 ? <EmptyPanel icon={Link2} title="No cross-plugin relationships yet" description="Link a record here to one in another system, without forcing either into a shared schema." /> : store.relations.map((relation) => { const from = byId.get(relation.fromUid); const to = byId.get(relation.toUid); const repairOptions = entities.slice(0, 500).map((entity) => ({ value: entity.uid, label: `${entity.source} · ${entity.title}` })); return <div key={relation.id} className="flex flex-wrap items-center gap-2 p-3 text-xs">{from ? <button className="min-w-44 flex-1 text-left" onClick={() => openEntity(props, from)}><p className="truncate font-medium">{from.title}</p><p className="text-muted-foreground">{from.source}</p></button> : <ChoiceInline label="Repair missing source" value={undefined} onChange={(uid) => repair(relation.id, 'fromUid', uid)} options={repairOptions} placeholder="Repair missing source" className="min-w-52 flex-1"/>}<Badge variant="outline">{relation.label}</Badge>{to ? <button className="min-w-44 flex-1 text-left" onClick={() => openEntity(props, to)}><p className="truncate font-medium">{to.title}</p><p className="text-muted-foreground">{to.source}</p></button> : <ChoiceInline label="Repair missing target" value={undefined} onChange={(uid) => repair(relation.id, 'toUid', uid)} options={repairOptions} placeholder="Repair missing target" className="min-w-52 flex-1"/>}<Button variant="ghost" size="icon" className="size-7" onClick={() => setStore((current) => ({ ...current, relations: current.relations.filter((item) => item.id !== relation.id) }))}><Trash2 className="size-3.5"/></Button></div>; })}</section>
      <PopoverEditor title="Link records"><EntitySelect label="From" value={fromUid} entities={entities} onChange={setFromUid}/><ChoiceInline label="Relationship type" value={type} onChange={(value) => setType(value as LifeOsRelationType)} options={[...LIFE_OS_RELATION_TYPES]} className="w-full"/><Field label="Custom label (optional)"><Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={type}/></Field><EntitySelect label="To" value={toUid} entities={entities} onChange={setToUid}/><Button onClick={add} disabled={!fromUid || !toUid || fromUid === toUid}><Plus className="size-4"/>Add relationship</Button></PopoverEditor>
    </div>
  </ViewShell>;
}

export function LifeOsReviewView(props: WorkspaceViewProps) {
  const { store, setStore, entities, health } = useIndex(props);
  const [date, setDate] = useState(today); const [wins, setWins] = useState(''); const [friction, setFriction] = useState(''); const [nextFocus, setNextFocus] = useState('');
  const signals = useMemo(() => [`${entities.length} indexed records`, `${new Set(entities.map((entity) => entity.source)).size} connected systems`, `${health.length} data-health issues`, `${store.relations.length} cross-plugin links`], [entities, health, store.relations.length]);
  const save = () => { setStore((current) => ({ ...current, reviews: [{ id: newLifeOsId('review'), date, wins: wins.trim(), friction: friction.trim(), nextFocus: nextFocus.trim(), signals }, ...current.reviews] })); setWins(''); setFriction(''); setNextFocus(''); };
  return <ViewShell title="Integrated Weekly Review" subtitle="Review the whole system without replacing the deeper reviews inside PARA and specialist plugins.">
    <div className="space-y-4"><PopoverEditor title="Save review"><Field label="Date"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></Field><Field label="Wins"><Textarea rows={3} value={wins} onChange={(event) => setWins(event.target.value)}/></Field><Field label="Friction"><Textarea rows={3} value={friction} onChange={(event) => setFriction(event.target.value)}/></Field><Field label="Next focus"><Textarea rows={3} value={nextFocus} onChange={(event) => setNextFocus(event.target.value)}/></Field><div className="border-t border-border pt-2 text-xxs text-muted-foreground">{signals.join(' · ')}</div><Button onClick={save}><RefreshCw className="size-4"/>Save review</Button></PopoverEditor><section className="divide-y divide-border border-y border-border">{store.reviews.length === 0 ? <EmptyPanel icon={ClipboardCheck} title="No integrated reviews yet" description="Save a weekly review to capture wins, friction and next focus across every system." /> : store.reviews.map((review) => <article key={review.id} className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{review.date}</span><Button className="ml-auto size-7" variant="ghost" size="icon" onClick={() => setStore((current) => ({ ...current, reviews: current.reviews.filter((item) => item.id !== review.id) }))}><Trash2 className="size-3.5"/></Button></div><p className="mt-2 text-xs"><b>Wins:</b> {review.wins || '—'}</p><p className="mt-1 text-xs"><b>Friction:</b> {review.friction || '—'}</p><p className="mt-1 text-xs"><b>Next focus:</b> {review.nextFocus || '—'}</p><p className="mt-2 text-xxs text-muted-foreground">{review.signals.join(' · ')}</p></article>)}</section></div>
  </ViewShell>;
}

export function LifeOsPortabilityView(props: WorkspaceViewProps) {
  const { store, setStore, stores, entities, health } = useIndex(props);
  const { workspaceState, state: pluginState } = usePlugins();
  const createBackup = () => createLifeOsBackup(
    props.data.notes,
    props.data.allLinks ?? props.data.links,
    props.data.trashedNotes,
    { ...stores },
  );
  const [preview, setPreview] = useState<LifeOsBackup | null>(null); const [error, setError] = useState(''); const [replace, setReplace] = useState(false); const [result, setResult] = useState('');
  const [passphrase, setPassphrase] = useState(''); const [syncDirectory, setSyncDirectory] = useState(''); const [nativeBusy, setNativeBusy] = useState(false);
  const desktop = nativeDesktop();
  useEffect(() => { if (desktop) void desktop.sync.status().then((status) => setSyncDirectory(status.directory ?? '')); }, [desktop]);
  const loadFile = async (file?: File) => { if (!file) return; try { setPreview(parseLifeOsBackup(JSON.parse(await file.text()))); setError(''); setResult(''); } catch (reason) { setPreview(null); setError(reason instanceof Error ? reason.message : 'Could not read that backup.'); } };
  const nativeAction = async (action: () => Promise<void>) => { setNativeBusy(true); setError(''); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Desktop operation failed.'); } finally { setNativeBusy(false); } };
  const exportZip = () => nativeAction(async () => { const path = await desktop?.backup.exportZip(JSON.stringify(createBackup())); if (path) setResult(`ZIP backup saved to ${path}.`); });
  const importZip = () => nativeAction(async () => { const imported = await desktop?.backup.importZip(); if (!imported) return; setPreview(parseLifeOsBackup(JSON.parse(imported.payload))); setResult(`Backup opened for inspection; ${imported.attachments} attachment file${imported.attachments === 1 ? '' : 's'} restored to the managed library.`); });
  const chooseSyncDirectory = () => nativeAction(async () => { const path = await desktop?.sync.chooseDirectory(); if (path) { setSyncDirectory(path); setResult('Encrypted sync folder selected.'); } });
  const pushSync = () => nativeAction(async () => { const path = await desktop?.sync.write(JSON.stringify(createBackup()), passphrase); if (path) setResult(`Encrypted snapshot written to ${path}.`); });
  const pullSync = () => nativeAction(async () => { const payload = await desktop?.sync.read(passphrase); if (!payload) return; setPreview(parseLifeOsBackup(JSON.parse(payload))); setResult('Encrypted snapshot decrypted and opened for inspection. Nothing has been replaced yet.'); });
  const pruneRelations = () => { const pruned = pruneBrokenLifeOsRelations(entities, store); setStore(pruned.data); setResult(`Removed ${pruned.removed} broken cross-plugin relation${pruned.removed === 1 ? '' : 's'}.`); };
  const restore = async () => {
    if (!preview) return;
    setNativeBusy(true); setError(''); setResult('');
    try {
      const currentPortable = { ...stores };
      const local = await restoreWorkspaceBackup(
        preview,
        [...props.data.notes, ...(props.data.trashedNotes ?? [])],
        props.data.createNote,
        replace,
        { links: props.data.allLinks ?? props.data.links, createLink: props.data.createLink, addTag: props.data.addTag, trashNote: props.data.deleteNote },
        {
          current: currentPortable,
          restoreServer: (planned) => restorePortableServerStores(planned, workspaceState, pluginState),
        },
      );
      setResult(`Restored ${local.restored.length} stores, skipped ${local.skipped.length}, ignored ${local.unknown.length} unknown keys, and added ${local.importedNotes} missing notes.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Restore failed.'); }
    finally { setNativeBusy(false); }

  };
  return <ViewShell title="Data Health & Portability" subtitle="Provider-neutral exports, inspect-before-restore imports, and checks that never merge your specialist stores.">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><Button variant="outline" onClick={() => download('modulo-life-os-backup.json', JSON.stringify(createBackup(), null, 2), 'application/json')}><FileJson className="size-4"/>Full JSON backup</Button>{desktop && <Button variant="outline" onClick={() => void exportZip()} disabled={nativeBusy}><FileArchive className="size-4"/>Backup + attachments</Button>}<Button variant="outline" onClick={() => download('modulo-life-os-index.csv', lifeOsEntitiesCsv(entities), 'text/csv')}><Download className="size-4"/>Index CSV</Button><Button variant="outline" onClick={() => download('modulo-life-os-index.md', lifeOsEntitiesMarkdown(entities), 'text/markdown')}><Download className="size-4"/>Index Markdown</Button></div>
    <Panel title="Data health">{health.length === 0 ? <HealthList><HealthLine okay>No broken cross-links, duplicate titles, or unreadable specialist stores were found.</HealthLine></HealthList> : <><div className="space-y-2">{health.map((issue) => <div key={issue.id} className="flex gap-2 rounded-md bg-muted p-2 text-xs">{issue.severity === 'Error' ? <AlertTriangle className="size-4 text-destructive"/> : <AlertTriangle className="size-4 text-warning"/>}<div><p className="font-medium">{issue.title} · {issue.source}</p><p className="text-muted-foreground">{issue.detail}</p></div>{issue.route && <Button className="ml-auto size-7" variant="ghost" size="icon" onClick={() => props.navigateView(issue.route!)}><ExternalLink className="size-3.5"/></Button>}</div>)}</div>{health.some((issue) => issue.id.startsWith('relation:')) && <Button className="mt-3" size="sm" variant="outline" onClick={pruneRelations}><Trash2/>Remove broken relations</Button>}</>}</Panel>
    {desktop && <Panel title="Optional encrypted folder sync"><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)_auto]"><div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"><FolderSync className="size-4 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 truncate">{syncDirectory || 'No sync folder selected'}</span><Button size="sm" variant="ghost" onClick={() => void chooseSyncDirectory()} disabled={nativeBusy}>Choose</Button></div><div className="relative"><KeyRound className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><Input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Passphrase (8+ characters)" className="h-9 pl-8" autoComplete="off"/></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void pullSync()} disabled={nativeBusy || passphrase.length < 8 || !syncDirectory}><Download/>Inspect remote</Button><Button size="sm" onClick={() => void pushSync()} disabled={nativeBusy || passphrase.length < 8 || !syncDirectory}><Upload/>Push encrypted</Button></div></div><p className="mt-2 text-xxs text-muted-foreground">The passphrase is never stored. Pulling opens a restore preview; it does not overwrite local data.</p></Panel>}
    <Panel title="Inspect and restore"><div className="grid gap-3 xl:grid-cols-[1fr_auto]"><div><Label htmlFor="life-os-import" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-4 text-xs hover:bg-muted"><Upload className="size-4"/>Choose a Modulo Life OS JSON backup</Label><Input id="life-os-import" className="hidden" type="file" accept="application/json,.json" onChange={(event) => void loadFile(event.target.files?.[0])}/>{error && <p className="mt-2 text-xs text-destructive">{error}</p>}{preview && <div className="mt-2 rounded-md bg-muted p-3 text-xs"><p className="font-medium">Valid schema v{preview.schemaVersion} backup</p><p className="text-muted-foreground">Exported {preview.exportedAt} · {Object.keys(preview.stores).length} stores · {preview.notes.length} notes</p></div>}</div><div className="space-y-2"><div className="flex items-start gap-2 text-xs"><Checkbox id="life-os-replace" className="mt-0.5" checked={replace} onCheckedChange={(checked) => setReplace(checked === true)}/><Label htmlFor="life-os-replace" className="cursor-pointer text-xs leading-4"><span className="font-semibold">Replace existing server plugin records</span><br/><span className="font-normal text-muted-foreground">Off by default. Notes remain additive and exact duplicates are skipped.</span></Label></div><Button onClick={() => void restore()} disabled={!preview || nativeBusy} variant={replace ? 'destructive' : 'primary'}><Upload className="size-4"/>{replace ? 'Replace and restore' : 'Restore missing data'}</Button></div></div>{result && <p className="mt-3 text-xs text-success">{result}</p>}</Panel>
    {desktop && <Button variant="ghost" size="sm" className="w-fit" onClick={() => void importZip()} disabled={nativeBusy}><FileArchive/>Inspect a ZIP backup</Button>}
    <p className="text-xxs text-muted-foreground">JSON contains full recognized server plugin records plus portable Markdown note bodies. CSV and Markdown are flat, human-readable indexes. Unknown store keys are reported and never imported.</p>
  </ViewShell>;
}

function openEntity(props: WorkspaceViewProps, entity: LifeOsEntity) { if (entity.source === 'Notes') { const parts = entity.uid.split(':'); const id = Number(parts[parts.length - 1]); if (Number.isFinite(id)) props.onOpenNote(id); } else props.navigateView(entityPath(entity)); }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function EntityGrid({ entities, onOpen }: { entities: LifeOsEntity[]; onOpen: (entity: LifeOsEntity) => void }) { return entities.length === 0 ? <EmptyPanel icon={Search} title="No records match" description="Try another search term, or a different source filter." /> : <div className="divide-y divide-border border-y border-border">{entities.map((entity) => <button key={entity.uid} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/20" onClick={() => onOpen(entity)}><span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{entity.source}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{entity.title}</span><span className="truncate text-xxs text-muted-foreground">{entity.kind}{entity.status ? ` · ${entity.status}` : ''}{entity.date ? ` · ${entity.date.slice(0, 10)}` : ''}</span></button>)}</div>; }
function EntityRows({ entities, onOpen }: { entities: LifeOsEntity[]; onOpen: (entity: LifeOsEntity) => void }) { return <div className="divide-y divide-border">{entities.map((entity) => <button key={entity.uid} className="flex w-full items-center gap-2 py-2 text-left text-xs hover:bg-muted" onClick={() => onOpen(entity)}><span className="w-24 shrink-0 text-muted-foreground">{entity.date?.slice(0, 10)}</span><span className="truncate font-medium">{entity.title}</span><Badge className="ml-auto" variant="outline">{entity.source}</Badge></button>)}</div>; }
function EntitySelect({ label, value, entities, onChange }: { label: string; value: string; entities: LifeOsEntity[]; onChange: (value: string) => void }) { return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Choose any indexed record"/></SelectTrigger><SelectContent>{entities.slice(0, 500).map((entity) => <SelectItem key={entity.uid} value={entity.uid}>{entity.source} · {entity.title}</SelectItem>)}</SelectContent></Select></Field>; }
function EntityFact({ label, value }: { label: string; value?: string }) { return <div className="border-b border-border px-1 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value || 'Not set'}</p></div>; }
