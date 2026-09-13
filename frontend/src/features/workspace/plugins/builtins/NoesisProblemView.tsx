import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type StepKind = 'hypothesis' | 'proposal' | 'reported_attempt' | 'verification';
type ProblemStep = { kind: StepKind; summary: string; observation: string | null;
  next_action: string | null; passed: boolean | null; at_ms: number };
type ProblemSession = { session_id: string; mode: string; status: string; revision: number;
  inputs: { symptom?: string; environment?: string; urgency?: string; success_check?: string };
  data: { problem_trail?: ProblemStep[]; redacted?: boolean };
  unmet_completion_checks?: string[]; access_degraded?: boolean };
type PendingStep = { key: string; expectedRevision: number; kind: StepKind; summary: string;
  observation: string | null; nextAction: string | null; passed: boolean | null };
type Pointer = { namespace: string; sessionId?: string; pendingStartKey?: string;
  pendingStep?: PendingStep };
type Origin = { session_id: string; mode: string; status: string; access_degraded?: boolean };
type Draft = { symptom: string; environment: string; urgency: string; successCheck: string };

const blankDraft = (): Draft => ({ symptom: '', environment: '', urgency: '', successCheck: '' });
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const buttonClass = 'rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50';

/** A Modulo return pointer with Noesis as the authoritative troubleshooting trail. */
export function NoesisProblemView({ namespace, available, originSession, onWorkflowLinked }: {
  namespace: string; available: boolean; originSession?: Origin;
  onWorkflowLinked?: (session: ProblemSession) => Promise<void>;
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'problem.last',
    { namespace }, 'modulo.intake.problem-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.sessionId : undefined;
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [session, setSession] = useState<ProblemSession>();
  const [kind, setKind] = useState<StepKind>('hypothesis');
  const [summary, setSummary] = useState('');
  const [observation, setObservation] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [passed, setPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setSession(undefined); setError(undefined);
    if (!available || !currentId) return;
    let active = true;
    void intakeCall<ProblemSession>('inspect_intake_mode', { namespace, session_id: currentId })
      .then(value => { if (active && value.mode === 'Problem-Solving') setSession(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [available, currentId, namespace, refresh]);

  const start = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      if (!Object.values(draft).every(value => value.trim()))
        throw new Error('Describe the symptom, environment, urgency, and observable success check.');
      if (originSession?.access_degraded)
        throw new Error('The source session has inaccessible references. Restore access before linking it.');
      const key = pointer.value.namespace === namespace && pointer.value.pendingStartKey
        ? pointer.value.pendingStartKey : `modulo-problem-${crypto.randomUUID()}`;
      await pointer.set({ namespace, pendingStartKey: key });
      await pointer.retry();
      const value = await intakeCall<ProblemSession>('start_problem_session', {
        namespace, request_key: key, symptom: draft.symptom.trim(),
        environment: draft.environment.trim(), urgency: draft.urgency.trim(),
        success_check: draft.successCheck.trim(),
        ...(originSession && originSession.mode !== 'Problem-Solving'
          ? { origin: { session_id: originSession.session_id,
            reason: 'Troubleshooting interrupted the linked intake workflow' } } : {}),
      });
      await pointer.set({ namespace, sessionId: value.session_id });
      setSession(value);
      await onWorkflowLinked?.(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const record = async () => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      const pending = pointer.value.namespace === namespace ? pointer.value.pendingStep : undefined;
      if (!pending && (!summary.trim() ||
        ((kind === 'reported_attempt' || kind === 'verification') && !observation.trim())))
        throw new Error('Add a step summary and an observed result for attempts or checks.');
      const step: PendingStep = pending ?? {
        key: `modulo-problem-step-${crypto.randomUUID()}`, expectedRevision: session.revision,
        kind, summary: summary.trim(), observation: observation.trim() || null,
        nextAction: nextAction.trim() || null, passed: kind === 'verification' ? passed : null,
      };
      if (!pending) { await pointer.set({ namespace, sessionId: session.session_id, pendingStep: step });
        await pointer.retry(); }
      const value = await intakeCall<ProblemSession>('record_problem_step', {
        namespace, session_id: session.session_id, command_key: step.key,
        expected_revision: step.expectedRevision, kind: step.kind, summary: step.summary,
        ...(step.observation ? { observation: step.observation } : {}),
        ...(step.nextAction ? { next_action: step.nextAction } : {}),
        ...(step.passed !== null ? { passed: step.passed } : {}),
      });
      await pointer.set({ namespace, sessionId: session.session_id });
      setSession(value); setSummary(''); setObservation(''); setNextAction(''); setPassed(false);
      await onWorkflowLinked?.(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const command = async (action: 'pause' | 'resume' | 'complete') => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      const value = await intakeCall<ProblemSession>('command_intake_mode', {
        namespace, session_id: session.session_id, command_key: crypto.randomUUID(),
        expected_revision: session.revision, action,
      });
      setSession(value);
      await onWorkflowLinked?.(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const newProblem = async () => {
    setBusy(true); setError(undefined);
    try { await pointer.set({ namespace }); setSession(undefined); setDraft(blankDraft()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">Problem-Solving</h2>
        <p className="text-muted-foreground">Record a fix trail and the check that shows whether it worked.</p></div>
      <div className="flex gap-2">
        {currentId && <button className={buttonClass} disabled={busy || !available}
          onClick={() => setRefresh(value => value + 1)}>Reload</button>}
        {currentId && <button className={buttonClass} disabled={busy}
          onClick={() => void newProblem()}>New problem</button>}
      </div>
    </div>
    {pointer.error && <p role="alert" className="text-destructive">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert" className="text-destructive">Resolve the problem link sync conflict before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pointer.pending && <p role="status">Problem link is waiting to sync across devices.</p>}
    {pointer.value.pendingStep && <p role="status">A step may have been saved. Retry the pending step to confirm it without duplicating it.</p>}
    {!session && <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2">Symptom
        <textarea className={fieldClass} rows={2} value={draft.symptom}
          onChange={event => setDraft(value => ({ ...value, symptom: event.target.value }))} /></label>
      <label className="grid gap-1">Environment and version
        <input className={fieldClass} value={draft.environment}
          onChange={event => setDraft(value => ({ ...value, environment: event.target.value }))} /></label>
      <label className="grid gap-1">Urgency
        <input className={fieldClass} value={draft.urgency}
          onChange={event => setDraft(value => ({ ...value, urgency: event.target.value }))} /></label>
      <label className="grid gap-1 sm:col-span-2">Observable success check
        <input className={fieldClass} value={draft.successCheck}
          onChange={event => setDraft(value => ({ ...value, successCheck: event.target.value }))} /></label>
      <button className={buttonClass} disabled={busy || !pointer.ready || !!pointer.conflict}
        onClick={() => void start()}>Start troubleshooting</button>
    </div>}
    {session && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Noesis {session.session_id} · v{session.revision} · {session.status}</p>
      <p><strong>Symptom:</strong> {session.inputs.symptom}</p>
      <p><strong>Success check:</strong> {session.inputs.success_check}</p>
      {session.access_degraded && <p role="alert">A linked source is inaccessible. Restore access before relying on this trail.</p>}
      <div className="flex gap-2">
        {session.status === 'active' && <button className={buttonClass} disabled={busy}
          onClick={() => void command('pause')}>Pause</button>}
        {session.status === 'paused' && <button className={buttonClass} disabled={busy}
          onClick={() => void command('resume')}>Resume</button>}
        {session.status === 'active' && <button className={buttonClass}
          disabled={busy || !!session.unmet_completion_checks?.length}
          onClick={() => void command('complete')}>Resolve verified problem</button>}
      </div>
      {session.status === 'active' && !session.access_degraded && <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">Step type
          <select className={fieldClass} value={kind} onChange={event => setKind(event.target.value as StepKind)}>
            <option value="hypothesis">Hypothesis</option><option value="proposal">Proposed fix</option>
            <option value="reported_attempt">Reported attempt</option><option value="verification">Verification</option>
          </select></label>
        <label className="grid gap-1">Next action
          <input className={fieldClass} value={nextAction} onChange={event => setNextAction(event.target.value)} /></label>
        <label className="grid gap-1 sm:col-span-2">Step summary
          <textarea className={fieldClass} rows={2} value={summary} onChange={event => setSummary(event.target.value)} /></label>
        {(kind === 'reported_attempt' || kind === 'verification') && <label className="grid gap-1 sm:col-span-2">Observed result
          <textarea className={fieldClass} rows={2} value={observation}
            onChange={event => setObservation(event.target.value)} /></label>}
        {kind === 'verification' && <label className="flex items-center gap-2">
          <input type="checkbox" checked={passed} onChange={event => setPassed(event.target.checked)} />Success check passed</label>}
        <button className={buttonClass} disabled={busy || !!pointer.conflict}
          onClick={() => void record()}>{pointer.value.pendingStep ? 'Retry pending step' : 'Add step'}</button>
      </div>}
      <ol className="divide-y divide-border">
        {session.data.problem_trail?.map((step, index) => <li key={`${step.at_ms}-${index}`} className="py-2">
          <div className="flex justify-between gap-2"><strong>{step.kind.replace('_', ' ')}</strong>
            <span className="text-xs text-muted-foreground">{new Date(step.at_ms).toLocaleString()}</span></div>
          <p>{step.summary}</p>
          {step.observation && <p className="text-muted-foreground">Observed: {step.observation}</p>}
          {step.kind === 'verification' && <p>{step.passed ? 'Check passed' : 'Check failed'}</p>}
          {step.next_action && <p className="text-muted-foreground">Next: {step.next_action}</p>}
        </li>)}</ol>
    </div>}
  </section>;
}
