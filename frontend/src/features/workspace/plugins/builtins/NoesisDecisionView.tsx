import { useEffect, useState } from 'react';
import { usePlugins } from '../PluginProvider';
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
type Reference = { kind: string; id: string; namespace: string; version: number;
  locator?: { url?: string; page?: number; start?: number; end?: number; section?: string } };
type OriginSession = { session_id: string; mode: string; access_degraded?: boolean;
  references?: Reference[] };
type ModeSession = { session_id: string; mode: string; status: string; revision: number };
type DecisionLink = { id: string; noesisDecisionId: string; noesisRevision: number;
  objectVersion: number; updatedAt: string;
  origin?: { sessionId: string; reason: string }; sourceReferences: Reference[] };
type Criterion = { id: string; name: string; weight: string; yes: string;
  no: string; scenarioWeight: string };
type Comparison = { scores: Record<string, string | null>;
  missing_inputs: Record<string, string[]>; ordering_with_ties: string[][] };
type SensitivityReceipt = { receipt_id: string; decision_revision: number;
  baseline: Comparison; scenarios: (Comparison & { assumption: string; ordering_changed: boolean })[] };
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
const blankCriterion = (): Criterion => ({ id: crypto.randomUUID(), name: '', weight: '1',
  yes: '', no: '', scenarioWeight: '' });

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
export function NoesisDecisionView({ namespace, available, originSession, onWorkflowLinked }: {
  namespace: string; available: boolean; originSession?: OriginSession;
  onWorkflowLinked?: (session: ModeSession) => Promise<void>;
}) {
  const plugins = usePlugins();
  const pointer = usePluginState<Pointer>('information-intake', 'decision.last',
    { namespace }, 'modulo.intake.decision-link');
  const currentId = pointer.value.namespace === namespace ? pointer.value.decisionId : undefined;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [decision, setDecision] = useState<Decision>();
  const [linkedSession, setLinkedSession] = useState<ModeSession>();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scenarioAssumption, setScenarioAssumption] = useState('');
  const [comparisonProvenance, setComparisonProvenance] = useState('');
  const [comparison, setComparison] = useState<SensitivityReceipt>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDecision(undefined); setLinkedSession(undefined); setComparison(undefined);
    setDraft(emptyDraft()); setError(undefined);
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

  const compare = async () => {
    if (!decision) return;
    setBusy(true); setError(undefined); setComparison(undefined);
    try {
      const names = criteria.map(row => row.name.trim());
      if (!criteria.length || names.some(name => !name) || new Set(names).size !== names.length)
        throw new Error('Add at least one uniquely named criterion.');
      if (!comparisonProvenance.trim())
        throw new Error('Describe the source and scale of your utility inputs.');
      const weights = Object.fromEntries(criteria.map(row => [row.name.trim(), row.weight]));
      const inputs = Object.fromEntries((['yes', 'no'] as const).map(option => [option,
        Object.fromEntries(criteria.map(row => [row.name.trim(), row[option].trim() || null]))]));
      const changedWeights = Object.fromEntries(criteria.filter(row => row.scenarioWeight.trim())
        .map(row => [row.name.trim(), row.scenarioWeight.trim()]));
      if (Object.keys(changedWeights).length && !scenarioAssumption.trim())
        throw new Error('Name the assumption behind the alternative weights.');
      const scenarios = scenarioAssumption.trim()
        ? [{ assumption: scenarioAssumption.trim(), weights: changedWeights }] : [];
      setComparison(await intakeCall<SensitivityReceipt>('calculate_decision_sensitivity', {
        namespace, decision_id: decision.decision_id, revision: decision.revision,
        weights, inputs, scenarios, provenance: comparisonProvenance.trim(),
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const linkWorkflow = async (value: Decision) => {
    if (!/^decision:[0-9a-f]{32}$/.test(value.decision_id))
      throw new Error('Noesis returned an invalid decision identity.');
    const source = originSession?.mode === 'Exploration' || originSession?.mode === 'Deep Research'
      ? originSession : undefined;
    if (source?.access_degraded)
      throw new Error('The source session has inaccessible references. Restore access before linking it.');
    const priorReferences = source?.references ?? [];
    if (priorReferences.length >= 1000)
      throw new Error('The source session has too many references for a decision handoff.');
    const client = await plugins.state('information-intake');
    const linkId = `decision.${value.decision_id.slice('decision:'.length)}`;
    const existing = client.get(linkId);
    if (existing?.deleted || existing?.conflict)
      throw new Error('The Modulo decision link needs conflict or deletion review before handoff.');
    const prior = existing?.value as DecisionLink | undefined;
    if (prior && (prior.noesisDecisionId !== value.decision_id ||
      prior.noesisRevision > value.revision || !Number.isSafeInteger(prior.objectVersion)))
      throw new Error('The Modulo decision link disagrees with Noesis. Refresh before handoff.');
    const objectVersion = prior?.noesisRevision === value.revision
      ? prior.objectVersion : (prior?.objectVersion ?? 0) + 1;
    if (!prior || prior.noesisRevision !== value.revision) {
      const origin = prior?.origin ?? (source ? { sessionId: source.session_id,
        reason: 'Decision recorded from the linked research context' } : undefined);
      const link: DecisionLink = { id: linkId, noesisDecisionId: value.decision_id,
        noesisRevision: value.revision, objectVersion, updatedAt: new Date().toISOString(),
        ...(origin ? { origin } : {}),
        sourceReferences: prior?.sourceReferences ?? priorReferences,
      };
      if (prior) await client.set(linkId, link, 'modulo.intake.decision-link', 1);
      else await client.create(linkId, link, 'modulo.intake.decision-link', 1);
    }
    await client.synchronize();
    const stored = client.get(linkId);
    if (!stored || stored.pending || stored.conflict || stored.deleted)
      throw new Error('Save the Modulo decision link before creating the Noesis mode handoff.');
    const saved = stored.value as DecisionLink;
    if (saved.noesisDecisionId !== value.decision_id || saved.noesisRevision !== value.revision ||
      saved.objectVersion !== objectVersion || !Array.isArray(saved.sourceReferences))
      throw new Error('The confirmed Modulo decision link changed. Refresh before handoff.');
    const key = `${value.decision_id}-${value.revision}`;
    const reference: Reference = { kind: 'decision', id: value.decision_id,
      namespace, version: value.revision };
    const session = await intakeCall<ModeSession>('start_intake_mode', {
      namespace, mode: 'Decision Support', request_key: `modulo-decision-session-${key}`,
      intent: value.content.decision_context.question,
      ...(saved.origin ? { origin: { session_id: saved.origin.sessionId,
        reason: saved.origin.reason } } : {}),
      references: [...saved.sourceReferences, reference],
      workspace_links: [{ system: 'modulo', workspace_id: 'personal',
        kind: 'artifact', id: linkId, version: objectVersion }],
    });
    await intakeCall<ModeSession>('command_intake_mode', {
      namespace, session_id: session.session_id,
      command_key: `modulo-decision-record-${key}`, expected_revision: 1,
      action: 'record', payload: { data: { selected_option: value.content.selected_action,
        rationale: value.content.rationale } },
    });
    const completed = await intakeCall<ModeSession>('command_intake_mode', {
      namespace, session_id: session.session_id,
      command_key: `modulo-decision-complete-${key}`, expected_revision: 2,
      action: 'complete',
    });
    setLinkedSession(completed);
    await onWorkflowLinked?.(completed);
  };

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
      setDecision(next); setDraft(draftFromDecision(next)); setComparison(undefined);
      await linkWorkflow(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  const newChoice = async () => {
    setBusy(true); setError(undefined);
    try { await pointer.set({ namespace }); setDecision(undefined); setLinkedSession(undefined);
      setComparison(undefined); setCriteria([]);
      setDraft(emptyDraft()); }
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
    {linkedSession && <p className="text-xs text-muted-foreground">Decision Support session
      {' '}{linkedSession.session_id} · {linkedSession.status}</p>}
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
    {decision && !linkedSession && <button className={`${buttonClass} ml-2`} disabled={busy || !available}
      onClick={() => { setBusy(true); setError(undefined);
        void linkWorkflow(decision).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
          .finally(() => setBusy(false)); }}>Complete mode handoff</button>}
    {decision && <div className="space-y-3 border-t border-border pt-4">
      <div><h3 className="font-medium">Compare options</h3>
        <p className="text-muted-foreground">Enter comparable, author-supplied utilities. Empty values stay missing.</p></div>
      {criteria.map((row, index) => <div key={row.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-6">
        {(['name', 'weight', 'yes', 'no', 'scenarioWeight'] as const).map(field =>
          <label key={field} className="grid gap-1 text-xs">{({ name: 'Criterion', weight: 'Weight',
            yes: 'Yes utility', no: 'No utility', scenarioWeight: 'Scenario weight' })[field]} {index + 1}
            <input className={fieldClass} type={field === 'name' ? 'text' : 'number'}
              step="any" value={row[field]} onChange={event => setCriteria(previous => previous.map(item =>
                item.id === row.id ? { ...item, [field]: event.target.value } : item))} />
          </label>)}
        <button className={buttonClass} disabled={busy} onClick={() => setCriteria(previous =>
          previous.filter(item => item.id !== row.id))}>Remove</button>
      </div>)}
      <button className={buttonClass} disabled={busy || criteria.length >= 100}
        onClick={() => setCriteria(previous => [...previous, blankCriterion()])}>Add criterion</button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">Alternative weight assumption
          <input className={fieldClass} value={scenarioAssumption}
            onChange={event => setScenarioAssumption(event.target.value)} />
        </label>
        <label className="grid gap-1">Utility provenance and scale
          <input className={fieldClass} value={comparisonProvenance}
            onChange={event => setComparisonProvenance(event.target.value)} />
        </label>
      </div>
      <button className={buttonClass} disabled={busy || !available || !criteria.length}
        onClick={() => void compare()}>Calculate comparison</button>
      {comparison && <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Noesis receipt {comparison.receipt_id} · decision v{comparison.decision_revision}</p>
        <p>Baseline: {comparison.baseline.ordering_with_ties.map(group => group.join(' = ')).join(' → ') || 'Unranked'}</p>
        <p className="text-xs">Yes {comparison.baseline.scores.yes ?? 'missing'} · No {comparison.baseline.scores.no ?? 'missing'}</p>
        {Object.entries(comparison.baseline.missing_inputs).map(([option, missing]) =>
          <p className="text-xs text-muted-foreground" key={option}>{option}: missing {missing.join(', ')}</p>)}
        {comparison.scenarios.map((scenario, index) => <p key={index} className="text-xs">
          {scenario.assumption}: {scenario.ordering_with_ties.map(group => group.join(' = ')).join(' → ') || 'Unranked'}
          {scenario.ordering_changed ? ' · Ordering changed' : ' · Same ordering'}
        </p>)}
      </div>}
    </div>}
  </section>;
}
