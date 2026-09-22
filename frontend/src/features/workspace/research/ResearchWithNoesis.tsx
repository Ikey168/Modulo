import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from './api';
import type { NotePanelProps } from '../plugins/types';
import { emptyPolicy, researchPath, type ResearchRecord, type ResearchReference, type SourcePolicy } from './model';
import { ResearchResultCard } from './ResearchResultCard';
const field = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';
export const researchButton = 'rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50';

export function ResearchWithNoesis({ reference, expanded = false }: { reference?: ResearchReference; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded); const [question, setQuestion] = useState('');
  const [domains, setDomains] = useState<{ name: string; description: string }[]>([]); const [domain, setDomain] = useState('technology');
  const [policy, setPolicy] = useState<SourcePolicy>(emptyPolicy); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [results, setResults] = useState<ResearchRecord[]>([]);
  const [existingId, setExistingId] = useState('');
  const request = useRef({ signature: '', id: '' }); const pending = useRef(false);
  const referenceId = reference?.id; const referenceKind = reference?.kind;
  const load = useCallback(async () => {
    const catalog = await apiClient.get<{ name: string; description: string }[]>('/research/noesis/domains'); setDomains(catalog);
    let cursor: string | undefined; const all: ResearchRecord[] = [];
    do { const page = await apiClient.get<{ records: ResearchRecord[]; nextCursor?: string }>(`/research/noesis${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`); all.push(...page.records); cursor = page.nextCursor || undefined; } while (cursor);
    setResults(all.filter(r => !referenceId || r.value.references.some(ref => ref.id === referenceId && ref.kind === referenceKind)));
  }, [referenceId, referenceKind]);
  useEffect(() => { if (open) void load().catch(() => setError('Research could not be loaded. Try again.')); }, [open, load]);
  const action = async (work: () => Promise<void>) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { await work(); } catch { setError('The action could not complete. Reload to check the current result, then retry. Existing work is preserved.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const create = () => action(async () => {
    const cleanPolicy = { ...policy, allowedHosts: policy.allowedHosts.filter(Boolean), primaryHosts: policy.primaryHosts.filter(Boolean), languages: policy.languages.filter(Boolean), regions: policy.regions.filter(Boolean) };
    const body = { question, domain, policy: cleanPolicy, reference, publicQuestionConfirmed: confirmed };
    const signature = JSON.stringify(body);
    if (request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const saved = await apiClient.put<ResearchRecord>(`/research/noesis/${request.current.id}`, body);
    setResults(previous => [saved, ...previous.filter(r => r.key !== saved.key)]);
  });
  return <section className="space-y-3 border-t border-border pt-3">
    {!expanded && <button type="button" className={researchButton} aria-expanded={open} onClick={() => setOpen(!open)}>Research with Noesis</button>}
    {open && <>
      <p className="text-sm text-muted-foreground">Ask a public research question. Only the question goes to Noesis; this object's text stays in Modulo. Answers use sources already acquired in the selected corpus.</p>
      <label className="block text-sm">Research question<textarea className={field} value={question} maxLength={5000} onChange={e => { setQuestion(e.target.value); setConfirmed(false); }} /></label>
      <label className="block text-sm">Public corpus<select className={field} value={domain} onChange={e => setDomain(e.target.value)}>{domains.map(d => <option key={d.name} value={d.name}>{d.name} — {d.description}</option>)}</select></label>
      <details><summary className="cursor-pointer text-sm">Source discovery and coverage requirements</summary><p className="my-2 text-sm">Use official publishers for primary evidence, and independent sources for corroboration. Missing language, geography or recency metadata is reported as a coverage gap.</p>
        {(['allowedHosts', 'primaryHosts', 'languages', 'regions'] as const).map(key => <label key={key} className="block text-sm">{{ allowedHosts: 'Allowed source hosts (empty means any public source)', primaryHosts: 'Primary source hosts', languages: 'Required languages', regions: 'Required regions' }[key]}<input className={field} placeholder="Comma-separated values" value={policy[key].join(', ')} onChange={e => setPolicy({ ...policy, [key]: e.target.value.split(',').map(x => x.trim()) })} /></label>)}
        <label className="block text-sm">Maximum source age in days (0 means unrestricted)<input className={field} type="number" min={0} max={3650} value={policy.maxAgeDays} onChange={e => setPolicy({ ...policy, maxAgeDays: Number(e.target.value) })} /></label>
      </details>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the question and it contains only public information.</label>
      <div className="flex flex-wrap gap-2"><button type="button" className={researchButton} disabled={busy || !confirmed || !question.trim() || !domains.some(d => d.name === domain)} onClick={() => void create()}>{busy ? 'Working…' : 'Run research'}</button><button type="button" className={researchButton} disabled={busy} onClick={() => void action(load)}>Reload results</button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {reference && <details><summary className="cursor-pointer text-sm">Link an existing research result</summary><label className="block text-sm">Research result ID<input className={field} value={existingId} onChange={e => setExistingId(e.target.value)} /></label><button type="button" className={researchButton} disabled={busy || !/^[\w-]{8,100}$/.test(existingId)} onClick={() => void action(async () => { const current = await apiClient.get<ResearchRecord>(`/research/noesis/${existingId}`); await apiClient.post(`/research/noesis/${existingId}/links`, { expectedVersion: current.version, reference }); await load(); })}>Link to this object</button></details>}
      {results.map(record => expanded ? <ResearchResultCard key={record.key} record={record} onChange={next => setResults(previous => previous.map(r => r.key === next.key ? next : r))} /> : <p key={record.key} className="text-sm"><a className="underline" href={researchPath(record.key)}>{record.value.question}</a> · {record.value.snapshot.status}</p>)}
      {!results.length && <p className="text-sm text-muted-foreground">No research results yet.</p>}
    </>}
  </section>;
}
export function NoesisNotePanel({ note }: NotePanelProps) {
  return <ResearchWithNoesis reference={{ id: String(note.id), kind: 'note', title: note.title, route: `/app/notes?note=${note.id}` }} />;
}
