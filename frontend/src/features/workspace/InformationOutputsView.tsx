import { useMemo, useState } from 'react';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, ScrollArea, Textarea, cn } from '@/ui';
import {
  ARTIFACT_STATUSES,
  ARTIFACT_TYPES,
  INTAKE_MODES,
  artifactTemplate,
  newInformationIntakeId,
  type IntakeArtifact,
  type IntakeArtifactStatus,
  type IntakeArtifactType,
  type IntakeMode,
} from './informationIntake';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import { useParaStore } from './useParaStore';
import { EntryPopover, EntryPopoverBody } from './EntryPopover';
import { Choice, ChoiceInline, Field, useDeepLink } from './viewkit';

export function InformationOutputsView() {
  const [data, persist] = useInformationIntakeStore();
  const [para] = useParaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useDeepLink('artifact', setSelectedId);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<IntakeMode | 'All'>('All');
  const [editing, setEditing] = useState(false);
  const selected = data.artifacts.find((artifact) => artifact.id === selectedId) ?? null;
  const artifacts = useMemo(() => data.artifacts.filter((artifact) => (mode === 'All' || artifact.mode === mode) && (!query.trim() || `${artifact.title} ${artifact.type} ${artifact.body ?? ''}`.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data.artifacts, mode, query]);
  const patch = (update: Partial<IntakeArtifact>) => selected && persist((current) => ({ ...current, artifacts: current.artifacts.map((artifact) => artifact.id === selected.id ? { ...artifact, ...update, updatedAt: new Date().toISOString() } : artifact) }));
  const create = () => {
    const now = new Date().toISOString();
    const type: IntakeArtifactType = 'Research Bundle';
    const artifact: IntakeArtifact = { id: newInformationIntakeId('artifact'), mode: 'Deep Research', type, title: 'Untitled output', body: artifactTemplate(type), status: 'Draft', sourceUrls: [], createdAt: now, updatedAt: now };
    persist((current) => ({ ...current, artifacts: [artifact, ...current.artifacts] }));
    setSelectedId(artifact.id);
    setEditing(true);
  };

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <aside className="flex min-w-0 flex-1 flex-col"><header className="space-y-2 border-b border-border p-3"><div className="flex items-center gap-2"><h2 className="mr-auto text-sm font-semibold">Outputs</h2><Button size="icon-sm" aria-label="Add output" onClick={create}><Plus className="size-4" /></Button></div><div className="relative"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search outputs" className="h-8 pl-8" /></div><ChoiceInline label="Filter outputs by mode" value={mode === 'All' ? '' : mode} onChange={(value) => setMode((value || 'All') as IntakeMode | 'All')} options={INTAKE_MODES} clearable clearLabel="All modes" className="w-full" /></header>
        {artifacts.length === 0 ? <div className="flex flex-1 items-center justify-center p-4"><EmptyState icon={<FileText className="size-5" />} title="No outputs found" description="Create an output directly or from the Mode Workbench." /></div> : <ScrollArea className="flex-1"><nav className="divide-y divide-border border-y border-border">{artifacts.map((artifact) => <button key={artifact.id} type="button" onClick={() => { setSelectedId(artifact.id); setEditing(false); }} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', selectedId === artifact.id ? 'bg-primary/10' : 'hover:bg-muted/20')}><span className="min-w-0 flex-1 truncate text-sm font-medium">{artifact.title}</span><span className="text-xs text-muted-foreground">{artifact.type}</span><span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted-foreground">{artifact.status}</span></button>)}</nav></ScrollArea>}
      </aside>
      <EntryPopover open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelectedId(null); setEditing(false); } }} title={selected?.title ?? 'Output'} description={selected ? `${selected.type} · ${selected.status}` : undefined}>
      {selected && <EntryPopoverBody>{!editing ? <OutputOverview artifact={selected} onEdit={() => setEditing(true)} /> : <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
        <div className="flex items-center gap-2"><Input value={selected.title} onChange={(event) => patch({ title: event.target.value })} className="h-10 flex-1 text-base font-semibold" /><Button size="icon" variant="ghost" aria-label={`Delete ${selected.title}`} className="hover:text-destructive" onClick={() => { persist((current) => ({ ...current, artifacts: current.artifacts.filter((artifact) => artifact.id !== selected.id) })); setSelectedId(null); }}><Trash2 className="size-4" /></Button></div>
        <section className="border-y border-border">
          <Choice label="Mode" value={selected.mode} onChange={(value) => patch({ mode: value as IntakeMode })} options={INTAKE_MODES} />
          <Choice label="Output type" value={selected.type} onChange={(value) => { const type = value as IntakeArtifactType; patch({ type, body: selected.body?.trim() ? selected.body : artifactTemplate(type) }); }} options={ARTIFACT_TYPES} />
          <Choice label="Status" value={selected.status} onChange={(value) => patch({ status: value as IntakeArtifactStatus })} options={ARTIFACT_STATUSES} />
          <Field label="Review date"><Input type="date" value={selected.reviewDate ?? ''} onChange={(event) => patch({ reviewDate: event.target.value || undefined })} className="h-8" /></Field>
          <Choice label="Related intake" value={selected.itemId} onChange={(value) => patch({ itemId: value || undefined })} options={data.items.map((item) => ({ value: item.id, label: item.title }))} clearable clearLabel="No intake item" />
          <Choice label="PARA Project" value={selected.projectId} onChange={(value) => patch({ projectId: value || undefined })} options={para.projects.filter((item) => !item.archivedAt).map((item) => ({ value: item.id, label: item.name }))} clearable clearLabel="No project" />
          <Choice label="PARA Area" value={selected.areaId} onChange={(value) => patch({ areaId: value || undefined })} options={para.areas.filter((item) => !item.archivedAt).map((item) => ({ value: item.id, label: item.name }))} clearable clearLabel="No area" />
          <Field label="Source URLs"><Input value={selected.sourceUrls.join(', ')} onChange={(event) => patch({ sourceUrls: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Comma-separated" className="h-8" /></Field>
        </section>
        <Field label="Output body"><Textarea value={selected.body ?? ''} onChange={(event) => patch({ body: event.target.value || undefined })} rows={24} className="font-mono text-xs" /></Field>
      </div>}</EntryPopoverBody>}
      </EntryPopover>
    </div>
  );
}

function OutputOverview({ artifact, onEdit }: { artifact: IntakeArtifact; onEdit: () => void }) { return <div className="space-y-5 p-5"><div className="flex flex-wrap gap-2"><span className="rounded-sm border border-border px-2 py-0.5 text-xs">{artifact.type}</span><span className="rounded-sm border border-border px-2 py-0.5 text-xs">{artifact.status}</span><span className="rounded-sm border border-border px-2 py-0.5 text-xs">{artifact.mode}</span><Button className="ml-auto" size="sm" onClick={onEdit}>Edit</Button></div><div><h2 className="text-base font-semibold">{artifact.title}</h2><p className="mt-1 text-xs text-muted-foreground">Updated {artifact.updatedAt.slice(0, 10)}</p></div><section className="rounded-sm border border-border p-4"><p className="whitespace-pre-wrap font-mono text-xs leading-6">{artifact.body || 'No output body yet.'}</p></section>{artifact.sourceUrls.length > 0 && <div><p className="text-xs font-medium text-muted-foreground">Sources</p><div className="mt-2 space-y-1">{artifact.sourceUrls.map((url) => <p key={url} className="truncate text-xs text-primary">{url}</p>)}</div></div>}</div>; }
