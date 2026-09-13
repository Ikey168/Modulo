import { useEffect, useState } from 'react';
import { usePluginState } from '../usePluginState';
import { intakeCall } from './noesisIntakeApi';

type Reference = { kind: string; id: string; namespace: string; version: number;
  locator?: { url?: string; page?: number; start?: number; end?: number; section?: string } };
type Draft = { title: string; kind: 'recall' | 'procedure' | 'explanation';
  prompt: string; answer: string; masteryCriterion: string; reference?: Reference };
type Pack = { pack_id: string; revision: number };
type DueCard = { pack_id: string; pack_revision: number; card_id: string;
  prompt: string; kind: string; due_at_ms: number; overdue_ms: number;
  self_reported_unassisted_passes: number };
type Review = { review_id: string; pack_id: string; pack_revision: number;
  card_id: string; revision: number; status: string; prompt: string; kind: string;
  attempt: string | null; assistance: string | null; answer?: string;
  answer_status?: string; assessment: { reported_passed: boolean; notes: string } | null };
type Action = 'attempt' | 'reveal' | 'assess';
type PendingCommand = { key: string; expectedRevision: number; action: Action;
  payload: { answer?: string; assisted?: boolean; passed?: boolean; notes?: string } };
type Pointer = { namespace: string; packId?: string; reviewId?: string;
  pendingCreate?: { key: string; draft: Draft };
  pendingReview?: { key: string; packId: string; cardId: string };
  pendingCommand?: PendingCommand };

const buttonClass = 'rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50';
const fieldClass = 'w-full rounded-md border border-border bg-background px-2 py-1.5';
const blankDraft = (): Draft => ({ title: '', kind: 'recall', prompt: '', answer: '',
  masteryCriterion: '' });

/** Modulo stores navigation/retry state; Noesis owns prompts, answers, reviews, and schedule. */
export function NoesisPracticeView({ namespace, available, references }: {
  namespace: string; available: boolean; references: Reference[];
}) {
  const pointer = usePluginState<Pointer>('information-intake', 'practice.last',
    { namespace }, 'modulo.intake.practice-link');
  const currentPackId = pointer.value.namespace === namespace ? pointer.value.packId : undefined;
  const currentReviewId = pointer.value.namespace === namespace ? pointer.value.reviewId : undefined;
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [referenceIndex, setReferenceIndex] = useState(0);
  const [due, setDue] = useState<DueCard[]>([]);
  const [review, setReview] = useState<Review>();
  const [attempt, setAttempt] = useState('');
  const [assisted, setAssisted] = useState(false);
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessmentPassed, setAssessmentPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setReview(undefined); setDue([]); setError(undefined);
    if (!available) return;
    let active = true;
    void intakeCall<{ cards: DueCard[] }>('list_due_practice', { namespace, limit: 50 })
      .then(value => { if (active) setDue(value.cards ?? []); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    if (currentReviewId) void intakeCall<Review>('inspect_practice_review', {
      namespace, review_id: currentReviewId,
    }).then(value => { if (active) setReview(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [available, namespace, currentPackId, currentReviewId, refresh]);

  useEffect(() => {
    if (pointer.value.namespace === namespace && pointer.value.pendingCreate)
      setDraft(pointer.value.pendingCreate.draft);
  }, [namespace, pointer.value]);

  const createPack = async () => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable.');
      if (!pointer.ready || pointer.conflict) throw new Error('Resolve plugin state first.');
      if (pointer.value.pendingReview || pointer.value.pendingCommand)
        throw new Error('Retry the pending review operation first.');
      const pending = pointer.value.namespace === namespace && pointer.value.pendingCreate
        ? pointer.value.pendingCreate : { key: `modulo-practice-pack-${crypto.randomUUID()}`,
          draft: { ...draft, reference: references[referenceIndex] } };
      const snapshot = pending.draft;
      if (!snapshot.reference || !snapshot.title.trim() || !snapshot.prompt.trim()
        || !snapshot.answer.trim() || !snapshot.masteryCriterion.trim())
        throw new Error('Select a source and complete the pack, prompt, answer, and mastery criterion.');
      await pointer.set({ namespace, ...(currentPackId ? { packId: currentPackId } : {}),
        ...(currentReviewId ? { reviewId: currentReviewId } : {}), pendingCreate: pending });
      await pointer.retry();
      const value = await intakeCall<Pack>('create_practice_pack', {
        namespace, request_key: pending.key, title: snapshot.title.trim(),
        cards: [{ kind: snapshot.kind, prompt: snapshot.prompt.trim(),
          answer: snapshot.answer.trim(), mastery_criterion: snapshot.masteryCriterion.trim(),
          references: [snapshot.reference] }],
      });
      await pointer.set({ namespace, packId: value.pack_id,
        ...(currentReviewId ? { reviewId: currentReviewId } : {}) });
      setDraft(blankDraft()); setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const startReview = async (card?: DueCard) => {
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable.');
      if (!pointer.ready || pointer.conflict) throw new Error('Resolve plugin state first.');
      if (pointer.value.pendingCreate || pointer.value.pendingCommand)
        throw new Error('Retry the pending pack or review command first.');
      const pending = pointer.value.namespace === namespace && pointer.value.pendingReview
        ? pointer.value.pendingReview : card ? {
          key: `modulo-practice-review-${crypto.randomUUID()}`,
          packId: card.pack_id, cardId: card.card_id,
        } : undefined;
      if (!pending) throw new Error('Choose a due card.');
      await pointer.set({ namespace, packId: pending.packId, pendingReview: pending });
      await pointer.retry();
      const value = await intakeCall<Review>('start_practice_review', {
        namespace, pack_id: pending.packId, card_id: pending.cardId,
        request_key: pending.key,
      });
      await pointer.set({ namespace, packId: pending.packId, reviewId: value.review_id });
      setReview(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const command = async (action: Action) => {
    if (!review) return;
    setBusy(true); setError(undefined);
    try {
      if (!available) throw new Error('Noesis is unavailable.');
      if (!pointer.ready || pointer.conflict) throw new Error('Resolve plugin state first.');
      const saved = pointer.value.namespace === namespace ? pointer.value.pendingCommand : undefined;
      if (saved && saved.action !== action) throw new Error('Retry the pending review command first.');
      if (!saved && action === 'attempt' && !attempt.trim())
        throw new Error('Record your answer before revealing the source answer.');
      if (!saved && action === 'assess' && !assessmentNotes.trim())
        throw new Error('Describe your self-assessment.');
      const pending: PendingCommand = saved ?? {
        key: `modulo-practice-command-${crypto.randomUUID()}`,
        expectedRevision: review.revision, action,
        payload: action === 'attempt' ? { answer: attempt.trim(), assisted }
          : action === 'assess' ? { passed: assessmentPassed,
            notes: assessmentNotes.trim() } : {},
      };
      if (!saved) {
        await pointer.set({ namespace, packId: review.pack_id, reviewId: review.review_id,
          pendingCommand: pending });
        await pointer.retry();
      }
      const value = await intakeCall<Review>('command_practice_review', {
        namespace, review_id: review.review_id, command_key: pending.key,
        expected_revision: pending.expectedRevision, action: pending.action,
        payload: pending.payload,
      });
      await pointer.set({ namespace, packId: review.pack_id, reviewId: review.review_id });
      setReview(value); setAttempt(''); setAssessmentNotes('');
      if (value.status === 'assessed') setRefresh(previous => previous + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const clearReview = async () => {
    if (!review) return;
    setBusy(true); setError(undefined);
    try {
      if (pointer.value.pendingCommand) throw new Error('Retry the pending command first.');
      await pointer.set({ namespace, packId: review.pack_id }); setReview(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <section className="space-y-3 border-b border-border pb-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">Retrieval practice</h2>
        <p className="text-muted-foreground">Review a source-linked prompt, answer before reveal, and schedule another attempt.</p></div>
      <button className={buttonClass} disabled={busy || !available}
        onClick={() => setRefresh(value => value + 1)}>Reload practice</button>
    </div>
    {pointer.error && <p role="alert" className="text-destructive">Plugin state: {pointer.error}</p>}
    {pointer.conflict && <p role="alert" className="text-destructive">Resolve the practice sync conflict before editing.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {pointer.value.pendingCreate && <p role="status">A pack save may already be in Noesis. Retry sends the original draft and key.</p>}
    {pointer.value.pendingReview && <button className={buttonClass} disabled={busy || !available}
      onClick={() => void startReview()}>Retry pending review start</button>}
    {review && pointer.value.pendingCommand && <button className={buttonClass}
      disabled={busy || !available || !!pointer.conflict}
      onClick={() => void command(pointer.value.pendingCommand!.action)}>Retry pending review command</button>}
    {currentPackId && <p className="text-xs text-muted-foreground">Current pack {currentPackId}</p>}
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="font-medium">Due and overdue</h3>
      {due.length ? <ol className="divide-y divide-border">
        {due.map(card => <li className="flex flex-wrap items-center justify-between gap-2 py-2"
          key={`${card.pack_id}:${card.card_id}`}>
          <span>{card.prompt} · {card.kind} · {card.overdue_ms > 0 ? 'overdue' : 'due'}</span>
          <button className={buttonClass} disabled={busy || !!currentReviewId || !!pointer.value.pendingReview
            || !!pointer.value.pendingCreate}
            onClick={() => void startReview(card)}>Review</button>
        </li>)}
      </ol> : <p className="text-muted-foreground">No practice cards are due.</p>}
    </div>
    {review && <div className="space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Review · {review.status}</h3>
        {review.status === 'assessed' && <button className={buttonClass} disabled={busy}
          onClick={() => void clearReview()}>Close review</button>}
      </div>
      <p>{review.prompt}</p>
      {review.status === 'active' && <>
        <label className="grid gap-1">Your answer before reveal
          <textarea className={fieldClass} rows={3} value={attempt}
            onChange={event => setAttempt(event.target.value)} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={assisted}
          onChange={event => setAssisted(event.target.checked)} />I used help or notes</label>
        <button className={buttonClass} disabled={busy || !!pointer.value.pendingCommand}
          onClick={() => void command('attempt')}>Record answer</button>
      </>}
      {review.attempt && <p>Your reported {review.assistance === 'reported_assisted' ? 'assisted' : 'unaided'} answer:
        {' '}{review.attempt}</p>}
      {review.status === 'attempted' && <button className={buttonClass} disabled={busy}
        onClick={() => void command('reveal')}>Reveal author answer</button>}
      {review.answer && <p>Author answer ({review.answer_status}): {review.answer}</p>}
      {review.status === 'revealed' && <>
        <label className="flex items-center gap-2"><input type="checkbox" checked={assessmentPassed}
          onChange={event => setAssessmentPassed(event.target.checked)} />I met my criterion</label>
        <label className="grid gap-1">Self-assessment notes
          <textarea className={fieldClass} rows={2} value={assessmentNotes}
            onChange={event => setAssessmentNotes(event.target.value)} /></label>
        <button className={buttonClass} disabled={busy}
          onClick={() => void command('assess')}>Save self-assessment</button>
      </>}
      {review.assessment && <p>Self-assessment: {review.assessment.reported_passed ? 'met' : 'not met'}
        {' '}· {review.assessment.notes}</p>}
    </div>}
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="font-medium">Author a source-linked card</h3>
      {!references.length && !pointer.value.pendingCreate &&
        <p className="text-muted-foreground">Open an intake session with a versioned source or concept before authoring.</p>}
      {(references.length > 0 || pointer.value.pendingCreate) && <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 sm:col-span-2">Source or concept
          <select className={fieldClass} value={referenceIndex}
            onChange={event => setReferenceIndex(Number(event.target.value))}>
            {references.map((ref, index) => <option key={`${ref.kind}:${ref.id}:${ref.version}`} value={index}>
              {ref.kind} · {ref.id} · v{ref.version}</option>)}
          </select></label>
        <label className="grid gap-1 sm:col-span-2">Pack title
          <input className={fieldClass} value={draft.title}
            onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></label>
        <label className="grid gap-1">Practice kind
          <select className={fieldClass} value={draft.kind}
            onChange={event => setDraft(value => ({ ...value,
              kind: event.target.value as Draft['kind'] }))}>
            <option value="recall">Recall</option><option value="procedure">Procedure</option>
            <option value="explanation">Explanation</option>
          </select></label>
        <label className="grid gap-1">Mastery criterion
          <input className={fieldClass} value={draft.masteryCriterion}
            onChange={event => setDraft(value => ({ ...value,
              masteryCriterion: event.target.value }))} /></label>
        <label className="grid gap-1 sm:col-span-2">Prompt
          <textarea className={fieldClass} rows={2} value={draft.prompt}
            onChange={event => setDraft(value => ({ ...value, prompt: event.target.value }))} /></label>
        <label className="grid gap-1 sm:col-span-2">Author answer
          <textarea className={fieldClass} rows={2} value={draft.answer}
            onChange={event => setDraft(value => ({ ...value, answer: event.target.value }))} /></label>
        <button className={buttonClass} disabled={busy || !pointer.ready || !!pointer.conflict}
          onClick={() => void createPack()}>{pointer.value.pendingCreate ? 'Retry pending pack save' : 'Create draft pack'}</button>
      </div>}
    </div>
  </section>;
}
