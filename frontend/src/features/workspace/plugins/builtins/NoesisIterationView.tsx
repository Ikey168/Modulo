import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import type { StateJson } from '../../../../services/pluginStateClient';
import { intakeCall } from './noesisIntakeApi';

type Step = { action: string; expected_result: string; recovery: string };
type Playbook = { playbook_id: string; revision: number; title: string;
  prerequisites: string[]; environment: string; steps: Step[];
  verification: string; source_rationale: string };
type Iteration = { session_id: string; mode: string; status: string; revision: number;
  duration_minutes: number;
  inputs: { playbook: { id: string; version: number }; expected: string;
    stability_criteria: string }; data: { outcome?: { observed: string; learning: string };
    proposal?: { content: Playbook; before_after_rationale: string; review_state: string };
    accepted_revision?: { id: string; revision: number };
    stability_review?: { stable: boolean; observation: string } };
  unmet_completion_checks?: string[] };
type Start = { namespace: string; request_key: string; playbook_id: string;
  expected_revision: number; expected: string; stability_criteria: string; intent: string;
  origin_session_id?: string };
type Pending = { tool: string; args: Record<string, StateJson>; expectedRevision: number };
type Pointer = { namespace: string; sessionId?: string; previousSessionId?: string;
  pendingStart?: Start; pending?: Pending };
type Evidence = { kind: string; id: string; namespace: string; version: number };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const lines = (value: string) => value.split('\n').map(part => part.trim()).filter(Boolean);
const stepLines = (value: string): Step[] => lines(value).map(part => {
  const fields = part.split('|').map(field => field.trim());
  if (fields.length !== 3 || fields.some(field => !field))
    throw new Error('Each step needs action | expected result | recovery.');
  return { action: fields[0], expected_result: fields[1], recovery: fields[2] };
});

/** Modulo holds navigation and exact retry payloads; accepted history stays in Noesis. */
export function NoesisIterationView({ namespace, available, onSessionChanged }: {
  namespace: string; available: boolean; onSessionChanged?: (session: Iteration) => Promise<void>;
}) {
  const playbookLink = usePluginState<{ namespace: string; playbookId?: string }>(
    'information-intake', 'playbook.last', { namespace }, 'modulo.intake.playbook-link');
  const pointer = usePluginState<Pointer>('information-intake', 'iteration.last',
    { namespace }, 'modulo.intake.iteration-link');
  const sessionId = pointer.value.namespace === namespace ? pointer.value.sessionId : undefined;
  const pendingStart = pointer.value.namespace === namespace ? pointer.value.pendingStart : undefined;
  const pending = pointer.value.namespace === namespace ? pointer.value.pending : undefined;
  const previousSessionId = pointer.value.namespace === namespace ? pointer.value.previousSessionId : undefined;
  const linkedPlaybookId = playbookLink.value.namespace === namespace ? playbookLink.value.playbookId : undefined;
  const [playbook, setPlaybook] = useState<Playbook>();
  const [session, setSession] = useState<Iteration>();
  const [intent, setIntent] = useState('Check a procedure after use');
  const [expected, setExpected] = useState('');
  const [stabilityCriteria, setStabilityCriteria] = useState('');
  const [observed, setObserved] = useState('');
  const [learning, setLearning] = useState('');
  const [metric, setMetric] = useState('');
  const [metricExpected, setMetricExpected] = useState('');
  const [metricObserved, setMetricObserved] = useState('');
  const [unit, setUnit] = useState('');
  const [uncertainty, setUncertainty] = useState('');
  const [externalCauses, setExternalCauses] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [evidenceKind, setEvidenceKind] = useState('source');
  const [evidenceNamespace, setEvidenceNamespace] = useState(namespace);
  const [evidenceVersion, setEvidenceVersion] = useState('1');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrerequisites, setDraftPrerequisites] = useState('');
  const [draftEnvironment, setDraftEnvironment] = useState('');
  const [draftSteps, setDraftSteps] = useState('');
  const [draftVerification, setDraftVerification] = useState('');
  const [draftSourceRationale, setDraftSourceRationale] = useState('');
  const [beforeAfter, setBeforeAfter] = useState('');
  const [stable, setStable] = useState(false);
  const [stabilityObservation, setStabilityObservation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setPlaybook(undefined); setSession(undefined); setError(undefined);
    if (!available) return;
    let active = true;
    if (linkedPlaybookId) void intakeCall<Playbook>('inspect_intake_playbook', {
      namespace, playbook_id: linkedPlaybookId,
    }).then(value => { if (active) {
      setPlaybook(value); setDraftTitle(value.title);
      setDraftPrerequisites(value.prerequisites.join('\n'));
      setDraftEnvironment(value.environment);
      setDraftSteps(value.steps.map(step => `${step.action} | ${step.expected_result} | ${step.recovery}`).join('\n'));
      setDraftVerification(value.verification);
      setDraftSourceRationale(value.source_rationale);
    } }).catch(cause => { if (active) setError(String(cause)); });
    if (sessionId) void intakeCall<Iteration>('inspect_intake_mode', {
      namespace, session_id: sessionId,
    }).then(value => { if (active) setSession(value); })
      .catch(cause => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [available, linkedPlaybookId, namespace, sessionId, refresh]);

  const changed = async (value: Iteration) => {
    setSession(value);
    if (onSessionChanged) await onSessionChanged(value);
  };

  const start = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Iteration is unavailable.');
      if (!playbook && !pendingStart) throw new Error('Create or link a Noesis playbook first.');
      let request = pendingStart;
      if (!request) {
        if (!expected.trim() || !stabilityCriteria.trim() || !intent.trim())
          throw new Error('Enter an expected outcome, stability criteria, and purpose.');
        request = { namespace, request_key: `modulo-iteration-${crypto.randomUUID()}`,
          playbook_id: playbook!.playbook_id, expected_revision: playbook!.revision,
          expected: expected.trim(), stability_criteria: stabilityCriteria.trim(),
          intent: intent.trim(), ...(previousSessionId ? { origin_session_id: previousSessionId } : {}) };
        await pointer.set({ namespace, pendingStart: request });
        await pointer.retry();
      }
      const next = await intakeCall<Iteration>('start_intake_iteration', request);
      await pointer.set({ namespace, sessionId: next.session_id });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const send = async (tool: string, args: Record<string, StateJson>) => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Iteration is unavailable.');
      if (pending || pendingStart) throw new Error('Retry the saved Iteration operation first.');
      const request = { tool, args, expectedRevision: session.revision };
      await pointer.set({ namespace, sessionId: session.session_id, pending: request });
      await pointer.retry();
      const next = await intakeCall<Iteration>(tool, args);
      await pointer.set({ namespace, sessionId: session.session_id });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const retry = async () => {
    if (!sessionId || !pending) return;
    setBusy(true); setError(undefined);
    try {
      const next = await intakeCall<Iteration>(pending.tool, pending.args);
      await pointer.set({ namespace, sessionId });
      await changed(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const abandonRejected = async () => {
    if (!sessionId || !pending) return;
    setBusy(true); setError(undefined);
    try {
      const current = await intakeCall<Iteration>('inspect_intake_mode', { namespace, session_id: sessionId });
      if (current.revision !== pending.expectedRevision)
        throw new Error('The Noesis cycle changed. Retry the saved request before clearing it.');
      if (pending.tool === 'accept_intake_playbook_revision') {
        const latest = await intakeCall<Playbook>('inspect_intake_playbook', {
          namespace, playbook_id: current.inputs.playbook.id,
        });
        if (latest.revision !== current.inputs.playbook.version)
          throw new Error('The playbook changed in Noesis. Retry the saved acceptance before clearing it.');
      }
      await pointer.set({ namespace, sessionId });
      await changed(current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const submitOutcome = () => {
    if (!session) return;
    if (![observed, learning, metric, metricExpected, metricObserved, unit, uncertainty, externalCauses]
      .every(value => value.trim())) { setError('Complete the outcome, metric, uncertainty, and external causes.'); return; }
    const evidence: Evidence[] = [];
    if (evidenceId.trim()) {
      const version = Number(evidenceVersion);
      if (!Number.isInteger(version) || version < 1 || !evidenceNamespace.trim()) {
        setError('Evidence needs a namespace and positive version.'); return;
      }
      evidence.push({ kind: evidenceKind.trim(), id: evidenceId.trim(),
        namespace: evidenceNamespace.trim(), version });
    }
    void send('record_intake_iteration_outcome', {
      namespace, session_id: session.session_id, command_key: `modulo-iteration-${crypto.randomUUID()}`,
      expected_revision: session.revision, observed: observed.trim(), learning: learning.trim(),
      measurements: [{ metric: metric.trim(), expected: metricExpected.trim(),
        observed: metricObserved.trim(), unit: unit.trim() }],
      uncertainty: uncertainty.trim(), external_causes: externalCauses.trim(), evidence,
    });
  };

  const submitProposal = () => {
    if (!session) return;
    try {
      const steps = stepLines(draftSteps);
      if (!steps.length || !draftTitle.trim() || !draftEnvironment.trim() ||
          !draftVerification.trim() || !draftSourceRationale.trim() || !beforeAfter.trim())
        throw new Error('Complete the proposed playbook and before/after rationale.');
      void send('propose_intake_playbook_revision', {
        namespace, session_id: session.session_id, command_key: `modulo-iteration-${crypto.randomUUID()}`,
        expected_revision: session.revision, title: draftTitle.trim(),
        prerequisites: lines(draftPrerequisites), environment: draftEnvironment.trim(),
        steps, verification: draftVerification.trim(),
        source_rationale: draftSourceRationale.trim(), before_after_rationale: beforeAfter.trim(),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const canEdit = session?.status === 'active' && !pending && available && !busy;
  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold">Iteration</h2>
        <p className="text-sm text-muted-foreground">Measure a playbook result, review a change, and keep its history together.</p></div>
      <button className={buttonClass} disabled={busy || !available}
        onClick={() => setRefresh(value => value + 1)}>Reload</button>
    </div>
    {(pointer.error || playbookLink.error || error) && <p role="alert" className="text-destructive">{pointer.error || playbookLink.error || error}</p>}
    {(pointer.conflict || playbookLink.conflict) && <p role="alert">Resolve the plugin state conflict before editing.</p>}
    {pendingStart && !sessionId && <p role="status">Start may already be in Noesis. Retry sends the saved request.</p>}
    {pending && <div className="flex flex-wrap items-center gap-2">
      <p role="status">A cycle change may already be in Noesis. Retry uses the saved payload and revision.</p>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void retry()}>Retry Iteration change</button>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void abandonRejected()}>Abandon rejected change</button>
    </div>}
    <p className="text-xs text-muted-foreground">{playbook ? `Linked ${playbook.playbook_id} · v${playbook.revision}` : 'No linked playbook yet. Create one above first.'}</p>
    {!sessionId && <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Purpose<input className={fieldClass} value={intent}
        onChange={event => setIntent(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Expected outcome<input className={fieldClass} value={expected}
        onChange={event => setExpected(event.target.value)} /></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Stability criteria<input className={fieldClass}
        value={stabilityCriteria} onChange={event => setStabilityCriteria(event.target.value)} /></label>
      <button className={buttonClass} disabled={busy || !available || !!pointer.conflict || (!playbook && !pendingStart)}
        onClick={() => void start()}>{pendingStart ? 'Retry saved cycle' : 'Start playbook iteration'}</button>
    </div>}
    {session && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Noesis {session.session_id} · v{session.revision} · {session.status} · playbook v{session.inputs.playbook.version}</p>
      <p className="text-sm">Expected: {session.inputs.expected}</p>
      {!session.data.outcome && session.status === 'active' && <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">Observed outcome<input className={fieldClass} value={observed}
          onChange={event => setObserved(event.target.value)} /></label>
        <label className="grid gap-1">Learning<input className={fieldClass} value={learning}
          onChange={event => setLearning(event.target.value)} /></label>
        <label className="grid gap-1">Metric<input className={fieldClass} value={metric}
          onChange={event => setMetric(event.target.value)} /></label>
        <label className="grid gap-1">Unit<input className={fieldClass} value={unit}
          onChange={event => setUnit(event.target.value)} /></label>
        <label className="grid gap-1">Expected value<input className={fieldClass} value={metricExpected}
          onChange={event => setMetricExpected(event.target.value)} /></label>
        <label className="grid gap-1">Observed value<input className={fieldClass} value={metricObserved}
          onChange={event => setMetricObserved(event.target.value)} /></label>
        <label className="grid gap-1">Uncertainty<input className={fieldClass} value={uncertainty}
          onChange={event => setUncertainty(event.target.value)} /></label>
        <label className="grid gap-1">Possible external causes<input className={fieldClass} value={externalCauses}
          onChange={event => setExternalCauses(event.target.value)} /></label>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-4">
          <label className="grid gap-1">Evidence kind<input className={fieldClass} value={evidenceKind}
            onChange={event => setEvidenceKind(event.target.value)} /></label>
          <label className="grid gap-1">Evidence ID (optional)<input className={fieldClass} value={evidenceId}
            onChange={event => setEvidenceId(event.target.value)} /></label>
          <label className="grid gap-1">Namespace<input className={fieldClass} value={evidenceNamespace}
            onChange={event => setEvidenceNamespace(event.target.value)} /></label>
          <label className="grid gap-1">Version<input className={fieldClass} value={evidenceVersion}
            onChange={event => setEvidenceVersion(event.target.value)} /></label>
        </div>
        <button className={buttonClass} disabled={!canEdit} onClick={submitOutcome}>Record measured outcome</button>
      </div>}
      {session.data.outcome && <p role="status" className="text-sm">Observed: {session.data.outcome.observed} · Learned: {session.data.outcome.learning}</p>}
      {session.data.outcome && !session.data.accepted_revision && session.status === 'active' && <div className="space-y-2">
        <h3 className="font-medium">Proposed playbook revision</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">Proposed title<input className={fieldClass} value={draftTitle}
            onChange={event => setDraftTitle(event.target.value)} /></label>
          <label className="grid gap-1">Environment<input className={fieldClass} value={draftEnvironment}
            onChange={event => setDraftEnvironment(event.target.value)} /></label>
          <label className="grid gap-1">Prerequisites (one per line)<textarea className={fieldClass}
            value={draftPrerequisites} onChange={event => setDraftPrerequisites(event.target.value)} /></label>
          <label className="grid gap-1">Final check<input className={fieldClass} value={draftVerification}
            onChange={event => setDraftVerification(event.target.value)} /></label>
          <label className="grid gap-1 sm:col-span-2">Steps (action | expected result | recovery, one per line)
            <textarea className={fieldClass} rows={3} value={draftSteps}
              onChange={event => setDraftSteps(event.target.value)} /></label>
          <label className="grid gap-1 sm:col-span-2">Source rationale<textarea className={fieldClass}
            value={draftSourceRationale} onChange={event => setDraftSourceRationale(event.target.value)} /></label>
          <label className="grid gap-1 sm:col-span-2">Before/after rationale<textarea className={fieldClass}
            value={beforeAfter} onChange={event => setBeforeAfter(event.target.value)} /></label>
        </div>
        <button className={buttonClass} disabled={!canEdit} onClick={submitProposal}>Save proposal for review</button>
        {session.data.proposal && <div className="rounded-md border border-border p-3 text-sm">
          <p role="status">Proposed: {session.data.proposal.content.title} · {session.data.proposal.before_after_rationale}</p>
          <p className="text-xs text-muted-foreground">Review the values above before writing a new authoritative playbook revision.</p>
          <button className={buttonClass} disabled={!canEdit}
            onClick={() => void send('accept_intake_playbook_revision', {
              namespace, session_id: session.session_id,
              command_key: `modulo-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision,
            })}>Accept into playbook history</button>
        </div>}
      </div>}
      {session.data.accepted_revision && <p role="status">Accepted {session.data.accepted_revision.id} v{session.data.accepted_revision.revision} in Noesis history.</p>}
      {session.data.accepted_revision && session.status === 'active' && <div className="space-y-2">
        <p className="text-sm">Stability criteria: {session.inputs.stability_criteria}</p>
        {session.data.stability_review && <p role="status">{session.data.stability_review.stable ? 'Stable' : 'More cycles needed'} · {session.data.stability_review.observation}</p>}
        <label className="grid gap-1">Stability observation<input className={fieldClass}
          value={stabilityObservation} onChange={event => setStabilityObservation(event.target.value)} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={stable}
          onChange={event => setStable(event.target.checked)} />Criteria appear stable</label>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={!canEdit || !stabilityObservation.trim()}
            onClick={() => void send('review_intake_iteration_stability', {
              namespace, session_id: session.session_id,
              command_key: `modulo-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision, stable,
              observation: stabilityObservation.trim(),
            })}>Record stability review</button>
          <button className={buttonClass} disabled={!canEdit || !session.data.stability_review ||
            !!session.unmet_completion_checks?.length}
            onClick={() => void send('command_intake_mode', {
              namespace, session_id: session.session_id,
              command_key: `modulo-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision, action: 'complete', payload: null,
            })}>Close cycle</button>
        </div>
      </div>}
      {session.status === 'completed' && <p role="status">Cycle closed. Start another cycle when new feedback arrives.</p>}
      {session.status === 'completed' && <button className={buttonClass}
        disabled={busy || !!pending || !!pointer.conflict}
        onClick={() => void pointer.set({ namespace, previousSessionId: session.session_id })}>
        Start another cycle</button>}
      <p className="text-xs text-muted-foreground">Measurements and stability are caller-reported. A changed result does not establish causality.</p>
    </div>}
  </section>;
}
