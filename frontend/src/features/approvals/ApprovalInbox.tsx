import {AuditReportArtifact} from '../packs/AuditPack';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApprovalError, decideApproval, getApproval, getApprovalEvidence, getDecisionSignature, listApprovals, type Approval } from './approvalService';
const field = 'border border-border bg-background px-3 py-2 text-sm rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
export const signatureLabel = (state: string) => ({SERVER_SIGNED:'Server signed · not locally verified', WALLET_SIGNED:'Wallet signed · not locally verified', UNSIGNED:'Unsigned · unverifiable'}[state] || 'Unverifiable signature state');
const date = (value: string) => new Date(value).toLocaleString();
export function ApprovalInbox() {
  const [params, setParams] = useSearchParams();
  const id = params.get('request');
  const [state, setState] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setItems([]);
    listApprovals(state, page, controller.signal).then(setItems).catch(e => {if (!controller.signal.aborted) setError(e.message);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [state, page, refresh]);
  return <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
    <h1 className="text-xl font-semibold">Approvals</h1>
    {id ? <ApprovalDetail key={id} id={id} onBack={() => {setParams({}); setRefresh(n => n + 1);}} /> : <>
      <div className="my-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Status<select className={field} value={state} onChange={e => {setState(e.target.value); setPage(0);}}>
          <option value="PENDING">Pending</option><option value="">All history</option>{['APPROVED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED'].map(value => <option key={value}>{value}</option>)}
        </select></label>
        <button className={field} onClick={() => setRefresh(n => n + 1)}>Refresh</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading approvals…</p> : !items.length ? <p role="status">No approvals match this filter.</p> : <ul className="divide-y divide-border border-y border-border">
        {items.map(item => <li key={item.id} className="py-4"><Link className="font-medium underline" to={`?request=${encodeURIComponent(item.id)}`}>{item.blueprintName || 'Blueprint approval'}</Link>
          <p className="mt-1 text-sm">{item.state} · Requested by user {item.requester}</p>
          <p className="text-sm text-muted-foreground">{Date.parse(item.expiresAt) <= Date.now() ? 'Expiry reached' : 'Due'}: <time dateTime={item.expiresAt}>{date(item.expiresAt)}</time></p>
        </li>)}
      </ul>}
      <nav aria-label="Approval pages" className="mt-4 flex items-center gap-3"><button className={field} disabled={page === 0 || loading} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page + 1}</span><button className={field} disabled={items.length < 25 || loading} onClick={() => setPage(n => n + 1)}>Next</button></nav>
    </>}
  </main>;
}
function ApprovalDetail({id,onBack}: {id: string; onBack: () => void}) {
  const [request, setRequest] = useState<Approval>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [evidence, setEvidence] = useState<{digest: string; summary: Approval['summary']}>();
  const [outcome, setOutcome] = useState('APPROVE');
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const submission = useRef(false);
  const receipt = useRef<{payload: string; key: string}>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    getApproval(id, controller.signal).then(setRequest).catch(e => {if (!controller.signal.aborted) setError(e.message);});
    const interval = window.setInterval(() => {getApproval(id, controller.signal).then(setRequest).catch(e => {if (!controller.signal.aborted && e instanceof ApprovalError && e.status === 404) {setRequest(undefined); setError(e.message);}});}, 10000);
    heading.current?.focus();
    return () => {controller.abort(); window.clearInterval(interval);};
  }, [id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!request || !confirmed || submission.current) return;
    submission.current = true; setBusy(true); setError('');
    const payload = JSON.stringify([request.revision,outcome,comment]);
    if (receipt.current?.payload !== payload) receipt.current = {payload,key:crypto.randomUUID()};
    try {
      const decision = await decideApproval(request,outcome,comment,receipt.current.key);
      setNotice(`Decision recorded: ${decision.state}. Workflow continuation is queued.`); setConfirmed(false);
      setRequest(await getApproval(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record decision.');
      if (e instanceof ApprovalError && [404,409].includes(e.status)) {
        setConfirmed(false);
        try {setRequest(await getApproval(id));} catch {setRequest(undefined);}
      }
    } finally {submission.current = false; setBusy(false);}
  }
  async function exportSignature(decision: string) {
    try {
      const envelope = await getDecisionSignature(id, decision);
      const url = URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}));
      const link = document.createElement('a'); link.href=url; link.download=`approval-${decision}.json`;link.click();
      window.setTimeout(() => URL.revokeObjectURL(url),1000);
      setNotice('Signature exported. Verify it locally with the approval verifier and a trusted key fingerprint.');
    } catch (e) {setError(e instanceof Error ? e.message : 'Unable to export signature.');}
  }
  const bytes = new TextEncoder().encode(comment.normalize('NFC')).length;
  return <section className="mt-4">
    <button className={field} onClick={onBack}>Back to approvals</button>
    <h2 ref={heading} tabIndex={-1} className="my-4 text-lg font-medium">{request?.blueprintName || 'Approval request'}</h2>
    {error && <p role="alert" className="my-3">{error}</p>}{notice && <p role="status" className="my-3">{notice}</p>}
    {!request ? !error && <p role="status">Loading request…</p> : <>
      <dl className="grid grid-cols-1 gap-2 border-y border-border py-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">Status</dt><dd>{request.state}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Workflow</dt><dd aria-live="polite">{request.runState || "Unavailable"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Requester</dt><dd>User {request.requester}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Expires</dt><dd><time dateTime={request.expiresAt}>{date(request.expiresAt)}</time></dd></div>
        <div><dt className="text-sm text-muted-foreground">Reviewer</dt><dd>User {request.reviewer}</dd></div>
      </dl>
      <h3 className="mt-5 font-medium">Allowed context</h3><p className="my-2 break-words">{request.summary.message}</p>
      <p className="text-sm text-muted-foreground">Omitted: {request.summary.omissions?.join(', ') || 'Raw input values and note contents'}.</p>
      <details className="my-3"><summary className="cursor-pointer underline">Evidence digest</summary><code className="block break-all py-2 text-xs">{request.evidenceDigest}</code><p className="text-sm">This digest identifies the evidence. It is not a cryptographic signature.</p></details>
      <button className="text-sm underline" onClick={() => {getApprovalEvidence(id).then(setEvidence).catch(e => setError(e.message));}}>Open safe evidence summary</button>
      {evidence && <section aria-label="Safe evidence summary" className="my-3 border-l-2 border-border pl-3"><p>{evidence.summary.message}</p><p className="break-all text-xs">{evidence.digest}</p><p>Raw values and note contents omitted.</p></section>}
      {request.hasReport&&<AuditReportArtifact requestId={id}/>}
      {request.runId && <p className="mt-2"><Link className="underline" to={`/app/executions?run=${encodeURIComponent(request.runId)}`}>View workflow run</Link></p>}
      {request.canDecide ? <form onSubmit={submit} className="mt-6 max-w-xl space-y-4">
        <fieldset disabled={busy} className="space-y-4"><legend className="font-medium">Your decision</legend>
          <label className="flex flex-col gap-1">Decision<select className={field} value={outcome} onChange={e => {setOutcome(e.target.value); setConfirmed(false);}}><option value="APPROVE">Approve</option><option value="REJECT">Reject</option></select></label>
          <label className="flex flex-col gap-1">Reason {outcome === 'REJECT' ? '(required)' : '(optional)'}<textarea className={`${field} min-h-24 w-full`} value={comment} required={outcome === 'REJECT'} aria-describedby="comment-limit" onChange={e => {setComment(e.target.value); setConfirmed(false);}} /></label>
          <p id="comment-limit" className="text-sm">{bytes} / 4096 bytes. Your reason becomes part of the decision history.</p>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this {outcome === 'APPROVE' ? 'approval' : 'rejection'} for this request.</label>
          <button className={field} disabled={!confirmed || bytes > 4096 || (outcome === 'REJECT' && !comment.trim())} type="submit">{busy ? 'Recording decision…' : 'Record decision'}</button>
        </fieldset>
      </form> : <p role="status" className="my-5">{request.state === 'PENDING' ? 'This request is not currently available for your decision.' : 'This request is resolved. Further decisions are disabled.'}</p>}
      <h3 className="mt-6 font-medium">Decision history</h3>
      {request.decisions.length ? <ul className="divide-y divide-border">{request.decisions.map(decision => <li key={decision.id} className="py-3"><p>{decision.outcome} by user {decision.actor_ref} · {date(decision.decided_at)}</p><p className="whitespace-pre-wrap break-words">{decision.comment_text}</p><p className="text-sm">{signatureLabel(decision.signature_state)} · Not anchored</p><button className="text-sm underline" onClick={() => exportSignature(decision.id)}>Export decision signature</button></li>)}</ul> : <p className="mt-2 text-sm">No human decision recorded.</p>}
      <h3 className="mt-5 font-medium">Request history</h3><ol className="mt-2 space-y-2 text-sm">{request.events.map((event,index) => <li key={index}>{event.state} · {date(event.created_at)}{event.actor_ref && ` · User ${event.actor_ref}`}</li>)}</ol>
    </>}
  </section>;
}
