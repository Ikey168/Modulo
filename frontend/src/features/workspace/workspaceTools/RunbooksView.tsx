import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { WorkspaceViewProps } from '../plugins/types';
import { bodyOf, download, field, now, request, uid, useAction, useToolStore } from './shared';
import { ToolPage } from './ToolPage';
import { emptyRunbooks, parseSteps, validateRunbooks, type RunStep } from './runbooks';

export default function RunbooksView({ data, onOpenNote }: WorkspaceViewProps) {
  const store = useToolStore('executable-runbooks', emptyRunbooks, validateRunbooks);
  const [params] = useSearchParams();
  const action = useAction(); const [noteId, setNoteId] = useState(''); const [selected, setSelected] = useState('');
  const [evidence, setEvidence] = useState(''); const [consent, setConsent] = useState(false);
  useEffect(() => { setSelected(params.get('run') ?? ''); setNoteId(params.get('note') ?? ''); setConsent(false); setEvidence(''); }, [params]);
  const run = store.value.runs.find(item => item.id === selected);
  const index = run?.steps.findIndex(step => step.state !== 'SUCCEEDED') ?? -1;
  const step = run && index >= 0 ? run.steps[index] : undefined;
  const updateStep = async (patch: Partial<RunStep>) => {
    await store.save(previous => ({ runs: previous.runs.map(item => item.id !== run?.id ? item : {
      ...item, steps: item.steps.map((old, i) => i === index ? { ...old, ...patch } : old),
    }) }));
  };
  const refresh = async (id: string) => {
    const receipt = await request<{ run: { state: string } }>(`/api/workflow-runs/${id}`);
    await updateStep({ state: receipt.run.state, ...(receipt.run.state === 'SUCCEEDED' ? { completedAt: now() } : {}) });
  };
  return <ToolPage title="Executable Runbooks" notice={store.notice}>{action.alert}
    <p className="text-sm">Select a note containing Markdown checklist steps. Append <code>[blueprint:name#trigger-id]</code> to a step to run an existing manual Blueprint. Approval nodes use the normal reviewer inbox.</p>
    <fieldset disabled={!store.ready || action.busy} className="flex flex-wrap gap-2">
      <label>Procedure <select aria-label="Procedure" className={field} value={noteId} onChange={e => setNoteId(e.target.value)}><option value="">Choose note</option>{data.notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
      <button className={field} disabled={!noteId} onClick={() => void action.run(async () => {
        const note = data.notes.find(item => item.id === Number(noteId)); if (!note) throw new Error('Note unavailable.');
        const next = { id: uid(), noteId: note.id, title: note.title, source: bodyOf(note), startedAt: now(), steps: parseSteps(bodyOf(note)) };
        await store.save(previous => ({ runs: [next, ...previous.runs] })); setSelected(next.id); setConsent(false); setEvidence('');
      })}>Start run</button>
    </fieldset>
    <ul className="divide-y divide-border">{store.value.runs.map(item => <li key={item.id} className="py-2"><button className="underline" disabled={action.busy} onClick={() => { setSelected(item.id); setConsent(false); setEvidence(''); }}>{item.title} · {item.steps.filter(s => s.state === 'SUCCEEDED').length}/{item.steps.length} · {new Date(item.startedAt).toLocaleString()}</button></li>)}</ul>
    {run && <section className="space-y-3 border-t border-border pt-4"><h2 className="font-medium">{run.title}</h2><button className="underline" onClick={() => onOpenNote(run.noteId)}>Open source note</button>
      <ol className="list-inside list-decimal space-y-2">{run.steps.map((item, i) => <li key={item.requestId} aria-current={i === index ? 'step' : undefined}>{item.label} — {item.state}{item.runId && !run.imported && <> · <Link className="underline" to={`/app/executions?run=${item.runId}`}>Execution and approvals</Link></>}{item.evidence && <p className="whitespace-pre-wrap text-sm">{item.evidence}</p>}</li>)}</ol>
      <details><summary>Procedure snapshot</summary><pre className="whitespace-pre-wrap text-sm">{run.source}</pre></details>
      {step && !run.imported && ['FAILED', 'CANCELLED', 'DEAD_LETTER'].includes(step.state) && <p role="status">This step did not succeed. Review its execution and approvals before starting a new run. Later steps remain blocked.</p>}
      {step && !run.imported && <fieldset disabled={action.busy || !store.ready} className="space-y-3">
        <label className="block">Step evidence<textarea className={`${field} block w-full`} value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
        <label className="flex gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{step.blueprint ? `Run ${step.blueprint} with this source note and its granted capabilities.` : 'I completed this manual step.'}</label>
        {step.blueprint ? <><button className={field} disabled={!consent || !!step.runId} onClick={() => void action.run(async () => {
          await updateStep({ state: 'REQUESTED', evidence });
          const result = await request<{ runId: string }>(`/api/blueprints/${encodeURIComponent(step.blueprint!)}/run`, { requestId: step.requestId, noteId: run.noteId, triggerId: step.trigger, confirmed: true });
          await updateStep({ runId: result.runId, state: 'RUNNING' }); setConsent(false); setEvidence('');
        })}>Execute step</button>{step.runId && <button className={`${field} ml-2`} onClick={() => void action.run(() => refresh(step.runId!))}>Refresh execution</button>}</>
          : <button className={field} disabled={!consent} onClick={() => void action.run(async () => { await updateStep({ state: 'SUCCEEDED', evidence, completedAt: now() }); setConsent(false); setEvidence(''); })}>Complete step</button>}
      </fieldset>}
      {run.imported && <p role="status">Imported historical receipt. It cannot execute or resume actions; start a new run from the procedure note.</p>}{!step && <p role="status">Run complete.</p>}<button className={field} onClick={() => download(`runbook-${run.id}.json`, run)}>Export receipt</button>
    <button className={`${field} ml-2`} disabled={action.busy || !store.ready || (!run.imported && run.steps.some(s => ['REQUESTED', 'RUNNING', 'QUEUED', 'WAITING', 'RETRY_WAIT'].includes(s.state)))} onClick={() => { if (window.confirm('Remove this runbook receipt? Workflow execution records remain available.')) void action.run(async () => { await store.save(previous => ({ runs: previous.runs.filter(item => item.id !== run.id) })); setSelected(''); }); }}>Remove receipt</button>
    </section>}
  </ToolPage>;
}
