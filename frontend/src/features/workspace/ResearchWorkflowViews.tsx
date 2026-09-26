import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Boxes, Brain, CircleDashed, GitBranch, Link2, Plus, RefreshCw, Search, Trash2, Workflow } from 'lucide-react';
import { Badge, Button, Input, ScrollArea, Textarea, cn } from '@/ui';
import { InformationIntakeView } from './InformationIntakeView';
import { InformationOutputsView } from './InformationOutputsView';
import { InformationWorkbenchView } from './InformationWorkbenchView';
import { LifeCollectionView } from './LifeCollectionView';
import { DomainDashboardView } from './DomainPackViews';
import { domainConfig } from './domainConfigs';
import { isoDate } from './planner';
import {
  INTAKE_MODES,
  RESEARCH_PROJECT_STATUSES,
  RESEARCH_WORK_STATUSES,
  artifactTemplate,
  defaultArtifactType,
  newInformationIntakeId,
  projectProvenance,
  staleArtifacts,
  transitionResearch,
  type InformationIntakeData,
  type IntakeMode,
  type ResearchProject,
  type ResearchWorkStatus,
} from './informationIntake';
import { useInformationIntakeStore } from './useInformationIntakeStore';
import { useEducationStore } from './useEducationStore';
import { useLifeCollections } from './useLifeCollection';
import type { WorkspaceViewProps } from './plugins/types';
import { EntryPopover, EntryPopoverBody } from './EntryPopover';
import { Choice, ConfirmDelete, EmptyPanel, Field, Metric, Panel } from './viewkit';
const now = () => new Date().toISOString();
const csv = (value: unknown) => Array.isArray(value) ? value.join(', ') : '';
const lines = (value: string) => value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean);

export function ResearchSignalsView(props: WorkspaceViewProps) {
  void props;
  return <InformationIntakeView />;
}

export function ResearchWorkflowDashboard({ navigateView }: WorkspaceViewProps) {
  const [data] = useInformationIntakeStore();
  const today = isoDate(new Date());
  const activeProjects = data.projects.filter((project) => !['Complete', 'Paused'].includes(project.status));
  const blocked = data.projects.filter((project) => project.status === 'Blocked').length
    + [...data.explorationTrails, ...data.syntheses, ...data.cases, ...data.creations, ...data.learningPlans, ...data.experiments, ...data.maintenanceReviews].filter((record) => record.status === 'Blocked').length;
  const due = staleArtifacts(data, today).length + data.maintenanceReviews.filter((review) => review.status !== 'Complete' && review.reviewDate <= today).length;
  const linkedArtifacts = data.artifacts.filter((artifact) => artifact.itemId || artifact.projectId).length;
  const totalArtifacts = data.artifacts.length;
  const coverage = totalArtifacts ? Math.round(linkedArtifacts / totalArtifacts * 100) : 0;
  return <ScrollArea className="min-w-0 flex-1"><div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
    <header className="border-b border-border pb-3"><h2 className="text-sm font-semibold">Research workflow</h2></header>
    <section className="flex flex-wrap border-y border-border py-2">
      <Metric label="Active projects" value={activeProjects.length} icon={Boxes} />
      <Metric label="Blocked work" value={blocked} icon={AlertTriangle} tone={blocked > 0 ? 'warning' : 'default'} />
      <Metric label="Reviews due" value={due} icon={RefreshCw} tone={due > 0 ? 'warning' : 'default'} />
      <Metric label="Output provenance" value={`${coverage}%`} icon={GitBranch} />
    </section>
    <section className="rounded-sm border border-border"><header className="flex items-center gap-2 border-b border-border px-3 py-2"><Workflow className="size-4 text-muted-foreground"/><h3 className="text-sm font-medium">Workflow stages</h3><span className="ml-auto text-xs text-muted-foreground">{data.transitions.length} transitions</span></header><div className="grid sm:grid-cols-2">{INTAKE_MODES.map((mode) => { const count = data.items.filter((item) => item.mode === mode && !['Done', 'Discarded'].includes(item.status)).length + data.projects.filter((project) => project.currentMode === mode && project.status !== 'Complete').length; return <button key={mode} type="button" onClick={() => navigateView(mode === 'Awareness' ? 'research-signals' : mode === 'Exploration' ? 'research-projects' : mode === 'Deep Research' ? 'research-evidence' : ['Decision Support', 'Problem-Solving'].includes(mode) ? 'research-decisions' : ['Creation', 'Externalization'].includes(mode) ? 'research-creation' : mode === 'Internalization' ? 'research-learning' : mode === 'Iteration' ? 'research-iteration' : 'research-maintenance')} className="flex min-w-0 items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted/20 odd:sm:border-r"><span className="min-w-0 flex-1 truncate text-xs font-medium">{mode}</span><span className="text-xs tabular-nums text-muted-foreground">{count}</span></button>; })}</div></section>
    <section className="grid gap-3 lg:grid-cols-2"><Panel title="Active research" actions={<Button size="sm" variant="ghost" onClick={() => navigateView('research-projects')}>Open projects</Button>}>{activeProjects.length === 0 ? <Muted>No active projects.</Muted> : activeProjects.slice(0, 6).map((project) => { const chain = projectProvenance(data, project.id); return <div key={project.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0"><CircleDashed className="size-4 text-muted-foreground"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{project.title}</p><p className="text-xxs text-muted-foreground">{project.currentMode} · {chain.items} inputs · {chain.sources} sources · {chain.artifacts} outputs</p></div>{project.nextMode && <span className="text-xxs text-muted-foreground">→ {project.nextMode}</span>}</div>; })}</Panel><Panel title="Recent transitions" actions={<Button size="sm" variant="ghost" onClick={() => navigateView('research-projects')}>Workflow</Button>}>{data.transitions.length === 0 ? <Muted>No transitions recorded yet.</Muted> : [...data.transitions].reverse().slice(0, 7).map((transition) => <div key={transition.id} className="flex items-center gap-2 border-b border-border py-2 text-xs last:border-0"><span className="text-muted-foreground">{transition.fromMode ?? 'Capture'}</span><ArrowRight className="size-3"/><span className="font-medium">{transition.toMode}</span><span className="ml-auto truncate text-xxs text-muted-foreground">{transition.reason}</span></div>)}</Panel></section>
  </div></ScrollArea>;
}

export function ResearchProjectsView({ currentView, ...props }: WorkspaceViewProps) {
  if (currentView === 'information-workbench') return <InformationWorkbenchView {...props} />;
  return <ResearchProjectsWorkspace />;
}

function ResearchProjectsWorkspace() {
  const [data, persist] = useInformationIntakeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trailTitle, setTrailTitle] = useState('');
  const selected = data.projects.find((project) => project.id === selectedId) ?? null;
  const create = () => { const timestamp = now(); const project: ResearchProject = { id: newInformationIntakeId('project'), title: 'Untitled research project', question: '', status: 'Scoping', currentMode: 'Exploration', nextMode: 'Deep Research', noteIds: [], sourceIds: [], createdAt: timestamp, updatedAt: timestamp }; persist((current) => ({ ...current, projects: [project, ...current.projects] })); setSelectedId(project.id); };
  const patch = (update: Partial<ResearchProject>) => selected && persist((current) => ({ ...current, projects: current.projects.map((project) => project.id === selected.id ? { ...project, ...update, updatedAt: now() } : project) }));
  const move = (mode: IntakeMode) => selected && persist((current) => transitionResearch(current, { projectId: selected.id }, mode, `Moved from project workspace to ${mode}`));
  const trails = selected ? data.explorationTrails.filter((trail) => trail.projectId === selected.id) : [];
  const addTrail = () => { if (!selected || !trailTitle.trim()) return; persist((current) => ({ ...current, explorationTrails: [{ id: newInformationIntakeId('trail'), projectId: selected.id, title: trailTitle.trim(), status: 'Open', timeboxMinutes: 60, links: [], connections: [], parkingLot: [], updatedAt: now() }, ...current.explorationTrails] })); setTrailTitle(''); };
  return <MasterLayout title="Projects & Exploration Trails" subtitle="Bound scope, definition of done, WIP, transitions, and curiosity timeboxes." records={data.projects} selectedId={selectedId} setSelectedId={setSelectedId} create={create}>
    {!selected ? <EmptyPanel size="page" icon={Brain} title="No research project selected" description="Create the first record to start this stage of the workflow." action={<Button size="sm" onClick={create}><Plus className="size-4" aria-hidden="true" />Create record</Button>} /> : <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5"><TitleRow value={selected.title} onChange={(title) => patch({ title })} onDelete={() => { persist((current) => ({ ...current, projects: current.projects.filter((project) => project.id !== selected.id), explorationTrails: current.explorationTrails.map((trail) => trail.projectId === selected.id ? { ...trail, projectId: undefined } : trail) })); setSelectedId(null); }}/><section className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-2"><Choice label="Status" value={selected.status} onChange={(value) => patch({ status: value as ResearchProject['status'] })} options={RESEARCH_PROJECT_STATUSES}/><Choice label="Current mode" value={selected.currentMode} onChange={(value) => move(value as IntakeMode)} options={INTAKE_MODES}/><Field label="Research question" className="md:col-span-2"><Textarea rows={3} value={selected.question} onChange={(event) => patch({ question: event.target.value })}/></Field><Field label="Scope and boundaries" className="md:col-span-2"><Textarea rows={3} value={selected.scope ?? ''} onChange={(event) => patch({ scope: event.target.value || undefined })}/></Field><Field label="Definition of done" className="md:col-span-2"><Textarea rows={3} value={selected.definitionOfDone ?? ''} onChange={(event) => patch({ definitionOfDone: event.target.value || undefined })}/></Field><Field label="Note IDs"><Input className="h-8" value={selected.noteIds.join(', ')} onChange={(event) => patch({ noteIds: lines(event.target.value).map(Number).filter(Number.isFinite) })}/></Field><Field label="Evidence source IDs"><Input className="h-8" value={selected.sourceIds.join(', ')} onChange={(event) => patch({ sourceIds: lines(event.target.value) })}/></Field></section>
      <Panel title="Exploration trails"><div className="flex gap-2 pb-3"><Input className="h-8" value={trailTitle} onChange={(event) => setTrailTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTrail()} placeholder="New bounded rabbit hole"/><Button size="sm" onClick={addTrail}><Plus/>Add trail</Button></div>{trails.length === 0 ? <Muted>No trails for this project.</Muted> : trails.map((trail) => <TrailEditor key={trail.id} trail={trail} patch={(update) => persist((current) => ({ ...current, explorationTrails: current.explorationTrails.map((candidate) => candidate.id === trail.id ? { ...candidate, ...update, updatedAt: now() } : candidate) }))} remove={() => persist((current) => ({ ...current, explorationTrails: current.explorationTrails.filter((candidate) => candidate.id !== trail.id) }))}/>)}</Panel>
    </div>}
  </MasterLayout>;
}

function TrailEditor({ trail, patch, remove }: { trail: InformationIntakeData['explorationTrails'][number]; patch: (update: Partial<InformationIntakeData['explorationTrails'][number]>) => void; remove: () => void }) {
  return <details className="border-t border-border py-2" open><summary className="cursor-pointer text-sm font-medium">{trail.title} · {trail.timeboxMinutes}m · {trail.status}</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Title"><Input className="h-8" value={trail.title} onChange={(event) => patch({ title: event.target.value })}/></Field><Choice label="Status" value={trail.status} onChange={(value) => patch({ status: value as ResearchWorkStatus })} options={RESEARCH_WORK_STATUSES}/><Field label="Timebox (minutes)"><Input type="number" min={1} className="h-8" value={trail.timeboxMinutes} onChange={(event) => patch({ timeboxMinutes: Math.max(1, Number(event.target.value) || 1) })}/></Field><Field label="Source links"><Input className="h-8" value={csv(trail.links)} onChange={(event) => patch({ links: lines(event.target.value) })}/></Field><Field label="Connections"><Textarea rows={2} value={trail.connections.join('\n')} onChange={(event) => patch({ connections: lines(event.target.value) })}/></Field><Field label="Parking lot"><Textarea rows={2} value={trail.parkingLot.join('\n')} onChange={(event) => patch({ parkingLot: lines(event.target.value) })}/></Field><Field label="Outcome" className="md:col-span-2"><Textarea rows={2} value={trail.outcome ?? ''} onChange={(event) => patch({ outcome: event.target.value || undefined })}/></Field><Button size="sm" variant="ghost" className="justify-self-start text-destructive" onClick={remove}><Trash2/>Delete trail</Button></div></details>;
}

type CollectionKey = 'syntheses' | 'cases' | 'creations' | 'learningPlans' | 'experiments' | 'maintenanceReviews';
interface EditableRecord { id: string; title: string; status: ResearchWorkStatus; projectId?: string; updatedAt: string; [key: string]: unknown }
interface FormField { key: string; label: string; type?: 'textarea' | 'date' | 'select' | 'csv'; options?: readonly string[]; wide?: boolean; placeholder?: string }
interface CollectionConfig { key: CollectionKey; title: string; subtitle: string; empty: string; fields: FormField[]; create: () => EditableRecord; before?: React.ReactNode; after?: React.ReactNode; kind?: string }

function ResearchCollectionView({ config }: { config: CollectionConfig }) {
  const [data, persist] = useInformationIntakeStore();
  const records = (data[config.key] as unknown as EditableRecord[]).filter(record => !config.kind || record.kind === config.kind);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const visible = useMemo(() => records.filter((record) => !query.trim() || JSON.stringify(record).toLowerCase().includes(query.toLowerCase())), [records, query]);
  const replace = (next: EditableRecord[]) => persist((current) => ({ ...current, [config.key]: [...(config.kind ? (current[config.key] as unknown as EditableRecord[]).filter(record => record.kind !== config.kind) : []), ...next] } as InformationIntakeData));
  const create = () => { const record = config.create(); replace([record, ...records]); setSelectedId(record.id); };
  const patch = (update: Partial<EditableRecord>) => selected && replace(records.map((record) => record.id === selected.id ? { ...record, ...update, updatedAt: now() } : record));
  return <MasterLayout title={config.title} subtitle={config.subtitle} records={visible} selectedId={selectedId} setSelectedId={setSelectedId} create={create} query={query} setQuery={setQuery}>
    {!selected ? <EmptyPanel size="page" icon={Brain} title={config.empty} description="Create the first record to start this stage of the workflow." action={<Button size="sm" onClick={create}><Plus className="size-4" aria-hidden="true" />Create record</Button>} /> : <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">{config.before}<TitleRow value={selected.title} onChange={(title) => patch({ title })} onDelete={() => { replace(records.filter((record) => record.id !== selected.id)); setSelectedId(null); }}/><section className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-2"><Choice label="Status" value={selected.status} onChange={(value) => patch({ status: value as ResearchWorkStatus })} options={RESEARCH_WORK_STATUSES}/><Choice label="Research project" value={selected.projectId} onChange={(value) => patch({ projectId: value || undefined })} options={data.projects.map((project) => ({ value: project.id, label: project.title }))} clearable clearLabel="Independent"/>{config.fields.map((field) => <DynamicField key={field.key} field={field} value={selected[field.key]} onChange={(value) => patch({ [field.key]: value })}/>)}</section>{config.after}</div>}
  </MasterLayout>;
}

export function ResearchEvidenceView({ currentView, navigateView, ...props }: WorkspaceViewProps) {
  if (currentView === 'evidence-dashboard') return <DomainDashboardView domainId="evidence" currentView={currentView} navigateView={navigateView} {...props} />;
  if (currentView?.startsWith('evidence-')) {
    const config = domainConfig(currentView);
    if (config) return <LifeCollectionView config={config} />;
  }
  const evidence = useLifeCollections(['evidence-library', 'evidence-claims', 'evidence-reproducibility']);
  const sources = evidence['evidence-library']?.records ?? [];
  const claims = evidence['evidence-claims']?.records ?? [];
  const repro = evidence['evidence-reproducibility']?.records ?? [];
  return <ResearchCollectionView config={{ key: 'syntheses', title: 'Evidence & Synthesis', subtitle: 'Synthesize references from Evidence Lab without copying its source or claim records.', empty: 'No synthesis records yet', before: <div className="flex flex-wrap items-center gap-2"><LinkBanner text={`${sources.length} sources · ${claims.length} claims · ${repro.length} reproducibility records available by stable ID`} /><Button size="sm" variant="outline" onClick={() => navigateView('evidence-library')}>Sources</Button><Button size="sm" variant="outline" onClick={() => navigateView('evidence-claims')}>Claims</Button><Button size="sm" variant="outline" onClick={() => navigateView('evidence-reproducibility')}>Reproducibility</Button></div>, fields: [
    { key: 'confidence', label: 'Confidence', type: 'select', options: ['Low', 'Medium', 'High'] }, { key: 'sourceIds', label: 'Source IDs', type: 'csv' }, { key: 'claimIds', label: 'Claim IDs', type: 'csv' },
    { key: 'known', label: 'Known', type: 'textarea', wide: true }, { key: 'uncertain', label: 'Uncertain', type: 'textarea' }, { key: 'unresolved', label: 'Unresolved', type: 'textarea' }, { key: 'contradictions', label: 'Contradictions', type: 'textarea', wide: true }, { key: 'brief', label: 'Synthesis brief', type: 'textarea', wide: true },
  ], create: () => ({ id: newInformationIntakeId('synthesis'), title: 'Untitled synthesis', status: 'Open', confidence: 'Low', sourceIds: [], claimIds: [], updatedAt: now() }) }} />;
}

export function ResearchDecisionsView() { return <ResearchCasesView kind="Decision" />; }
export function ResearchProblemsView() { return <ResearchCasesView kind="Problem" />; }

function ResearchCasesView({ kind }: { kind: 'Decision' | 'Problem' }) {
  return <ResearchCollectionView config={{ key: 'cases', kind, title: kind === 'Decision' ? 'Decision Cases' : 'Problem Solver', subtitle: 'Stop research at the point of action: document criteria, evidence, rationale, and verification.', empty: 'No decision or problem cases yet', fields: [
    { key: 'criteria', label: 'Criteria and constraints', type: 'textarea', wide: true }, { key: 'optionsOrHypotheses', label: 'Options or hypotheses', type: 'textarea', wide: true }, { key: 'evidence', label: 'Evidence references', type: 'textarea', wide: true }, { key: 'rationale', label: 'Decision / fix rationale', type: 'textarea' }, { key: 'verification', label: 'Verification', type: 'textarea' }, { key: 'revisitTrigger', label: 'Revisit trigger', type: 'textarea', wide: true },
  ], create: () => ({ id: newInformationIntakeId('case'), title: kind === 'Decision' ? 'Untitled decision' : 'Untitled problem', status: 'Open', kind, updatedAt: now() }) }} />;
}

export function ResearchCreationView({ navigateView, currentView, ...props }: WorkspaceViewProps) {
  void props;
  if (currentView === 'information-outputs') return <InformationOutputsView />;
  return <ResearchCreationWorkspace navigateView={navigateView} />;
}

export function ResearchExternalizationView({ navigateView }: WorkspaceViewProps) { return <ResearchCreationWorkspace navigateView={navigateView} kind="Externalization" />; }

function ResearchCreationWorkspace({ navigateView, kind = 'Creation' }: Pick<WorkspaceViewProps, 'navigateView'> & { kind?: 'Creation' | 'Externalization' }) {
  const [data, persist] = useInformationIntakeStore();
  const createOutput = () => { const timestamp = now(); const type = defaultArtifactType(kind); const artifact = { id: newInformationIntakeId('artifact'), mode: kind, type, title: 'Untitled research output', body: artifactTemplate(type), status: 'Draft' as const, sourceUrls: [], createdAt: timestamp, updatedAt: timestamp }; persist((current) => ({ ...current, artifacts: [artifact, ...current.artifacts] })); navigateView('information-outputs'); };
  return <ResearchCollectionView config={{ key: 'creations', kind, title: kind === 'Creation' ? 'Creation Briefs' : 'Procedure Design', subtitle: 'Move synthesis into shipped artifacts, then externalize reusable procedures.', empty: 'No creation briefs yet', before: <div className="flex items-center gap-2"><LinkBanner text={`${data.artifacts.length} durable outputs in the shared output library`} /><Button size="sm" onClick={createOutput}><Plus/>New output</Button></div>, fields: [
    { key: 'purpose', label: 'Purpose', type: 'textarea' }, { key: 'audience', label: 'Audience', type: 'textarea' }, { key: 'acceptanceCriteria', label: 'Acceptance criteria', type: 'textarea', wide: true }, { key: 'artifactId', label: 'Output artifact ID' }, { key: 'noteId', label: 'Writing / note ID' }, { key: 'feedback', label: 'Feedback', type: 'textarea' }, { key: 'validation', label: 'Validation', type: 'textarea' }, { key: 'reviewDate', label: 'Review date', type: 'date' },
  ], create: () => ({ id: newInformationIntakeId('creation'), title: kind === 'Creation' ? 'Untitled creation' : 'Untitled procedure', status: 'Open', kind, updatedAt: now() }) }} />;
}

export function ResearchLearningView() {
  const [education] = useEducationStore();
  const nodes = education.nodes;
  return <ResearchCollectionView config={{ key: 'learningPlans', title: 'Practice Plans', subtitle: 'Convert findings into retrieval practice and demonstrated capability, linked to Education.', empty: 'No transfer plans yet', before: <LinkBanner text={`${nodes.length} Education nodes available; link one by its stable ID`} />, fields: [
    { key: 'capability', label: 'Target capability', type: 'textarea', wide: true }, { key: 'retrievalPrompts', label: 'Retrieval prompts', type: 'textarea' }, { key: 'practiceConditions', label: 'Practice conditions', type: 'textarea' }, { key: 'demonstrationTest', label: 'Demonstration test', type: 'textarea', wide: true }, { key: 'educationNodeId', label: 'Education node ID', placeholder: nodes[0]?.id }, { key: 'nextReview', label: 'Next retrieval review', type: 'date' },
  ], create: () => ({ id: newInformationIntakeId('learning'), title: 'Untitled transfer plan', status: 'Open', updatedAt: now() }) }} />;
}

export function ResearchIterationView() {
  return <ResearchCollectionView config={{ key: 'experiments', title: 'Experiments', subtitle: 'Reality-test knowledge and artifacts with explicit baselines, changes, metrics, and rollback.', empty: 'No experiments yet', fields: [
    { key: 'hypothesis', label: 'Hypothesis', type: 'textarea', wide: true }, { key: 'baseline', label: 'Baseline', type: 'textarea' }, { key: 'change', label: 'Applied change', type: 'textarea' }, { key: 'metric', label: 'Metric / success signal' }, { key: 'versionRef', label: 'Version / commit reference' }, { key: 'observation', label: 'Observation', type: 'textarea' }, { key: 'result', label: 'Result and next revision', type: 'textarea' }, { key: 'rollback', label: 'Rollback plan', type: 'textarea', wide: true },
  ], create: () => ({ id: newInformationIntakeId('experiment'), title: 'Untitled experiment', status: 'Open', updatedAt: now() }) }} />;
}

export function ResearchMaintenanceView() {
  const [data] = useInformationIntakeStore();
  const today = isoDate(new Date());
  const stale = staleArtifacts(data, today);
  return <ResearchCollectionView config={{ key: 'maintenanceReviews', title: 'Knowledge Maintenance', subtitle: 'Review stale outputs, broken references, duplicates, orphans, and the health of the workflow itself.', empty: 'No maintenance reviews scheduled', before: stale.length ? <LinkBanner warning text={`${stale.length} output${stale.length === 1 ? '' : 's'} currently due for review`} /> : <LinkBanner text="No durable outputs are currently overdue for review" />, fields: [
    { key: 'reviewDate', label: 'Review date', type: 'date' }, { key: 'policy', label: 'Review policy', type: 'textarea' }, { key: 'staleReviewed', label: 'Stale items reviewed', type: 'textarea' }, { key: 'brokenLinks', label: 'Broken links', type: 'textarea' }, { key: 'duplicates', label: 'Duplicates', type: 'textarea' }, { key: 'orphans', label: 'Orphan records', type: 'textarea' }, { key: 'actions', label: 'Actions and promotions', type: 'textarea', wide: true }, { key: 'completedAt', label: 'Completed on', type: 'date' },
  ], create: () => ({ id: newInformationIntakeId('review'), title: 'Monthly knowledge health review', status: 'Open', reviewDate: today, updatedAt: now() }) }} />;
}

function MasterLayout({ title, subtitle, records, selectedId, setSelectedId, create, query, setQuery, children }: { title: string; subtitle: string; records: Array<{ id: string; title: string; status: string }>; selectedId: string | null; setSelectedId: (id: string | null) => void; create: () => void; query?: string; setQuery?: (value: string) => void; children: React.ReactNode }) {
  const selected = records.find((record) => record.id === selectedId);
  return <div className="flex min-w-0 flex-1 flex-col overflow-hidden"><header className="shrink-0 border-b border-border px-4 py-2.5"><div className="flex items-center gap-3"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2><span className="sr-only">{subtitle}</span><Button size="sm" onClick={create}><Plus/>Add record</Button></div>{setQuery && <div className="relative mt-2 max-w-sm border-t border-border pt-2"><Search className="absolute left-2.5 top-[calc(50%+0.25rem)] size-3.5 -translate-y-1/2 text-muted-foreground"/><Input className="h-8 pl-8" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)}/></div>}</header><ScrollArea className="min-h-0 flex-1"><div className="mx-auto max-w-6xl p-4">{records.length === 0 ? <div className="border-y border-dashed border-border px-3 py-10"><Muted>No records yet.</Muted></div> : <div className="divide-y divide-border border-y border-border">{records.map((record) => <button type="button" key={record.id} onClick={() => setSelectedId(record.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"><span className="min-w-0 flex-1 truncate text-sm font-medium">{record.title}</span><Badge variant="outline" className="rounded-sm bg-transparent">{record.status}</Badge><span className="text-muted-foreground">→</span></button>)}</div>}</div></ScrollArea><EntryPopover open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }} title={selected?.title ?? title} description={subtitle}><EntryPopoverBody><div className="min-h-[50vh]">{children}</div></EntryPopoverBody></EntryPopover></div>;
}
function TitleRow({ value, onChange, onDelete, consequence }: { value: string; onChange: (value: string) => void; onDelete: () => void; consequence?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input className="h-10 flex-1 text-base font-semibold" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Title" />
      <ConfirmDelete itemName={value} itemLabel="record" onDelete={onDelete} consequence={consequence} size="icon" />
    </div>
  );
}
function DynamicField({ field, value, onChange }: { field: FormField; value: unknown; onChange: (value: unknown) => void }) {
  const shown = field.type === 'csv' ? csv(value) : value == null ? '' : String(value);
  if (field.type === 'textarea') return <Field label={field.label} className={cn(field.wide && 'md:col-span-2')}><Textarea rows={3} value={shown} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value || undefined)}/></Field>;
  if (field.type === 'select') return <Choice label={field.label} value={shown} onChange={onChange} options={field.options ?? []} className={cn(field.wide && 'md:col-span-2')}/>;
  return <Field label={field.label} className={cn(field.wide && 'md:col-span-2')}><Input className="h-8" type={field.type === 'date' ? 'date' : 'text'} value={shown} placeholder={field.placeholder} onChange={(event) => onChange(field.type === 'csv' ? lines(event.target.value) : event.target.value || undefined)}/></Field>;
}
function LinkBanner({ text, warning }: { text: string; warning?: boolean }) { return <div className={cn('flex flex-1 items-center gap-2 rounded-sm border p-3 text-xs', warning ? 'border-warning/40' : 'border-border')}><Link2 className="size-4 shrink-0 text-muted-foreground"/>{text}</div>; }
function Muted({ children }: { children: React.ReactNode }) { return <p className="py-3 text-xs text-muted-foreground">{children}</p>; }
