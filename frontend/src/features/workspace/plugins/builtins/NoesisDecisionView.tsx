import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type Pointer = { namespace: string; decisionId?: string; revision?: number; pendingKey?: string };
type DecisionContext = { question: string; stakes: string; required_confidence: string;
  stop_condition: string; uncertainty: string; missing_inputs: string[]; deadline_at_ms: number | null };
type DecisionContent = { project: null; decision_context: DecisionContext;
  options: { id: string; description: string }[]; constraints: string[]; assumptions: string[];
  observations: []; preferences: string[]; selected_action: 'yes' | 'no';
  rationale: string; review_conditions: string[] };
type Decision = { decision_id: string; namespace: string; revision: number;
  contract: string; content: DecisionContent; decided_at_ms: number };
type Draft = { question: string; yes: string; no: string; selected: 'yes' | 'no';
  rationale: string; stakes: string; confidence: string; stop: string; uncertainty: string;
  missing: string; deadline: string; constraints: string; assumptions: string;
  preferences: string; review: string };

const emptyDraft = (): Draft => ({ question: '', yes: '', no: '', selected: 'yes',
  rationale: '', stakes: '', confidence: '', stop: '', uncertainty: '',
  missing: '', deadline: '', constraints: '', assumptions: '', preferences: '', review: '' });
const split = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
const join = (values: string[]) => values.join('\n');
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const buttonClass = 'rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50';

function contentFromDraft(draft: Draft): DecisionContent {
  if (![draft.question, draft.yes, draft.no, draft.rationale, draft.stakes,
    draft.confidence, draft.stop, draft.uncertainty].every(value => value.trim())) {
    throw new Error('Complete the question, both options, stakes, confidence, stop condition, uncertainty, and rationale.');
  }
  const deadline = draft.deadline ? new Date(`${draft.deadline}T23:59:59`).getTime() : null;
  if (deadline !== null && !Number.isFinite(deadline)) throw new Error('Enter a valid deadline.');
  return {
    project: null,
    decision_context: {
      question: draft.question.trim(), stakes: draft.stakes.trim(),
      required_confidence: draft.confidence.trim(), stop_condition: draft.stop.trim(),
      uncertainty: draft.uncertainty.trim(), missing_inputs: split(draft.missing),
      deadline_at_ms: deadline,
    },
    options: [{ id: 'yes', description: draft.yes.trim() },
      { id: 'no', description: draft.no.trim() }],
    constraints: split(draft.constraints), assumptions: split(draft.assumptions),
    observations: [], preferences: split(draft.preferences),
    selected_action: draft.selected, rationale: draft.rationale.trim(),
    review_conditions: split(draft.review),
  };
}

function draftFromDecision(value: Decision): Draft {
  const content = value.content;
  const context = content.decision_context;
  return {
    question: context.question, yes: content.options.find(option => option.id === 'yes')?.description ?? '',
    no: content.options.find(option => option.id === 'no')?.description ?? '',
    selected: content.selected_action, rationale: content.rationale,
    stakes: context.stakes, confidence: context.required_confidence,
    stop: context.stop_condition, uncertainty: context.uncertainty,
    missing: join(context.missing_inputs),
    deadline: context.deadline_at_ms === null ? '' : new Date(context.deadline_at_ms).toISOString().slice(0, 10),
    constraints: join(content.constraints), assumptions: join(content.assumptions),
    preferences: join(content.preferences), review: join(content.review_conditions),
  };
}

/** A bounded user choice, stored in Noesis with only its versioned pointer in Modulo. */
export function NoesisDecisionView({ namespace, available }: { namespace: string; available: boolean }) {
  const pointer = usePluginState<Pointer>('information-intake', 'decision.last',
    { namespace }, 'modulo.intake.decision-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.decisionId : undefined;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [decision, setDecision] = useState<Decision>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDecision(undefined); setDraft(emptyDraft()); setError(undefined);
    if (!available || !currentId) return;
    let active = true;
    void intakeCall<Decision>('inspect_research_decision', { namespace, decision_id: currentId })
      .then(value => { if (active) { setDecision(value); setDraft(draftFromDecision(value)); } })
      .catch(cause => { if (active) { setDecision(undefined); setDraft(emptyDraft());
        setError(cause instanceof Error ? cause.message : String(cause)); } });
    return () => { active = false; };
  }, [available, currentId, namespace, refresh]);

  const update = (field: keyof Draft, value: string) =>
    setDraft(previous => ({ ...previous, [field]: value }));

  const save = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable. Retry when the connection returns.');
      const content = contentFromDraft(draft);
      let next: Decision;
      if (decision) {
        try {
          next = await intakeCall<Decision>('revise_research_decision', {
            namespace, decision_id: decision.decision_id,
            expected_revision: decision.revision, content,
          });
        } catch (cause) {
          // A lost response can follow a committed revision. Inspect before retrying.
          const current = await intakeCall<Decision>('inspect_research_decision', {
            namespace, decision_id: decision.decision_id,
          });
          if (current.revision !== decision.revision + 1 ||
            canonical(current.content) !== canonical(content)) throw cause;
          next = current;
        }
      } else {
        const requestKey = pointer.value.namespace === namespace && pointer.value.pendingKey
          ? pointer.value.pendingKey : `modulo-decision-${crypto.randomUUID()}`;
        await pointer.set({ namespace, pendingKey: requestKey });
        await pointer.retry();
        next = await intakeCall<Decision>('create_research_decision', {
          namespace, request_key: requestKey, content,
        });
      }
      await pointer.set({ namespace, decisionId: next.decision_id, revision: next.revision });
      setDecision(next); setDraft(draftFromDecision(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  const newChoice = async () => {
    setBusy(true); setError(undefined);
    try { await pointer.set({ namespace }); setDecision(undefined); setDraft(emptyDraft()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">Decision Support</h2>
        <p className="text-muted-foreground">Record a bounded choice without opening a research project.</p></div>
      <div className="flex gap-2">
        {currentId && <button className={buttonClass} disabled={busy || !available}
          onClick={() => setRefresh(value => value + 1)}>Reload</button>}
        {currentId && <button className={buttonClass} disabled={busy}
          onClick={() => void newChoice()}>New choice</button>}
      </div>
    </div>
    {pointer.error && <p role="alert">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert">The decision link has a sync conflict. Resolve it before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {decision && <p className="text-xs text-muted-foreground">Noesis {decision.decision_id} · v{decision.revision}</p>}
    {pointer.pending && <p role="status">Decision link is waiting to sync across devices.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2">Question
        <input className={fieldClass} value={draft.question} onChange={event => update('question', event.target.value)} />
      </label>
      <label className="grid gap-1">Yes option
        <input className={fieldClass} value={draft.yes} onChange={event => update('yes', event.target.value)} />
      </label>
      <label className="grid gap-1">No option
        <input className={fieldClass} value={draft.no} onChange={event => update('no', event.target.value)} />
      </label>
      <label className="grid gap-1">Stakes
        <input className={fieldClass} value={draft.stakes} onChange={event => update('stakes', event.target.value)} />
      </label>
      <label className="grid gap-1">Required confidence
        <input className={fieldClass} value={draft.confidence} onChange={event => update('confidence', event.target.value)} />
      </label>
      <label className="grid gap-1 sm:col-span-2">Stop condition
        <input className={fieldClass} value={draft.stop} onChange={event => update('stop', event.target.value)} />
      </label>
      <label className="grid gap-1 sm:col-span-2">Uncertainty
        <input className={fieldClass} value={draft.uncertainty} onChange={event => update('uncertainty', event.target.value)} />
      </label>
      <label className="grid gap-1">Deadline
        <input className={fieldClass} type="date" value={draft.deadline}
          onChange={event => update('deadline', event.target.value)} />
      </label>
      <label className="grid gap-1">Choose
        <select className={fieldClass} value={draft.selected}
          onChange={event => update('selected', event.target.value as 'yes' | 'no')}>
          <option value="yes">Yes</option><option value="no">No</option>
        </select>
      </label>
      <label className="grid gap-1 sm:col-span-2">Rationale
        <textarea className={fieldClass} rows={3} value={draft.rationale}
          onChange={event => update('rationale', event.target.value)} />
      </label>
      {(['missing', 'constraints', 'assumptions', 'preferences', 'review'] as const).map(field =>
        <label className="grid gap-1" key={field}>{({ missing: 'Missing inputs', constraints: 'Constraints',
          assumptions: 'Assumptions', preferences: 'Preferences', review: 'Review triggers' })[field]}
          <textarea className={fieldClass} rows={2} value={draft[field]}
            onChange={event => update(field, event.target.value)} placeholder="One per line" />
        </label>)}
    </div>
    <button className={buttonClass} disabled={busy || !pointer.ready || !!pointer.conflict || !available || (!!currentId && !decision)}
      onClick={() => void save()}>{decision ? 'Save decision revision' : 'Record choice'}</button>
  </section>;
}
