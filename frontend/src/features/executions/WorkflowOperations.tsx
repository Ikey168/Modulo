import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Alert {id:string;blueprint_id:number;message:string;created_at:string;read_at:string|null}
interface Policy {retentionDays:number;payloadHours:number;failureThreshold:number;windowMinutes:number;route:string}
const field='rounded border border-border bg-background p-2 text-sm';
export function WorkflowAlerts() {
  const [alerts,setAlerts]=useState<Alert[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();
    fetch('/api/workflow-ops/alerts',{signal:controller.signal}).then(async response=>{if(!response.ok) throw new Error('Workflow alerts are unavailable.');return response.json();}).then(value=>{if(!controller.signal.aborted) setAlerts(Array.isArray(value)?value:[]);}).catch((error:Error)=>{if(!controller.signal.aborted)setError(error.message);});
    return ()=>controller.abort();
  },[]);
  async function markRead(id:string) {try {const response=await fetch(`/api/workflow-ops/alerts/${encodeURIComponent(id)}/read`,{method:'POST'});if(!response.ok)throw new Error();setAlerts(values=>values.filter(value=>value.id!==id));}catch{setError('Unable to mark alert read.');}}
  return <section aria-label="Workflow alerts" className="mb-5">
    {error && <p role="alert">{error}</p>}
    <ul className="divide-y divide-border">{alerts.filter(alert=>!alert.read_at).map(alert=><li key={alert.id} className="flex flex-wrap items-center gap-3 py-3"><Link className="flex-1 underline" to={`/app/executions?blueprint=${alert.blueprint_id}`}>{alert.message}</Link><button className={field} onClick={()=>markRead(alert.id)}>Mark read</button></li>)}</ul>
  </section>;
}
export function WorkflowPolicy({blueprint}:{blueprint:number}) {
  const [open,setOpen]=useState(false);
  const [policy,setPolicy]=useState<Policy|null>(null);
  const [status,setStatus]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(!open)return;const controller=new AbortController();setPolicy(null);setStatus('');
    fetch(`/api/workflow-ops/policies/${blueprint}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Unable to load workflow policy.');return response.json();}).then(value=>{if(!controller.signal.aborted)setPolicy({retentionDays:value.retention_days,payloadHours:value.payload_hours,failureThreshold:value.failure_threshold,windowMinutes:value.window_minutes,route:value.route});}).catch((error:Error)=>{if(!controller.signal.aborted)setStatus(error.message);});
    return ()=>controller.abort();
  },[open,blueprint]);
  async function save(event:React.FormEvent) {event.preventDefault();setSaving(true);setStatus('');try {const response=await fetch(`/api/workflow-ops/policies/${blueprint}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(policy)});if(!response.ok)throw new Error('Unable to save workflow policy.');setStatus('Policy saved.');}catch(error){setStatus((error as Error).message);}finally{setSaving(false);}}
  return <details className="my-5 border-y border-border py-3" onToggle={event=>setOpen(event.currentTarget.open)}><summary className="cursor-pointer">Alerts and retention</summary>
    {status && <p role="status" className="my-2">{status}</p>}
    {open && !policy && !status && <p role="status">Loading policy…</p>}
    {policy && <form className="mt-4 space-y-3" onSubmit={save}>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">History retention (days)<input className={field} required type="number" min={7} max={365} value={policy.retentionDays} onChange={event=>setPolicy({...policy,retentionDays:Number(event.target.value),payloadHours:Math.min(policy.payloadHours,Number(event.target.value)*24)})}/></label>
        <label className="flex flex-col gap-1">Replay payload retention (hours)<input className={field} required type="number" min={1} max={policy.retentionDays*24} value={policy.payloadHours} onChange={event=>setPolicy({...policy,payloadHours:Number(event.target.value)})}/></label>
        <label className="flex flex-col gap-1">Alert after failed runs<input className={field} required type="number" min={1} max={1000} value={policy.failureThreshold} onChange={event=>setPolicy({...policy,failureThreshold:Number(event.target.value)})}/></label>
        <label className="flex flex-col gap-1">Alert window (minutes)<input className={field} required type="number" min={1} max={1440} value={policy.windowMinutes} onChange={event=>setPolicy({...policy,windowMinutes:Number(event.target.value)})}/></label>
        <label className="flex flex-col gap-1">Notification destination<select className={field} value={policy.route} onChange={event=>setPolicy({...policy,route:event.target.value})}><option value="NONE">Disabled</option><option value="EXECUTION_CENTER">Execution Center</option><option value="INBOX">Notification inbox</option></select></label>
      </div>
      <p className="text-sm text-muted-foreground">Expired replay payloads cannot be retried. Active and waiting runs keep their checkpoints. Expired history is removed; retry references remain.</p>
      <button className={field} disabled={saving}>{saving?'Saving…':'Save policy'}</button>
    </form>}
  </details>;
}
