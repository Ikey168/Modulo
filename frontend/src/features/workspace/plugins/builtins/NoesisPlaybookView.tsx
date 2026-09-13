import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type Step = { id: string; action: string; expected_result: string; recovery: string };
type DraftStep = { action: string; expectedResult: string; recovery: string };
type Draft = { title: string; prerequisites: string; environment: string;
  verification: string; sourceRationale: string; steps: DraftStep[] };
type Playbook = { playbook_id: string; namespace: string; revision: number; title: string;
  prerequisites: string[]; environment: string; steps: Step[]; verification: string;
  source_rationale: string; trust_state: string; reported_rehearsal_count?: number;
  origin: { session_id: string; revision: number } };
type Observation = { step_id: string; passed: boolean; observation: string; at_ms: number };
type Run = { run_id: string; playbook_id: string; playbook_revision: number; revision: number;
  status: string; next_step: number; observations: Observation[];
  verification: { passed: boolean; observation: string; at_ms: number } | null };
type PendingCommand = { key: string; expectedRevision: number; action: 'step' | 'verify';
  payload: { step_id?: string; passed: boolean; observation: string } };
type Pointer = { namespace: string; playbookId?: string; runId?: string;
  pendingSaveKey?: string; pendingRunKey?: string; pendingRunEnvironment?: string;
  pendingRunRevision?: number; pendingCommand?: PendingCommand };
type ProblemOrigin = { session_id: string; mode: string; status: string; revision: number;
  inputs: { symptom?: string; environment?: string; success_check?: string } };

const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const buttonClass = 'rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50';
const blankStep = (): DraftStep => ({ action: '', expectedResult: '', recovery: '' });
const blankDraft = (): Draft => ({ title: '', prerequisites: '', environment: '',
  verification: '', sourceRationale: '', steps: [blankStep()] });
const split = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean);
const fromPlaybook = (value: Playbook): Draft => ({
  title: value.title, prerequisites: value.prerequisites.join('\n'),
  environment: value.environment, verification: value.verification,
  sourceRationale: value.source_rationale,
  steps: value.steps.map(step => ({ action: step.action,
    expectedResult: step.expected_result, recovery: step.recovery })),
});

/** Modulo keeps navigation and retry keys; Noesis owns procedure revisions and run history. */
export function NoesisPlaybookView({ namespace, available, problemSession }: {
  namespace: string; available: boolean; problemSession?: ProblemOrigin;
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'playbook.last',
    { namespace }, 'modulo.intake.playbook-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.playbookId : undefined;
  const currentRunId = pointer.value.namespace === namespace ? pointer.value.runId : undefined;
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [playbook, setPlaybook] = useState<Playbook>();
  const [run, setRun] = useState<Run>();
  const [runPlaybook, setRunPlaybook] = useState<Playbook>();
  const [runEnvironment, setRunEnvironment] = useState('');
  const [observation, setObservation] = useState('');
  const [passed, setPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setPlaybook(undefined); setRun(undefined); setRunPlaybook(undefined); setError(undefined);
    if (!available || !currentId) return;
    let active = true;
    void intakeCall<Playbook>('inspect_intake_playbook', { namespace, playbook_id: currentId })
      .then(value => { if (active) { setPlaybook(value); setDraft(fromPlaybook(value)); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    if (currentRunId) void intakeCall<Run>('inspect_guided_playbook_run', {
      namespace, run_id: currentRunId,
    }).then(value => { if (active) setRun(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [available, currentId, currentRunId, namespace, refresh]);

  useEffect(() => {
    if (!available || !run || !playbook) return;
    if (run.playbook_revision === playbook.revision) {
      setRunPlaybook(playbook);
      return;
    }
    setRunPlaybook(undefined);
    let active = true;
    void intakeCall<Playbook>('inspect_intake_playbook', {
      namespace, playbook_id: run.playbook_id, revision: run.playbook_revision,
    }).then(value => { if (active) setRunPlaybook(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [available, namespace, playbook, run]);

  useEffect(() => {
    if (playbook || currentId || problemSession?.mode !== 'Problem-Solving'
      || problemSession.status !== 'completed') return;
    setDraft(value => ({ ...value,
      title: value.title || problemSession.inputs.symptom || '',
      environment: value.environment || problemSession.inputs.environment || '',
      verification: value.verification || problemSession.inputs.success_check || '',
      sourceRationale: value.sourceRationale ||
        `Derived from verified Noesis problem ${problemSession.session_id} v${problemSession.revision}.`,
    }));
  }, [playbook, currentId, problemSession]);

  const update = (field: keyof Omit<Draft, 'steps'>, value: string) =>
    setDraft(previous => ({ ...previous, [field]: value }));
  const updateStep = (index: number, field: keyof DraftStep, value: string) =>
    setDraft(previous => ({ ...previous, steps: previous.steps.map((step, position) =>
      position === index ? { ...step, [field]: value } : step) }));

  const save = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      if (!pointer.ready || pointer.conflict) throw new Error('Resolve plugin state before saving.');
      if (![draft.title, draft.environment, draft.verification, draft.sourceRationale]
        .every(value => value.trim()) || !draft.steps.length || draft.steps.some(step =>
          !step.action.trim() || !step.expectedResult.trim() || !step.recovery.trim()))
        throw new Error('Complete the title, environment, verification, rationale, and every step.');
      const details = {
        title: draft.title.trim(), prerequisites: split(draft.prerequisites),
        environment: draft.environment.trim(),
        steps: draft.steps.map(step => ({ action: step.action.trim(),
          expected_result: step.expectedResult.trim(), recovery: step.recovery.trim() })),
        verification: draft.verification.trim(), source_rationale: draft.sourceRationale.trim(),
      };
      const key = pointer.value.namespace === namespace && pointer.value.pendingSaveKey
        ? pointer.value.pendingSaveKey : `modulo-playbook-${crypto.randomUUID()}`;
      await pointer.set({ namespace, ...(playbook ? { playbookId: playbook.playbook_id,
        runId: currentRunId } : {}), pendingSaveKey: key });
      await pointer.retry();
      let value: Playbook;
      if (playbook) value = await intakeCall<Playbook>('revise_intake_playbook', {
        namespace, playbook_id: playbook.playbook_id, edit_key: key,
        expected_revision: playbook.revision, ...details,
      });
      else {
        if (problemSession?.mode !== 'Problem-Solving' || problemSession.status !== 'completed')
          throw new Error('Finish a verified Problem-Solving session before promotion.');
        value = await intakeCall<Playbook>('promote_problem_playbook', {
          namespace, problem_session_id: problemSession.session_id,
          request_key: key, ...details,
        });
      }
      await pointer.set({ namespace, playbookId: value.playbook_id,
        ...(currentRunId ? { runId: currentRunId } : {}) });
      setPlaybook(value); setDraft(fromPlaybook(value));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const startRun = async () => {
    if (!playbook) return;
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      const environment = pointer.value.pendingRunKey && pointer.value.pendingRunEnvironment
        ? pointer.value.pendingRunEnvironment : runEnvironment.trim();
      const revision = pointer.value.pendingRunKey && pointer.value.pendingRunRevision
        ? pointer.value.pendingRunRevision : playbook.revision;
      if (!environment) throw new Error('Name the rehearsal environment.');
      const key = pointer.value.namespace === namespace && pointer.value.pendingRunKey
        ? pointer.value.pendingRunKey : `modulo-guided-run-${crypto.randomUUID()}`;
      await pointer.set({ namespace, playbookId: playbook.playbook_id, pendingRunKey: key,
        pendingRunEnvironment: environment, pendingRunRevision: revision });
      await pointer.retry();
      const value = await intakeCall<Run>('start_guided_playbook_run', {
        namespace, playbook_id: playbook.playbook_id, request_key: key,
        playbook_revision: revision, environment,
      });
      await pointer.set({ namespace, playbookId: playbook.playbook_id, runId: value.run_id });
      setRun(value);
      setRunPlaybook(revision === playbook.revision ? playbook : undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const command = async (action: 'step' | 'verify' | 'pause' | 'resume') => {
    if (!run || !playbook) return;
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      const saved = pointer.value.namespace === namespace ? pointer.value.pendingCommand : undefined;
      if (saved && saved.action !== action)
        throw new Error('Retry the pending guided command before another action.');
      if (action === 'step' || action === 'verify') {
        if (!saved && !observation.trim()) throw new Error('Describe the observed result.');
        const stepId = action === 'step' && !saved && runPlaybook?.revision === run.playbook_revision
          ? runPlaybook.steps[run.next_step]?.id : undefined;
        if (action === 'step' && !saved && !stepId)
          throw new Error('The pinned playbook step is unavailable. Reload the run.');
        const pending: PendingCommand = saved ?? {
          key: `modulo-guided-command-${crypto.randomUUID()}`,
          expectedRevision: run.revision, action,
          payload: { ...(stepId ? { step_id: stepId } : {}),
            passed, observation: observation.trim() },
        };
        if (!saved) { await pointer.set({ namespace, playbookId: playbook.playbook_id,
          runId: run.run_id, pendingCommand: pending }); await pointer.retry(); }
        const value = await intakeCall<Run>('command_guided_playbook_run', {
          namespace, run_id: run.run_id, command_key: pending.key,
          expected_revision: pending.expectedRevision, action: pending.action,
          payload: pending.payload,
        });
        await pointer.set({ namespace, playbookId: playbook.playbook_id, runId: run.run_id });
        setRun(value); setObservation(''); setPassed(false);
      } else {
        const value = await intakeCall<Run>('command_guided_playbook_run', {
          namespace, run_id: run.run_id, command_key: crypto.randomUUID(),
          expected_revision: run.revision, action,
        });
        setRun(value);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const newPlaybook = async () => {
    setBusy(true); setError(undefined);
    try { await pointer.set({ namespace }); setPlaybook(undefined); setRun(undefined);
      setDraft(blankDraft()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const newRun = async () => {
    if (!playbook) return;
    setBusy(true); setError(undefined);
    try {
      if (pointer.value.pendingCommand) throw new Error('Retry the pending result first.');
      await pointer.set({ namespace, playbookId: playbook.playbook_id });
      setRun(undefined); setRunPlaybook(undefined); setRunEnvironment('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const activeStep = run && runPlaybook?.revision === run.playbook_revision
    ? runPlaybook.steps[run.next_step] : undefined;
  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">Playbooks</h2>
        <p className="text-muted-foreground">Promote a verified fix, then rehearse its steps with observations.</p></div>
      <div className="flex gap-2">
        {currentId && <button className={buttonClass} disabled={busy || !available}
          onClick={() => setRefresh(value => value + 1)}>Reload playbook</button>}
        {currentId && <button className={buttonClass} disabled={busy}
          onClick={() => void newPlaybook()}>New playbook</button>}
      </div>
    </div>
    {pointer.error && <p role="alert" className="text-destructive">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert" className="text-destructive">Resolve the playbook link sync conflict before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pointer.value.pendingCommand && <p role="status">A guided result may already be saved. Retry it with the original key.</p>}
    {run && pointer.value.pendingCommand && <button className={buttonClass}
      disabled={busy || !available || !!pointer.conflict}
      onClick={() => void command(pointer.value.pendingCommand!.action)}>Retry pending result</button>}
    {playbook && <p className="text-xs text-muted-foreground">Noesis {playbook.playbook_id} · v{playbook.revision}
      {' '}· {playbook.trust_state} · {playbook.reported_rehearsal_count ?? 0} reported rehearsals</p>}
    {!playbook && problemSession?.status !== 'completed' &&
      <p className="text-muted-foreground">Complete a verified Problem-Solving session to make a draft playbook.</p>}
    {(playbook || problemSession?.mode === 'Problem-Solving' && problemSession.status === 'completed') &&
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 sm:col-span-2">Title
          <input className={fieldClass} value={draft.title} onChange={event => update('title', event.target.value)} /></label>
        <label className="grid gap-1">Environment
          <input className={fieldClass} value={draft.environment}
            onChange={event => update('environment', event.target.value)} /></label>
        <label className="grid gap-1">Verification check
          <input className={fieldClass} value={draft.verification}
            onChange={event => update('verification', event.target.value)} /></label>
        <label className="grid gap-1 sm:col-span-2">Prerequisites, one per line
          <textarea className={fieldClass} rows={2} value={draft.prerequisites}
            onChange={event => update('prerequisites', event.target.value)} /></label>
        <label className="grid gap-1 sm:col-span-2">Source rationale
          <textarea className={fieldClass} rows={2} value={draft.sourceRationale}
            onChange={event => update('sourceRationale', event.target.value)} /></label>
        {draft.steps.map((step, index) => <div key={index} className="grid gap-2 border-t border-border pt-2 sm:col-span-2">
          <strong>Step {index + 1}</strong>
          {(['action', 'expectedResult', 'recovery'] as const).map(field =>
            <label className="grid gap-1" key={field}>{({ action: 'Action', expectedResult: 'Expected result',
              recovery: 'If it fails' })[field]}
              <textarea className={fieldClass} rows={2} value={step[field]}
                onChange={event => updateStep(index, field, event.target.value)} /></label>)}
        </div>)}
        <div className="flex gap-2 sm:col-span-2">
          <button className={buttonClass} disabled={busy || draft.steps.length >= 50}
            onClick={() => setDraft(value => ({ ...value, steps: [...value.steps, blankStep()] }))}>Add step</button>
          <button className={buttonClass} disabled={busy || !pointer.ready || !!pointer.conflict}
            onClick={() => void save()}>{playbook ? 'Save playbook revision' : 'Promote verified fix'}</button>
        </div>
      </div>}
    {playbook && <div className="space-y-2 border-t border-border pt-3">
      <h3 className="font-medium">Guided rehearsal</h3>
      {run && <button className={buttonClass} disabled={busy || !!pointer.value.pendingCommand}
        onClick={() => void newRun()}>Start another run</button>}
      {!run && <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-64 flex-1 gap-1">Environment used
          <input className={fieldClass} value={runEnvironment}
            onChange={event => setRunEnvironment(event.target.value)} /></label>
        <button className={buttonClass} disabled={busy} onClick={() => void startRun()}>Start guided run</button>
      </div>}
      {run && <>
        <p className="text-xs text-muted-foreground">Run {run.run_id} · playbook v{run.playbook_revision}
          {' '}· {run.status}</p>
        <div className="flex gap-2">
          {run.status === 'active' && <button className={buttonClass} disabled={busy}
            onClick={() => void command('pause')}>Pause run</button>}
          {run.status === 'paused' && <button className={buttonClass} disabled={busy}
            onClick={() => void command('resume')}>Resume run</button>}
        </div>
        {run.status === 'active' && runPlaybook?.revision === run.playbook_revision &&
          <div className="space-y-2">
          {activeStep ? <div className="space-y-1">
            <h4 className="font-medium">Next: {activeStep.action}</h4>
            <p>Expected: {activeStep.expected_result}</p>
            <p className="text-muted-foreground">If it fails: {activeStep.recovery}</p>
          </div> : <p>All steps recorded. Check: {runPlaybook.verification}</p>}
          <label className="grid gap-1">Observed result
            <textarea className={fieldClass} rows={2} value={observation}
              onChange={event => setObservation(event.target.value)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={passed}
            onChange={event => setPassed(event.target.checked)} />{activeStep ? 'Step passed' : 'Check passed'}</label>
          <button className={buttonClass} disabled={busy || !!pointer.conflict}
            onClick={() => void command(activeStep ? 'step' : 'verify')}>
            {pointer.value.pendingCommand ? 'Retry pending result' : 'Record observed result'}</button>
        </div>}
        <ol className="divide-y divide-border">
          {run.observations.map((entry, index) => <li className="py-2" key={`${entry.at_ms}-${index}`}>
            {entry.step_id}: {entry.passed ? 'passed' : 'failed'} · {entry.observation}</li>)}
        </ol>
        {run.verification && <p>Final check {run.verification.passed ? 'passed' : 'failed'}:
          {' '}{run.verification.observation}</p>}
      </>}
    </div>}
  </section>;
}
