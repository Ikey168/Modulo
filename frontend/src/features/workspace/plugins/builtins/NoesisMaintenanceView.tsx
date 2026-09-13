import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type Finding = { id: string; reason: string; detail: string; suggested_action: string;
  target: { kind: string; id: string; namespace: string; version: number } };
type Scan = { findings: Finding[]; coverage: string[]; limitations: string[]; as_of_ms: number };
type Review = { action: string; observation: string; basis: string };
type Session = { session_id: string; mode: string; status: string; revision: number;
  duration_minutes: number; remaining_minutes?: number;
  inputs: { findings: Finding[] }; data: { maintenance_reviews?: Record<string, Review>;
    health_assessment?: { acceptable: boolean; criteria: string; observation: string;
      basis: string } }; unmet_completion_checks?: string[] };
type StartRequest = { namespace: string; request_key: string; intent: string;
  duration_minutes: number };
type ReviewRequest = { namespace: string; session_id: string; command_key: string;
  expected_revision: number; finding_id: string; action: string; observation: string };
type HealthRequest = { namespace: string; session_id: string; command_key: string;
  expected_revision: number; acceptable: boolean; criteria: string; observation: string };
type CompleteRequest = { namespace: string; session_id: string; command_key: string;
  expected_revision: number; action: 'complete'; payload: null };
type Pending = { tool: 'record_maintenance_finding'; args: ReviewRequest }
  | { tool: 'assess_maintenance_health'; args: HealthRequest }
  | { tool: 'command_intake_mode'; args: CompleteRequest };
type Pointer = { namespace: string; sessionId?: string; pendingStart?: StartRequest;
  pending?: Pending };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const label = (value: string) => value.replace(/_/g, ' ');

/** Modulo holds only navigation and retry state; Noesis owns the review snapshot. */
export function NoesisMaintenanceView({ namespace, available, onSessionChanged }: {
  namespace: string; available: boolean; onSessionChanged?: (session: Session) => Promise<void>;
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'maintenance.last',
    { namespace }, 'modulo.intake.maintenance-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.sessionId : undefined;
  const pendingStart = pointer.value.namespace === namespace ? pointer.value.pendingStart : undefined;
  const pending = pointer.value.namespace === namespace ? pointer.value.pending : undefined;
  const [scan, setScan] = useState<Scan>();
  const [session, setSession] = useState<Session>();
  const [intent, setIntent] = useState('Review stale and broken knowledge');
  const [duration, setDuration] = useState(45);
  const [findingAction, setFindingAction] = useState<Record<string, string>>({});
  const [findingNotes, setFindingNotes] = useState<Record<string, string>>({});
  const [criteria, setCriteria] = useState('No unresolved blocking failures');
  const [observation, setObservation] = useState('');
  const [acceptable, setAcceptable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setScan(undefined); setSession(undefined); setError(undefined);
    if (!available) return;
    let active = true;
    void intakeCall<Scan>('scan_intake_maintenance', { namespace })
      .then(value => {
        if (!Array.isArray(value.findings) || !Array.isArray(value.coverage) ||
            !Array.isArray(value.limitations)) throw new Error('Invalid Maintenance scan response');
        if (active) setScan(value);
      })
      .catch(cause => { if (active) setError(String(cause)); });
    if (currentId) void intakeCall<Session>('inspect_intake_mode', {
      namespace, session_id: currentId,
    }).then(value => { if (active) setSession(value); })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [available, currentId, namespace, refresh]);

  const changed = async (next: Session) => {
    setSession(next);
    if (onSessionChanged) await onSessionChanged(next);
  };

  const start = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Maintenance is unavailable.');
      if (pending) throw new Error('Retry the saved Maintenance change first.');
      let request = pendingStart;
      if (!request) {
        if (!intent.trim()) throw new Error('Enter a purpose for this review.');
        request = { namespace, request_key: `modulo-maintenance-${crypto.randomUUID()}`,
          intent: intent.trim(), duration_minutes: duration };
        await pointer.set({ namespace, pendingStart: request });
        await pointer.retry();
      }
      const next = await intakeCall<Session>('start_intake_maintenance', request);
      await pointer.set({ namespace, sessionId: next.session_id });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const send = async (request: Pending) => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Maintenance is unavailable.');
      if (pending || pendingStart) throw new Error('Retry the saved Maintenance operation first.');
      await pointer.set({ namespace, sessionId: session.session_id, pending: request });
      await pointer.retry();
      const next = await intakeCall<Session>(request.tool, request.args);
      await pointer.set({ namespace, sessionId: session.session_id });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const retry = async () => {
    if (!pending || !currentId) return;
    setBusy(true); setError(undefined);
    try {
      const next = await intakeCall<Session>(pending.tool, pending.args);
      await pointer.set({ namespace, sessionId: currentId });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const abandonRejected = async () => {
    if (!pending || !currentId) return;
    setBusy(true); setError(undefined);
    try {
      const current = await intakeCall<Session>('inspect_intake_mode', {
        namespace, session_id: currentId,
      });
      if (current.revision !== pending.args.expected_revision)
        throw new Error('The Noesis review changed. Retry the saved request before clearing it.');
      await pointer.set({ namespace, sessionId: currentId });
      await changed(current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const findings = session?.inputs.findings ?? scan?.findings ?? [];
  const reviews = session?.data.maintenance_reviews ?? {};
  const allReviewed = !!session && findings.every(item => !!reviews[item.id]);
  const health = session?.data.health_assessment;

  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold">Maintenance</h2>
        <p className="text-sm text-muted-foreground">Review stale intake work and record the health check.</p></div>
      <button className={buttonClass} disabled={busy || !available}
        onClick={() => setRefresh(value => value + 1)}>Reload</button>
    </div>
    {pointer.error && <p role="alert">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert">Resolve the Maintenance link sync conflict before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pendingStart && !currentId && <p role="status">Start may already be in Noesis. Retry uses the saved request.</p>}
    {pending && <div className="flex flex-wrap items-center gap-2">
      <p role="status">A Maintenance change may already be in Noesis. Retry uses its saved revision and key.</p>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void retry()}>Retry Maintenance change</button>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void abandonRejected()}>Abandon rejected change</button>
    </div>}
    {scan && <p className="text-xs text-muted-foreground">Current scan: {scan.findings.length} findings · {scan.coverage.join(', ')}. {scan.limitations.join('. ')}.</p>}
    {!currentId && <div className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-56 flex-1 gap-1 text-sm">Review purpose<input className={fieldClass}
        value={intent} onChange={event => setIntent(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Time box<select className={fieldClass} value={duration}
        onChange={event => setDuration(Number(event.target.value))}>
        <option value={30}>30 minutes</option><option value={45}>45 minutes</option>
        <option value={60}>60 minutes</option></select></label>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void start()}>{pendingStart ? 'Retry saved start' : 'Start monthly review'}</button>
    </div>}
    {session && <p className="text-xs text-muted-foreground">Noesis {session.session_id} · v{session.revision} · {session.status} · {session.remaining_minutes ?? session.duration_minutes} minutes left</p>}
    {findings.length > 0 && <div className="space-y-2">
      <h3 className="text-sm font-medium">{session ? 'Review snapshot' : 'Current findings'}</h3>
      {findings.map(item => <div className="rounded-md border border-border p-3 text-sm" key={item.id}>
        <p className="font-medium">{label(item.reason)} · {item.target.kind} {item.target.id} v{item.target.version}</p>
        <p className="text-muted-foreground">{item.detail}</p>
        <p className="text-xs text-muted-foreground">Suggested: {label(item.suggested_action)}</p>
        {reviews[item.id] ? <p role="status" className="mt-2 text-xs">{label(reviews[item.id].action)} · {reviews[item.id].observation} (reported)</p>
          : session?.status === 'active' && <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <label className="grid gap-1">Disposition<select className={fieldClass}
              value={findingAction[item.id] ?? 'reviewed'}
              onChange={event => setFindingAction(previous => ({ ...previous, [item.id]: event.target.value }))}>
              <option value="reviewed">Reviewed</option><option value="defer">Defer</option>
              <option value="refresh_reported">Refresh reported</option>
              <option value="repair_reported">Repair reported</option>
              <option value="archive_candidate">Archive candidate</option>
            </select></label>
            <label className="grid gap-1">Observation<input className={fieldClass}
              value={findingNotes[item.id] ?? ''}
              onChange={event => setFindingNotes(previous => ({ ...previous, [item.id]: event.target.value }))} /></label>
            <button className={`${buttonClass} self-end`} disabled={busy || !available || !!pending || !(findingNotes[item.id] ?? '').trim()}
              onClick={() => void send({ tool: 'record_maintenance_finding', args: {
                namespace, session_id: session.session_id, command_key: `modulo-maintenance-${crypto.randomUUID()}`,
                expected_revision: session.revision, finding_id: item.id,
                action: findingAction[item.id] ?? 'reviewed', observation: (findingNotes[item.id] ?? '').trim(),
              } })}>Record</button>
          </div>}
      </div>)}
    </div>}
    {session?.status === 'active' && <div className="space-y-2 rounded-md border border-border p-3 text-sm">
      <h3 className="font-medium">Health assessment</h3>
      {health && <p role="status">Last assessment: {health.acceptable ? 'acceptable' : 'needs work'} · {health.observation} (reported)</p>}
      <label className="grid gap-1">Criteria<input className={fieldClass} value={criteria}
        onChange={event => setCriteria(event.target.value)} /></label>
      <label className="grid gap-1">Observation<textarea className={fieldClass} rows={2}
        value={observation} onChange={event => setObservation(event.target.value)} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={acceptable}
        onChange={event => setAcceptable(event.target.checked)} />Criteria acceptable</label>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} disabled={busy || !available || !!pending || !criteria.trim() || !observation.trim()}
          onClick={() => void send({ tool: 'assess_maintenance_health', args: {
            namespace, session_id: session.session_id, command_key: `modulo-maintenance-${crypto.randomUUID()}`,
            expected_revision: session.revision, acceptable, criteria: criteria.trim(), observation: observation.trim(),
          } })}>Record health</button>
        <button className={buttonClass} disabled={busy || !available || !!pending || !allReviewed || health?.acceptable !== true}
          onClick={() => void send({ tool: 'command_intake_mode', args: {
            namespace, session_id: session.session_id, command_key: `modulo-maintenance-${crypto.randomUUID()}`,
            expected_revision: session.revision, action: 'complete', payload: null,
          } })}>Complete review</button>
      </div>
      <p className="text-xs text-muted-foreground">Review actions are recorded in Noesis. Refresh, repair, and archive labels do not run those actions.</p>
    </div>}
    {session?.status === 'completed' && <p role="status">Review completed. Deferred findings remain in its Noesis history.</p>}
  </section>;
}
