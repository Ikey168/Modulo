import { useEffect, useRef, useState } from 'react';
import { authenticatedRequest } from '../../services/authenticatedRequest';
import { Button, Input } from '@/ui';

interface Hit { noteId: number; title: string; excerpt: string; score: number; lexicalScore: number; vectorScore: number; provider: string; model: string }
interface Answer { answer: string; answered: boolean; notice: string; citations: { noteId: number; title: string; excerpt: string }[] }
interface Suggestion { id: string; targetNoteId: number; explanation: string; status: string }
interface Preferences { provider_mode: string; monthly_budget_cents: number }

async function request<T>(path: string, signal: AbortSignal, body?: unknown, method = 'POST'): Promise<T> {
  const response = await authenticatedRequest(`/api/knowledge/${path}`, {
    signal, ...(body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Knowledge request failed (${response.status}). Your notes are still available.`);
  return response.json();
}

export function KnowledgePanel({ noteId, onSelect, onLinksChanged }: {
  noteId?: number; onSelect: (id: number) => void; onLinksChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [answer, setAnswer] = useState<Answer>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [preferences, setPreferences] = useState<Preferences>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef<AbortController>();
  useEffect(() => {
    setHits([]); setAnswer(undefined); setSuggestions([]); setError(''); setNotice('');
    return () => active.current?.abort();
  }, [noteId]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    request<Preferences>('preferences', controller.signal).then(setPreferences).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [open]);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setNotice('');
    try { await action(controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Knowledge is unavailable.'); }
    finally { if (active.current === controller) setBusy(false); }
  }
  function cancel() { active.current?.abort(); setBusy(false); setNotice('Request cancelled.'); }

  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="shrink-0 border-b border-border px-4 py-2">
    <summary className="cursor-pointer text-sm">Search knowledge and Ask Modulo</summary>
    <div className="max-h-[50vh] space-y-3 overflow-y-auto py-3 text-sm">
      <p>Local processing keeps note text on this server. Answers quote your notes and link to their sources.</p>
      <label className="flex flex-wrap items-center gap-2">Provider
        <select aria-label="Knowledge provider" className="rounded border border-border bg-background p-1" disabled={busy || !preferences}
          value={preferences?.provider_mode ?? 'LOCAL'} onChange={e => void run(async signal => {
            const value = await request<Preferences>('preferences', signal, { providerMode: e.target.value, remoteConsent: false, monthlyBudgetCents: 0 }, 'PUT');
            if (!signal.aborted) { setPreferences(value); setAnswer(undefined); setHits([]); setSuggestions([]); }
          })}>
          <option value="LOCAL">Local · no provider charges</option><option value="OFF">AI disabled · lexical search only</option>
          <option value="REMOTE" disabled>Remote · not configured</option>
        </select>
      </label>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void run(async signal => {
        const result = await request<Hit[]>(`search?q=${encodeURIComponent(query)}&limit=20`, signal);
        if (!signal.aborted) { setHits(result); setAnswer(undefined); setNotice(result.length ? '' : 'No matching notes.'); }
      }); }}>
        <Input aria-label="Knowledge question or search" className="min-w-40 flex-1" value={query} maxLength={2000} onChange={e => setQuery(e.target.value)} />
        <Button size="sm" disabled={busy || !query.trim()}>Search</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || !query.trim() || !preferences || preferences.provider_mode === 'OFF'} onClick={() => void run(async signal => {
          const result = await request<Answer>('ask', signal, { question: query, maxCitations: 5 });
          if (!signal.aborted) { setAnswer(result); setHits([]); }
        })}>Ask Modulo</Button>
        {busy && <Button type="button" size="sm" variant="outline" onClick={cancel}>Cancel</Button>}
      </form>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {answer && <section aria-label="Cited answer" className="space-y-2">
        <p className="whitespace-pre-wrap">{answer.answer}</p><p className="text-muted-foreground">{answer.notice}</p>
        <ol className="list-inside list-decimal space-y-2">{answer.citations.map((citation, index) => <li key={`${citation.noteId}:${index}`}>
          <button className="underline" onClick={() => onSelect(citation.noteId)}>{citation.title}</button>
          <blockquote className="border-l border-border pl-3">{citation.excerpt}</blockquote>
        </li>)}</ol>
      </section>}
      {hits.length > 0 && <ul aria-label="Knowledge results" className="space-y-3">{hits.map(hit => <li key={hit.noteId}>
        <button className="underline" onClick={() => onSelect(hit.noteId)}>{hit.title}</button><p>{hit.excerpt}</p>
        <p className="text-xs text-muted-foreground">Score {hit.score.toFixed(3)} · lexical {hit.lexicalScore.toFixed(3)} · semantic {hit.vectorScore.toFixed(3)} · {hit.provider}/{hit.model}</p>
      </li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || preferences?.provider_mode !== 'LOCAL'} onClick={() => void run(async signal => {
          const result = await request<{ embedded: number; failed: number }>('embeddings/backfill', signal, {});
          if (!signal.aborted) setNotice(`Indexed ${result.embedded} notes; ${result.failed} failed. Each batch processes up to 100 changed notes; repeat to continue.`);
        })}>Index next batch</Button>
        {noteId !== undefined && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async signal => {
          const result = await request<Suggestion[]>(`notes/${noteId}/suggestions`, signal);
          if (!signal.aborted) { setSuggestions(result.filter(item => item.status === 'PENDING')); setNotice(result.length ? '' : 'No new link suggestions.'); }
        })}>Review suggested links</Button>}
      </div>
      <ul className="space-y-3">{suggestions.map(item => <li key={item.id}>
        <button className="underline" onClick={() => onSelect(item.targetNoteId)}>Open suggested note #{item.targetNoteId}</button>
        <p>{item.explanation}</p><div className="flex flex-wrap gap-2">{(['ACCEPTED', 'REJECTED', 'DISMISSED'] as const).map((decision, index) =>
          <Button key={decision} size="sm" variant="outline" disabled={busy} onClick={() => void run(async signal => {
            await request(`suggestions/${item.id}/decision`, signal, { decision });
            if (!signal.aborted) { setSuggestions(previous => previous.filter(value => value.id !== item.id)); if (decision === 'ACCEPTED') await onLinksChanged(); }
          })}>{['Accept link', 'Reject link', 'Dismiss'][index]}</Button>)}</div>
      </li>)}</ul>
    </div>
  </details>;
}
