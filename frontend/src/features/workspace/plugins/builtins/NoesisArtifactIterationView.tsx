import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import type { StateJson } from '../../../../services/pluginStateClient';
import { intakeCall } from './noesisIntakeApi';

type ObjectValue = Record<string, unknown>;
type TargetKind = 'decision' | 'report' | 'concept' | 'modulo_note';
type StartRequest = { tool: string; args: Record<string, StateJson> };
type PendingCommand = { tool: string; args: Record<string, StateJson>; expectedRevision: number };
type Pointer = { namespace: string; sessionId?: string; pendingStart?: StartRequest;
  pending?: PendingCommand };
type Iteration = { session_id: string; status: string; revision: number;
  inputs: ObjectValue; data: ObjectValue; unmet_completion_checks?: string[] };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const toRecord = (value: unknown): ObjectValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter a JSON object.');
  return value as ObjectValue;
};
const toStateJson = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Record<string, StateJson>;
const parseObject = (value: string, label: string): ObjectValue => {
  try { return toRecord(JSON.parse(value) as unknown); }
  catch (cause) { throw new Error(`${label} must be a JSON object: ${String(cause)}`); }
};
const parseEvidence = (value: string): ObjectValue[] => {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('Evidence must be a JSON array.'); }
  if (!Array.isArray(parsed) || parsed.length > 20 || parsed.some(item => !item || typeof item !== 'object' || Array.isArray(item)))
    throw new Error('Evidence must be an array of at most 20 reference objects.');
  return parsed as ObjectValue[];
};
const contractTool: Record<TargetKind, { start: string; propose: string; accept: string }> = {
  decision: { start: 'start_intake_decision_iteration', propose: 'propose_intake_decision_revision', accept: 'accept_intake_decision_revision' },
  report: { start: 'start_intake_report_iteration', propose: 'propose_intake_report_revision', accept: 'accept_intake_report_revision' },
  concept: { start: 'start_intake_concept_iteration', propose: 'propose_intake_concept_revision', accept: 'accept_intake_concept_revision' },
  modulo_note: { start: 'start_intake_modulo_note_iteration', propose: 'propose_intake_modulo_note_revision', accept: 'accept_intake_modulo_note_revision' },
};

/** Iteration for decision/report/concept records and a pinned Modulo note snapshot. */
export function NoesisArtifactIterationView({ namespace, available }: {
  namespace: string; available: boolean;
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'iteration-artifact.last',
    { namespace }, 'modulo.intake.iteration-artifact-link');
  const activePointer = pointer.value.namespace === namespace ? pointer.value : { namespace };
  const [session, setSession] = useState<Iteration>();
  const [target, setTarget] = useState<TargetKind>('decision');
  const [objectId, setObjectId] = useState('');
  const [objectRevision, setObjectRevision] = useState('1');
  const [conceptId, setConceptId] = useState('');
  const [pluginLink, setPluginLink] = useState('{\n  "workspace_id": "",\n  "account_id": "",\n  "plugin_id": "notes-editor",\n  "collection": "notes",\n  "record_id": "",\n  "authoritative_version": 1,\n  "representation": "intentional_snapshot",\n  "authority": "modulo"\n}');
  const [sourceSnapshot, setSourceSnapshot] = useState('{\n  "title": "",\n  "body": ""\n}');
  const [intent, setIntent] = useState('Review the original artifact after use');
  const [expected, setExpected] = useState('');
  const [stability, setStability] = useState('');
  const [observed, setObserved] = useState('');
  const [learning, setLearning] = useState('');
  const [metric, setMetric] = useState('');
  const [metricExpected, setMetricExpected] = useState('');
  const [metricObserved, setMetricObserved] = useState('');
  const [unit, setUnit] = useState('');
  const [uncertainty, setUncertainty] = useState('');
  const [externalCauses, setExternalCauses] = useState('');
  const [evidence, setEvidence] = useState('[]');
  const [proposalContent, setProposalContent] = useState('{\n  \n}');
  const [beforeAfter, setBeforeAfter] = useState('');
  const [stable, setStable] = useState(false);
  const [stabilityObservation, setStabilityObservation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setSession(undefined); setError(undefined);
    if (!available || !activePointer.sessionId) return;
    let live = true;
    void intakeCall<Iteration>('inspect_intake_mode', {
      namespace, session_id: activePointer.sessionId,
    }).then(value => { if (live) setSession(value); })
      .catch(cause => { if (live) setError(String(cause)); });
    return () => { live = false; };
  }, [activePointer.sessionId, available, namespace, refresh]);

  const start = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Iteration is unavailable.');
      let request = activePointer.pendingStart;
      if (!request) {
        const revision = Number(objectRevision);
        if (!Number.isInteger(revision) || revision < 1) throw new Error('Use a positive source revision.');
        if (!expected.trim() || !stability.trim() || !intent.trim())
          throw new Error('Enter an intent, expected outcome, and stability criteria.');
        const args: Record<string, unknown> = {
          namespace, request_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
          expected_revision: revision, expected: expected.trim(),
          stability_criteria: stability.trim(), intent: intent.trim(),
        };
        if (target === 'decision') args.decision_id = objectId.trim();
        if (target === 'report') args.report_id = objectId.trim();
        if (target === 'concept') { args.bundle_id = objectId.trim(); args.concept_id = conceptId.trim(); }
        if (target === 'modulo_note') {
          args.plugin_link = parseObject(pluginLink, 'Plugin link');
          args.source_snapshot = parseObject(sourceSnapshot, 'Source snapshot');
          delete args.expected_revision;
        }
        if (target !== 'modulo_note' && !objectId.trim()) throw new Error('Enter the original Noesis object ID.');
        if (target === 'concept' && !conceptId.trim()) throw new Error('Enter the concept ID.');
        request = { tool: contractTool[target].start, args: toStateJson(args) };
        await pointer.set({ namespace, pendingStart: request });
        await pointer.retry();
      }
      const next = await intakeCall<Iteration>(request.tool, request.args);
      await pointer.set({ namespace, sessionId: next.session_id });
      setSession(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const send = async (tool: string, args: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      if (!available || !pointer.ready || pointer.conflict) throw new Error('Iteration is unavailable.');
      if (activePointer.pending || activePointer.pendingStart) throw new Error('Retry the saved Iteration operation first.');
      const pending: PendingCommand = { tool, args: toStateJson(args), expectedRevision: session.revision };
      await pointer.set({ namespace, sessionId: session.session_id, pending });
      await pointer.retry();
      const next = await intakeCall<Iteration>(tool, args);
      await pointer.set({ namespace, sessionId: session.session_id });
      setSession(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const retry = async () => {
    const pendingStart = activePointer.pendingStart;
    const pending = activePointer.pending;
    if (!pendingStart && !pending) return;
    setBusy(true); setError(undefined);
    try {
      const request = pendingStart ?? pending!;
      const next = await intakeCall<Iteration>(request.tool, request.args);
      await pointer.set({ namespace, sessionId: next.session_id });
      setSession(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const abandonRejected = async () => {
    const pending = activePointer.pending;
    if (!activePointer.sessionId || !pending) return;
    setBusy(true); setError(undefined);
    try {
      const current = await intakeCall<Iteration>('inspect_intake_mode', {
        namespace, session_id: activePointer.sessionId,
      });
      if (current.revision !== pending.expectedRevision || current.status !== 'active')
        throw new Error('The Noesis cycle changed. Retry the saved request before clearing it.');
      await pointer.set({ namespace, sessionId: current.session_id });
      setSession(current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const canEdit = !!session && session.status === 'active' && available && pointer.ready
    && !busy && !pointer.conflict && !activePointer.pending && !activePointer.pendingStart;
  const submitOutcome = () => {
    if (!session || ![observed, learning, metric, metricExpected, metricObserved, unit,
      uncertainty, externalCauses].every(value => value.trim())) {
      setError('Complete the outcome, measurement, uncertainty, and possible external causes.'); return;
    }
    try {
      void send('record_intake_iteration_outcome', {
        namespace, session_id: session.session_id,
        command_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
        expected_revision: session.revision, observed: observed.trim(), learning: learning.trim(),
        measurements: [{ metric: metric.trim(), expected: metricExpected.trim(),
          observed: metricObserved.trim(), unit: unit.trim() }],
        uncertainty: uncertainty.trim(), external_causes: externalCauses.trim(),
        evidence: parseEvidence(evidence),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const submitProposal = () => {
    if (!session || !beforeAfter.trim()) { setError('Add a before/after rationale.'); return; }
    try {
      const kind = targetFor(session);
      const content = parseObject(proposalContent, 'Proposed content');
      void send(contractTool[kind].propose, {
        namespace, session_id: session.session_id,
        command_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
        expected_revision: session.revision,
        ...(kind === 'decision' || kind === 'report' ? { content } :
          kind === 'concept' ? { concept: content } : { content }),
        before_after_rationale: beforeAfter.trim(),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const targetKind = session ? targetFor(session) : target;
  const proposed = toRecordOrUndefined(session?.data.proposal);
  const accepted = toRecordOrUndefined(session?.data.accepted_revision);
  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="font-semibold">Other artifact iteration</h2>
        <p className="text-sm text-muted-foreground">Measure feedback against its original decision, report, concept, or Modulo note.</p></div>
      <button type="button" className={buttonClass} disabled={busy || !available}
        onClick={() => setRefresh(value => value + 1)}>Reload</button>
    </div>
    {(pointer.error || error) && <p role="alert" className="text-destructive">{pointer.error || error}</p>}
    {pointer.conflict && <p role="alert">Resolve the plugin state conflict before editing.</p>}
    {(activePointer.pendingStart || activePointer.pending) && <div className="flex flex-wrap items-center gap-2">
      <p role="status">The saved operation may already be in Noesis. Retry sends the same key and payload.</p>
      <button type="button" className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void retry()}>Retry saved iteration</button>
      {activePointer.pending && <button type="button" className={buttonClass}
        disabled={busy || !available || !!pointer.conflict}
        onClick={() => void abandonRejected()}>Abandon rejected change</button>}
    </div>}
    {!activePointer.sessionId && <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Original object type<select className={fieldClass}
        value={target} onChange={event => setTarget(event.target.value as TargetKind)}>
        <option value="decision">Noesis Decision Record</option><option value="report">Noesis authored report</option>
        <option value="concept">Research Bundle concept</option><option value="modulo_note">Modulo-owned note snapshot</option>
      </select></label>
      {target !== 'modulo_note' && <>
        <label className="grid gap-1 text-sm">{target === 'concept' ? 'Research Bundle ID' : 'Object ID'}
          <input className={fieldClass} value={objectId} onChange={event => setObjectId(event.target.value)} /></label>
        <label className="grid gap-1 text-sm">Pinned source revision<input className={fieldClass}
          inputMode="numeric" value={objectRevision} onChange={event => setObjectRevision(event.target.value)} /></label>
      </>}
      {target === 'concept' && <label className="grid gap-1 text-sm">Concept ID<input className={fieldClass}
        value={conceptId} onChange={event => setConceptId(event.target.value)} /></label>}
      {target === 'modulo_note' && <>
        <label className="grid gap-1 text-sm sm:col-span-2">Exact Modulo plugin link (JSON)<textarea className={fieldClass} rows={5}
          value={pluginLink} onChange={event => setPluginLink(event.target.value)} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Pinned note source snapshot (JSON)<textarea className={fieldClass} rows={4}
          value={sourceSnapshot} onChange={event => setSourceSnapshot(event.target.value)} /></label>
      </>}
      <label className="grid gap-1 text-sm">Intent<input className={fieldClass} value={intent}
        onChange={event => setIntent(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Expected outcome<input className={fieldClass} value={expected}
        onChange={event => setExpected(event.target.value)} /></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Stability criteria<input className={fieldClass}
        value={stability} onChange={event => setStability(event.target.value)} /></label>
      <button type="button" className={buttonClass} disabled={busy || !available || !!pointer.conflict}
        onClick={() => void start()}>{activePointer.pendingStart ? 'Retry saved cycle' : 'Start artifact iteration'}</button>
    </div>}
    {session && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Noesis {session.session_id} · v{session.revision} · {session.status} · {targetKind}</p>
      <p className="text-sm">Expected: {String(session.inputs.expected ?? '')}</p>
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
        <label className="grid gap-1 sm:col-span-2">Evidence references (JSON array)<textarea className={fieldClass}
          rows={3} value={evidence} onChange={event => setEvidence(event.target.value)} /></label>
        <button type="button" className={buttonClass} disabled={!canEdit} onClick={submitOutcome}>Record measured outcome</button>
      </div>}
      {!!session.data.outcome && <p role="status">Observed: {String(toRecord(session.data.outcome).observed ?? '')}
        {' '}· Learned: {String(toRecord(session.data.outcome).learning ?? '')}</p>}
      {!!session.data.outcome && !accepted && session.status === 'active' && <div className="space-y-2">
        <label className="grid gap-1">Proposed original-object content (JSON)<textarea className={fieldClass} rows={7}
          value={proposalContent} onChange={event => setProposalContent(event.target.value)} /></label>
        <label className="grid gap-1">Before/after rationale<textarea className={fieldClass}
          value={beforeAfter} onChange={event => setBeforeAfter(event.target.value)} /></label>
        <button type="button" className={buttonClass} disabled={!canEdit} onClick={submitProposal}>Save proposal for review</button>
        {proposed && <div className="rounded-md border border-border p-3 text-sm">
          <p role="status">Proposed revision: {String(proposed.review_state ?? 'review')}</p>
          <pre className="overflow-auto text-xs">{JSON.stringify(proposed, null, 2)}</pre>
          <p className="text-xs text-muted-foreground">Review this proposal before accepting it into its authoritative Noesis history.</p>
          <button type="button" className={buttonClass} disabled={!canEdit}
            onClick={() => void send(contractTool[targetKind].accept, {
              namespace, session_id: session.session_id,
              command_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision,
            })}>Accept proposed revision</button>
        </div>}
      </div>}
      {accepted && <p role="status">Accepted revision {String(accepted.revision ?? '')}.{' '}
        {targetKind === 'modulo_note' ? 'This is a local candidate; the Modulo note was not checked or changed.' : 'The original Noesis artifact history was updated.'}</p>}
      {accepted && session.status === 'active' && <div className="space-y-2">
        <p className="text-sm">Stability criteria: {String(session.inputs.stability_criteria ?? '')}</p>
        <label className="grid gap-1">Stability observation<input className={fieldClass}
          value={stabilityObservation} onChange={event => setStabilityObservation(event.target.value)} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={stable}
          onChange={event => setStable(event.target.checked)} />Criteria appear stable</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!canEdit || !stabilityObservation.trim()}
            onClick={() => void send('review_intake_iteration_stability', {
              namespace, session_id: session.session_id,
              command_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision, stable, observation: stabilityObservation.trim(),
            })}>Record stability review</button>
          <button type="button" className={buttonClass} disabled={!canEdit || !session.data.stability_review ||
            !!session.unmet_completion_checks?.length}
            onClick={() => void send('command_intake_mode', {
              namespace, session_id: session.session_id,
              command_key: `modulo-artifact-iteration-${crypto.randomUUID()}`,
              expected_revision: session.revision, action: 'complete', payload: null,
            })}>Close cycle</button>
        </div>
      </div>}
      {session.status === 'completed' && <p role="status">Cycle closed; the original artifact identity and revision remain in its history.</p>}
    </div>}
    <p className="text-xs text-muted-foreground">Measurements are caller-reported. A local Modulo note candidate does not perform live access recheck or writeback.</p>
  </section>;
}

function targetFor(session: Iteration): TargetKind {
  switch (session.inputs.iteration_contract) {
    case 'noesis-intake-iteration-decision-v1': return 'decision';
    case 'noesis-intake-iteration-report-v1': return 'report';
    case 'noesis-intake-iteration-concept-v1': return 'concept';
    default: return 'modulo_note';
  }
}

function toRecordOrUndefined(value: unknown): ObjectValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : undefined;
}
