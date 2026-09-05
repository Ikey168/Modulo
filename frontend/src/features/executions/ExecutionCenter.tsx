import { useEffect, useState, useRef } from 'react';
import { EvidenceExport } from './EvidenceExport';
import { WorkflowAlerts, WorkflowPolicy } from './WorkflowOperations';
import { Link, useSearchParams } from 'react-router-dom';
import { cancelRun, retryRun, editorRunLink, getRun, listRuns, safeSummary, type RunDetail, type RunPage } from './runService';

const states = ['QUEUED','RUNNING','WAITING','RETRY_WAIT','SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER'];
const inputClass = 'rounded border border-border bg-background p-2 text-sm';
export function ExecutionCenter() {
  const [params,setParams] = useSearchParams();
  const [page,setPage] = useState<RunPage | null>(null);
  const [detail,setDetail] = useState<RunDetail | null>(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const [busy,setBusy] = useState(false);
  const [confirmed,setConfirmed] = useState(false);
  const [checkpoint,setCheckpoint] = useState(0);
  const retryRequest = useRef<string | null>(null);
  const selected = params.get('run');
  useEffect(() => {setConfirmed(false);setCheckpoint(0);retryRequest.current=null;},[selected]);
  const query = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setPage(null); setDetail(null);
    const filters = new URLSearchParams(query); filters.delete('run'); filters.delete('stepPage');
    const request = selected ? getRun(selected, controller.signal, Number(new URLSearchParams(query).get('stepPage') ?? 0)).then(value => {if (!controller.signal.aborted) {setDetail(value);setCheckpoint(previous => value.checkpoints?.includes(previous) ? previous : (value.checkpoints?.[0] ?? 0));}}) : listRuns(filters,controller.signal).then(value => {if(!controller.signal.aborted) setPage(value);});
    request.catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  },[query,selected,revision]);
  function filter(key: string,value: string) {
    const next = new URLSearchParams(params); next.delete('page'); next.delete('run');
    if(value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:true});
  }
  function openRun(id?: string) { const next = new URLSearchParams(params); if(id) next.set('run',id); else next.delete('run'); next.delete('stepPage'); setParams(next); }
  async function recover(kind: 'cancel' | 'retry') {
    if(!selected) return;
    setBusy(true);setError('');
    try {
      if(kind === 'cancel') {await cancelRun(selected);setRevision(value => value+1);}
      else {retryRequest.current ??= crypto.randomUUID(); const id=await retryRun(selected,retryRequest.current,checkpoint,confirmed);openRun(id);}
    } catch(reason) {setError((reason as Error).message);} finally {setBusy(false);}
  }
  return <main className="flex-1 overflow-y-auto p-5 md:p-8">
    <h1 className="mb-5 text-2xl font-semibold">Execution Center</h1>
    {!selected && <WorkflowAlerts />}
    {selected ? <button className="mb-4 underline" onClick={() => openRun()}>Back to runs</button> : <form className="mb-6 flex flex-wrap gap-3" onSubmit={event => event.preventDefault()}>
      <label className="flex flex-col gap-1">Search<input className={inputClass} value={params.get('q') ?? ''} maxLength={128} onChange={event => filter('q',event.target.value)} placeholder="Blueprint, run ID, or error" /></label>
      <label className="flex flex-col gap-1">Status<select className={inputClass} value={params.get('state') ?? ''} onChange={event => filter('state',event.target.value)}><option value="">All statuses</option>{states.map(state => <option key={state}>{state}</option>)}</select></label>
      <label className="flex flex-col gap-1">Blueprint ID<input className={inputClass} type="number" min="1" value={params.get('blueprint') ?? ''} onChange={event => filter('blueprint',event.target.value)} /></label>
      <label className="flex flex-col gap-1">Trigger<input className={inputClass} value={params.get('trigger') ?? ''} maxLength={128} onChange={event => filter('trigger',event.target.value)} /></label>
      <label className="flex flex-col gap-1">From<input className={inputClass} type="date" value={params.get('after')?.slice(0,10) ?? ''} onChange={event => filter('after',event.target.value ? `${event.target.value}T00:00:00Z` : '')} /></label>
      <label className="flex flex-col gap-1">Before<input className={inputClass} type="date" value={params.get('before')?.slice(0,10) ?? ''} onChange={event => filter('before',event.target.value ? `${event.target.value}T00:00:00Z` : '')} /></label>
      <label className="flex flex-col gap-1">Minimum duration (ms)<input className={inputClass} type="number" min="0" value={params.get('minDuration') ?? ''} onChange={event => filter('minDuration',event.target.value)} /></label>
    </form>}
    {error && <div role="alert">{error} <button className="underline" onClick={() => setRevision(value => value+1)}>Retry</button></div>}
    {!error && !page && !detail && <p role="status">Loading runs…</p>}
    {page && <>
      <p className="mb-3 text-sm text-muted-foreground">{page.total} retained runs</p>
      {page.items.length === 0 && <p>No runs match these filters. Older runs may have expired.</p>}
      <ul className="divide-y divide-border">{page.items.map(run => <li key={run.id}><button className="flex w-full flex-wrap gap-x-5 gap-y-1 py-4 text-left focus-visible:outline focus-visible:outline-2" onClick={() => openRun(run.id)}>
        <span className="min-w-0 flex-1 break-words font-medium">{run.blueprint_name ?? 'Deleted Blueprint'}</span><span>{run.state}</span><span>{run.trigger_type}</span><time>{new Date(run.created_at).toLocaleString()}</time><span>{Math.round(run.duration_ms)} ms · attempt {run.attempt}</span>
      </button></li>)}</ul>
      <nav aria-label="Run pages" className="mt-5 flex gap-4"><button disabled={page.page === 0} onClick={() => { const next=new URLSearchParams(params);next.set('page',String(page.page-1));setParams(next); }}>Previous</button><span>Page {page.page+1}</span><button disabled={(page.page+1)*page.size >= page.total} onClick={() => { const next=new URLSearchParams(params);next.set('page',String(page.page+1));setParams(next); }}>Next</button></nav>
    </>}
    {detail && <>
      <h2 className="text-lg font-semibold">{detail.run.blueprint_name ?? 'Deleted Blueprint'} · {detail.run.state}</h2>
      <p className="my-2 break-all text-sm">Run {detail.run.id} · version {detail.run.blueprint_version} · attempt {detail.run.attempt}</p>
      {['SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER'].includes(detail.run.state) && <EvidenceExport key={detail.run.id} runId={detail.run.id} />}
      {detail.run.blueprint_name && <Link className="underline" to={editorRunLink(detail.run)}>Open executed path in editor</Link>}
      <p className="my-2 text-sm">Automatic retry policy: at most {detail.run.max_auto_attempts ?? 1} attempts; initial backoff {detail.run.retry_backoff_seconds ?? 30} seconds. Potentially repeated side effects require manual review.</p>
      {detail.run.blueprint_id != null && <WorkflowPolicy blueprint={detail.run.blueprint_id} />}
      {detail.run.parent_run_id && <p className="my-2"><button className="underline" onClick={() => openRun(detail.run.parent_run_id)}>View original run</button></p>}
      {['QUEUED','RUNNING','WAITING','RETRY_WAIT'].includes(detail.run.state) && <div className="my-4"><button className={inputClass} disabled={busy || Boolean(detail.run.cancel_requested_at)} onClick={() => recover('cancel')}>{detail.run.cancel_requested_at ? 'Cancellation requested' : 'Request cancellation'}</button><p className="mt-1 text-sm">The current action can finish. Cancellation stops execution at the next step boundary.</p></div>}
      {['FAILED','CANCELLED','DEAD_LETTER'].includes(detail.run.state) && <fieldset className="my-4 space-y-3 border border-border p-4" disabled={busy}>
        <legend>Retry run</legend>
        {(detail.checkpoints?.length ?? 0) === 0 ? <p>No replay checkpoint is available for this run.</p> : <>
          <label className="flex flex-col gap-1">Resume checkpoint<select className={inputClass} value={checkpoint} onChange={event => {setCheckpoint(Number(event.target.value));retryRequest.current=null;}}>{detail.checkpoints?.map(value => <option key={value} value={value}>{value === 0 ? 'From start' : `Before action ${value}`}</option>)}</select></label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I understand that replayed actions may duplicate note writes, remote calls, or irreversible effects, including actions that timed out.</span></label>
          <button className={inputClass} disabled={busy || !detail.checkpoints?.includes(checkpoint)} onClick={() => recover('retry')}>Retry with a new attempt</button>
        </>}
      </fieldset>}
      <ol className="mt-5 divide-y divide-border">{detail.steps.map(step => <li key={step.id} className="py-4">
        <div className="flex flex-wrap gap-3"><strong>{step.sequence}. {step.node_type}</strong><span>{step.state}</span><span>Attempt {step.attempt} · {step.duration_ms == null ? 'Duration unavailable' : `${step.duration_ms} ms`}</span></div>
        <p className="break-all text-sm">{step.node_id}{step.error_class ? ` · ${step.error_class}` : ''}</p>
        <p className="mt-2 text-sm">Input: {safeSummary(step.input_metadata)}</p><p className="text-sm">Output: {safeSummary(step.output_metadata)}</p>
        {detail.run.blueprint_name && !step.node_id.startsWith('redacted.') && <Link className="text-sm underline" to={editorRunLink(detail.run,step.node_id)}>Select node in editor</Link>}
      </li>)}</ol>
      <nav aria-label="Step pages" className="my-4 flex gap-4"><button disabled={detail.stepPage===0} onClick={() => {const next=new URLSearchParams(params);next.set('stepPage',String(detail.stepPage-1));setParams(next);}}>Previous steps</button><span>{detail.stepTotal} steps</span><button disabled={(detail.stepPage+1)*100>=detail.stepTotal} onClick={() => {const next=new URLSearchParams(params);next.set('stepPage',String(detail.stepPage+1));setParams(next);}}>Next steps</button></nav>
      {detail.steps.length === 0 && <p className="mt-4">No steps recorded yet.</p>}
    </>}
  </main>;
}
