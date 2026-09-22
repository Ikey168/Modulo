import { useRef, useState } from 'react';
import { apiClient } from './api';
import { researchPath, type ResearchRecord } from './model';
const button = 'rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50';
const field = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';
export function ResearchResultCard({ record, onChange }: { record: ResearchRecord; onChange: (next: ResearchRecord) => void }) {
  const r = record.value; const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [findingId, setFindingId] = useState(''); const [title, setTitle] = useState(''); const [rationale, setRationale] = useState(''); const [kind, setKind] = useState('note');
  const [projectId, setProjectId] = useState(''); const refreshId = useRef(''); const pending = useRef(false);
  const run = async (operation: () => Promise<ResearchRecord>) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { onChange(await operation()); } catch { setError('Could not save this action. Reload the result to check for changes before retrying.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const refreshed = new Date(r.refreshedAt).toLocaleString();
  return <article id={`research-${r.id}`} className="my-4 space-y-3 rounded-lg border border-border p-4">
    <h2 className="text-lg font-medium"><a href={researchPath(r.id)}>{r.question}</a></h2>
    <p className="text-sm">{r.snapshot.status} · {r.domain} · Refreshed {refreshed}</p>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={() => void run(async () => { refreshId.current ||= crypto.randomUUID(); const next = await apiClient.post<ResearchRecord>(`/research/noesis/${r.id}/refresh`, { requestId: refreshId.current, expectedVersion: record.version }); refreshId.current = ''; return next; })}>Refresh research</button><button type="button" className={button} disabled={busy} onClick={() => void run(() => apiClient.get<ResearchRecord>(`/research/noesis/${r.id}`))}>Reload</button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-sm">{r.delta.kind === 'baseline' ? 'Initial evidence baseline.' : r.delta.kind === 'unchanged' ? 'No material evidence changes. No new work is needed.' : `Evidence changed: ${r.delta.findings.added.length} new, ${r.delta.findings.changed.length} revised, ${r.delta.findings.removed.length} removed findings; ${r.delta.sources.added.length} new sources.`}</p>
    {r.snapshot.refusal && <p role="status" className="text-sm">{r.snapshot.refusal}</p>}
    <ul className="space-y-3">{r.snapshot.findings.map(f => <li key={f.id} className="border-l-2 border-border pl-3"><p>{f.text}</p><p className="text-xs text-muted-foreground">{f.verdict} · {f.citationState} · {f.method}</p><p className="text-xs">Supporting sources: {f.support.map(id => <a key={id} className="mr-2 underline" href={`#${r.id}-${id}`}>{r.snapshot.sources.find(s => s.id === id)?.title || id}</a>)}</p>{f.contradictions.length > 0 && <p className="text-xs">Contradicting evidence: {f.contradictions.map(id => <a key={id} className="mr-2 underline" href={`#${r.id}-${id}`}>{r.snapshot.sources.find(s => s.id === id)?.title || id}</a>)}</p>}</li>)}</ul>
    <details><summary className="cursor-pointer text-sm">Sources ({r.snapshot.sources.length})</summary><ul className="space-y-3 py-2">{r.snapshot.sources.map(s => <li key={s.id} id={`${r.id}-${s.id}`} className="text-sm">{s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a> : s.title || s.documentId}<p>{s.excerpt}</p><p className="text-xs text-muted-foreground">{s.authority} · {s.documentId}</p></li>)}</ul></details>
    <details><summary className="cursor-pointer text-sm">Uncertainty, open questions and coverage</summary><ul className="list-disc space-y-1 pl-5 text-sm">{[...r.snapshot.coverageGaps, ...(r.snapshot.assumptions || [])].map((s, i) => <li key={i}>{s}</li>)}</ul><p className="mt-2 text-sm">Open question: does the available evidence answer the original question sufficiently? Review unresolved or contradictory findings before deciding.</p></details>
    {r.references.length > 0 && <p className="text-sm">Related objects: {r.references.map(ref => <a key={`${ref.kind}:${ref.id}`} href={ref.route} className="mr-3 underline">{ref.title}</a>)}</p>}
    <details><summary className="cursor-pointer text-sm">Turn a finding into work</summary><div className="space-y-2 py-2">
      <p className="text-sm">Choose a material finding and explain the action. Tasks enter your inbox. A decision input remains a draft note. Retrying preserves the original output.</p>
      <label className="block text-sm">Finding<select className={field} value={findingId} onChange={e => setFindingId(e.target.value)}><option value="">Choose a finding</option>{r.snapshot.findings.filter(f => f.support.length).map(f => <option key={f.id} value={f.id}>{f.text.slice(0, 180)}</option>)}</select></label>
      <label className="block text-sm">Output<select className={field} value={kind} onChange={e => setKind(e.target.value)}><option value="note">Synthesized note</option><option value="task">Task</option><option value="decision">Decision input</option><option value="project-update">Project update</option></select></label>
      <label className="block text-sm">Title<input className={field} value={title} maxLength={300} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">Why this matters / next action<textarea className={field} value={rationale} maxLength={2000} onChange={e => setRationale(e.target.value)} /></label>
      <label className="block text-sm">Project<select className={field} value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Use linked project, if any</option>{r.references.filter(ref => ref.kind === 'project').map(ref => <option key={ref.id} value={ref.id}>{ref.title}</option>)}</select></label>
      <button type="button" className={button} disabled={busy || r.snapshot.status === 'refused' || !findingId || !title.trim() || !rationale.trim()} onClick={() => void run(() => apiClient.post<ResearchRecord>(`/research/noesis/${r.id}/outputs`, { expectedVersion: record.version, runId: r.runId, findingId, kind, title, rationale, projectId }))}>Create linked work</button>
    </div></details>
    <button type="button" className={button} disabled={busy || r.outputs.some(o => o.runId === r.runId && o.kind === 'ignore')} onClick={() => void run(() => apiClient.post<ResearchRecord>(`/research/noesis/${r.id}/outputs`, { expectedVersion: record.version, runId: r.runId, kind: 'ignore' }))}>Reviewed — no action needed</button>
    {r.outputs.length > 0 && <ul className="text-sm">{r.outputs.map(o => <li key={o.id}>{o.kind === 'ignore' ? 'Reviewed without creating work' : o.noteId ? <a className="underline" href={`/app/notes?note=${o.noteId}`}>{o.kind}: open note</a> : <a className="underline" href={`/app/${o.kind === 'task' ? 'para-tasks' : 'para-core'}?record=${encodeURIComponent(`modulo-modified-para-v1:${o.kind === 'task' ? 'tasks' : 'projects'}:${o.targetId}`)}`}>{o.kind}: open output</a>}</li>)}</ul>}
    <details><summary className="cursor-pointer text-sm">Provenance and previous evidence</summary><p className="break-all text-xs">Result: {r.id}<br/>Run: {r.runId}<br/>Noesis endpoint: {r.runReference}<br/>Created: {r.createdAt}</p>{r.history.map(h => <details key={h.runId}><summary className="cursor-pointer break-all text-xs">{h.runId}</summary><ul className="text-sm">{h.snapshot.findings.map(f => <li key={f.id}>{f.text} — {f.verdict}</li>)}</ul><p className="text-xs">Sources: {h.snapshot.sources.map(s => s.url || s.documentId).join(', ')}</p></details>)}</details>
  </article>;
}
