import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type Reference = { kind: string; id: string; namespace: string; version: number;
  locator?: { url?: string; page?: number; start?: number; end?: number; section?: string } };
type WorkspaceLink = { system: 'modulo'; workspace_id: string; kind: string;
  id: string; version: number };
type Origin = { session_id: string; access_degraded?: boolean;
  references?: Reference[]; workspace_links?: WorkspaceLink[] };
type StartPayload = { namespace: string; request_key: string; title: string;
  audience: string; artifact_type: 'post' | 'documentation' | 'teaching_material';
  purpose: string; criteria: string[]; inputs: Reference[]; workspace_links: WorkspaceLink[] };
type CreationPayload = { report_id?: string; revision?: number;
  checks?: Record<string, boolean>; notes?: string };
type PendingCommand = { key: string; action: 'attach_report' | 'review' | 'finish' | 'reopen';
  expectedRevision: number; payload: CreationPayload };
type Pointer = { namespace: string; projectId?: string; pendingStart?: StartPayload;
  pendingCommand?: PendingCommand };
type CreationProject = { project_id: string; revision: number; status: 'draft' | 'review' | 'finished';
  title: string; audience: string; purpose: string; artifact_type: string; criteria: string[];
  report: { id: string; revision: number } | null;
  review: { checks: Record<string, boolean>; notes: string; basis: string } | null };
type Exported = { sha256: string; publication_authorized: boolean;
  authored_report_export: { markdown: string } };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);

export function NoesisCreationView({ namespace, available, origin }: {
  namespace: string; available: boolean; origin?: Origin;
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'creation.last',
    { namespace }, 'modulo.intake.creation-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.projectId : undefined;
  const pendingStart = pointer.value.namespace === namespace ? pointer.value.pendingStart : undefined;
  const pendingCommand = pointer.value.namespace === namespace ? pointer.value.pendingCommand : undefined;
  const [project, setProject] = useState<CreationProject>();
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('');
  const [artifactType, setArtifactType] = useState<StartPayload['artifact_type']>('documentation');
  const [purpose, setPurpose] = useState('');
  const [criteriaText, setCriteriaText] = useState('');
  const [reportId, setReportId] = useState('');
  const [reportRevision, setReportRevision] = useState('1');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [exported, setExported] = useState<Exported>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setProject(undefined); setExported(undefined); setError(undefined);
    if (!available || !currentId) return;
    let active = true;
    void intakeCall<CreationProject>('inspect_intake_creation', { namespace, project_id: currentId })
      .then(value => { if (active) {
        setProject(value); setReportId(value.report?.id ?? '');
        setReportRevision(String(value.report?.revision ?? 1));
        setChecks(value.review?.checks ?? Object.fromEntries(value.criteria.map(item => [item, false])));
        setReviewNotes(value.review?.notes ?? '');
      } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [available, currentId, namespace, refresh]);

  const create = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when it reconnects.');
      if (pendingCommand) throw new Error('Retry the pending creation command first.');
      let payload = pendingStart;
      if (!payload) {
        const criteria = lines(criteriaText);
        if (!title.trim() || !audience.trim() || !purpose.trim() || !criteria.length)
          throw new Error('Enter a title, audience, purpose, and at least one acceptance criterion.');
        if (origin?.access_degraded)
          throw new Error('Source access changed. Reload the source session before linking it.');
        if ((origin?.references?.length ?? 0) > 100)
          throw new Error('Select a source session with at most 100 references.');
        payload = { namespace, request_key: `modulo-creation-${crypto.randomUUID()}`,
          title: title.trim(), audience: audience.trim(), artifact_type: artifactType,
          purpose: purpose.trim(), criteria, inputs: origin?.references ?? [],
          workspace_links: origin?.workspace_links ?? [] };
        await pointer.set({ namespace, pendingStart: payload });
        await pointer.retry();
      }
      const created = await intakeCall<CreationProject>('start_intake_creation', payload);
      await pointer.set({ namespace, projectId: created.project_id });
      setProject(created); setChecks(Object.fromEntries(created.criteria.map(item => [item, false])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const abandonStart = async () => {
    setBusy(true); setError(undefined);
    try {
      if (currentId) throw new Error('Reload the recorded creation before clearing its link.');
      await pointer.set({ namespace });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const command = async (action: PendingCommand['action'], payload: CreationPayload) => {
    if (!project) return;
    setBusy(true); setError(undefined); setExported(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when it reconnects.');
      if (pendingStart || pendingCommand) throw new Error('Retry the pending creation operation first.');
      const pending: PendingCommand = { key: `modulo-creation-${crypto.randomUUID()}`,
        action, expectedRevision: project.revision, payload };
      await pointer.set({ namespace, projectId: project.project_id, pendingCommand: pending });
      await pointer.retry();
      const next = await intakeCall<CreationProject>('command_intake_creation', {
        namespace, project_id: project.project_id, command_key: pending.key,
        expected_revision: pending.expectedRevision, action, payload,
      });
      await pointer.set({ namespace, projectId: project.project_id });
      setProject(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const retryCommand = async () => {
    if (!currentId || !pendingCommand) return;
    setBusy(true); setError(undefined);
    try {
      const next = await intakeCall<CreationProject>('command_intake_creation', {
        namespace, project_id: currentId, command_key: pendingCommand.key,
        expected_revision: pendingCommand.expectedRevision,
        action: pendingCommand.action, payload: pendingCommand.payload,
      });
      await pointer.set({ namespace, projectId: currentId });
      setProject(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const abandonRejectedCommand = async () => {
    if (!currentId || !pendingCommand) return;
    setBusy(true); setError(undefined);
    try {
      const current = await intakeCall<CreationProject>('inspect_intake_creation', {
        namespace, project_id: currentId,
      });
      if (current.revision !== pendingCommand.expectedRevision)
        throw new Error('The creation changed in Noesis. Retry the saved command before clearing it.');
      await pointer.set({ namespace, projectId: currentId });
      setProject(current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const exportProject = async () => {
    if (!project) return;
    setBusy(true); setError(undefined);
    try { setExported(await intakeCall<Exported>('export_intake_creation', {
      namespace, project_id: project.project_id,
    })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold">Creation</h2>
        <p className="text-sm text-muted-foreground">Review a Noesis-authored post, document, or teaching material against its purpose.</p></div>
      {currentId && <button className={buttonClass} disabled={busy || !available}
        onClick={() => setRefresh(value => value + 1)}>Reload</button>}
    </div>
    {pointer.error && <p role="alert">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert">Resolve the creation link sync conflict before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pendingStart && !currentId && <div className="flex flex-wrap items-center gap-2">
      <p role="status">A creation project may already be in Noesis. Retry sends the saved project and key.</p>
      <button className={buttonClass} disabled={busy || !!pointer.conflict}
        onClick={() => void abandonStart()}>Abandon pending creation</button>
    </div>}
    {pendingCommand && <div className="flex flex-wrap items-center gap-2">
      <p role="status">A creation change may already be in Noesis. Retry uses its saved revision and key.</p>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void retryCommand()}>Retry creation change</button>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void abandonRejectedCommand()}>Abandon rejected change</button>
    </div>}
    {!currentId && <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1">Title<input className={fieldClass} value={title}
        onChange={event => setTitle(event.target.value)} /></label>
      <label className="grid gap-1">Audience<input className={fieldClass} value={audience}
        onChange={event => setAudience(event.target.value)} /></label>
      <label className="grid gap-1">Artifact type<select className={fieldClass} value={artifactType}
        onChange={event => setArtifactType(event.target.value as StartPayload['artifact_type'])}>
        <option value="post">Post</option><option value="documentation">Documentation</option>
        <option value="teaching_material">Teaching material</option>
      </select></label>
      <label className="grid gap-1 sm:col-span-2">Purpose<textarea className={fieldClass} rows={2}
        value={purpose} onChange={event => setPurpose(event.target.value)} /></label>
      <label className="grid gap-1 sm:col-span-2">Acceptance criteria (one per line)
        <textarea className={fieldClass} rows={3} value={criteriaText}
          onChange={event => setCriteriaText(event.target.value)} /></label>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void create()}>{pendingStart ? 'Retry saved creation' : 'Start creation project'}</button>
    </div>}
    {project && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Noesis {project.project_id} · v{project.revision} · {project.status}</p>
      <p className="text-sm">{project.title} · {project.artifact_type} for {project.audience}</p>
      <p className="text-sm text-muted-foreground">{project.purpose}</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
        <label className="grid gap-1">Authored report ID<input className={fieldClass} value={reportId}
          onChange={event => setReportId(event.target.value)} /></label>
        <label className="grid gap-1">Revision<input className={fieldClass} type="number" min="1"
          value={reportRevision} onChange={event => setReportRevision(event.target.value)} /></label>
        <button className={`${buttonClass} self-end`} disabled={busy || !available || !!pendingCommand || project.status === 'finished'}
          onClick={() => void command('attach_report', { report_id: reportId.trim(), revision: Number(reportRevision) })}>
          Attach report</button>
      </div>
      <p className="text-xs text-muted-foreground">The report draft and citations stay in Noesis. Attach its current revision before review.</p>
      {project.report && <div className="space-y-2">
        <p className="text-sm">Attached {project.report.id} · v{project.report.revision}</p>
        {project.criteria.map(item => <label className="flex items-center gap-2 text-sm" key={item}>
          <input type="checkbox" checked={checks[item] ?? false}
            disabled={busy || project.status === 'finished'}
            onChange={event => setChecks(previous => ({ ...previous, [item]: event.target.checked }))} />
          {item}
        </label>)}
        <label className="grid gap-1 text-sm">Review notes<textarea className={fieldClass} rows={2}
          value={reviewNotes} disabled={project.status === 'finished'}
          onChange={event => setReviewNotes(event.target.value)} /></label>
        {project.status !== 'finished' && <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={busy || !available || !!pendingCommand}
            onClick={() => void command('review', { checks, notes: reviewNotes.trim() })}>Record author review</button>
          {project.status === 'review' && <button className={buttonClass}
            disabled={busy || !available || !!pendingCommand || !project.review ||
              !Object.values(project.review.checks).every(Boolean)}
            onClick={() => void command('finish', {})}>Finish reviewed artifact</button>}
        </div>}
      </div>}
      {project.status === 'finished' && <div className="flex flex-wrap gap-2">
        <button className={buttonClass} disabled={busy || !available}
          onClick={() => void exportProject()}>Export accepted artifact</button>
        <button className={buttonClass} disabled={busy || !available || !!pendingCommand}
          onClick={() => void command('reopen', {})}>Reopen for revision</button>
      </div>}
      {exported && <div className="space-y-1">
        <p className="text-xs text-muted-foreground">SHA-256 {exported.sha256} · Publication not authorized</p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border p-3 text-xs">
          {exported.authored_report_export.markdown}</pre>
      </div>}
    </div>}
  </section>;
}
