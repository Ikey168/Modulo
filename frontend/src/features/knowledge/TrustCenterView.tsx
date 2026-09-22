import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui';
import { authenticatedRequest } from '../../services/authenticatedRequest';

interface Evidence { evidence_type: string; status: string; source: string; summary: string; evaluated_at: string; expires_at?: string }
interface Release { id: string; version: string; image_digest: string; publisher?: string; verification_level: string; release_signing_identity?: string; trustStatus: string; permissions: string[]; evidence: Evidence[] }
interface Entry { plugin: string; trustStatus: string; release?: Release }
interface Health { desired?: Release; latest?: Release; runtime?: { status: string; endpoint?: string }; history: { id: string; action: string; status: string; failure?: string; created_at: string }[]; releases: { id: string; version: string }[]; recentRuns?: { id: string; state: string; error_class?: string; created_at: string }[] }
interface Diff { added: string[]; removed: string[]; renewedConsentRequired: boolean }
const highRisk = (permission: string) => /write|delete|exec|network|admin|secret|file/i.test(permission);
const consequence = (permission: string) => /delete/i.test(permission) ? 'Can remove data.' : /write/i.test(permission) ? 'Can change your data.' : /exec/i.test(permission) ? 'Can execute code.' : /network/i.test(permission) ? 'Can contact network services.' : /read/i.test(permission) ? 'Can read the named resource.' : 'Grants access to this capability; review the publisher documentation.';
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedRequest(`/api/marketplace/trust${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Trust request failed (${response.status}). No verified status can be established.`);
  return response.json();
}

export function TrustCenterView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry>();
  const [health, setHealth] = useState<Health>();
  const [release, setRelease] = useState<Release>();
  const [diff, setDiff] = useState<Diff>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { let active = true; api<Entry[]>('').then(value => { if (active) setEntries(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Trust information unavailable.'); } finally { setBusy(false); } }
  async function review(entry: Entry, id?: string) {
    setSelected(entry); setRelease(undefined); setHealth(undefined); setDiff(undefined); setConsent(false);
    const state = await api<Health>(`/plugins/${encodeURIComponent(entry.plugin)}/health`); setHealth(state);
    const target = id ?? entry.release?.id;
    if (target) {
      const detail = await api<Release>(`/releases/${target}`); setRelease(detail);
      if (state.desired && state.desired.id !== target) setDiff(await api<Diff>(`/diff?from=${state.desired.id}&to=${target}`));
    }
  }
  return <section aria-label="Marketplace Trust Center" className="space-y-4 text-sm">
    <p>Review external releases, publisher identity, permissions and verification evidence before approving a pinned version.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <ul className="divide-y divide-border">{entries.map(entry => <li key={entry.plugin} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span>{entry.plugin} · {entry.trustStatus}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => review(entry))}>Review {entry.plugin}</Button>
    </li>)}</ul>
    {selected && <section aria-label="Release review" className="space-y-3 border-t border-border pt-4">
      <h2 className="font-semibold">{selected.plugin}</h2>
      {health && <p>Runtime: {health.runtime?.status ?? 'UNKNOWN'}{health.runtime?.endpoint ? ` · ${health.runtime.endpoint}` : ''}</p>}
      {health?.runtime?.endpoint && <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || health.runtime.status !== 'ACTIVE'} onClick={() => {
          if (!window.confirm(`Disable ${selected.plugin} on this server?`)) return;
          void run(async () => {
            const response = await authenticatedRequest(`/api/plugins/${encodeURIComponent(selected.plugin)}/stop`, { method: 'POST' });
            if (!response.ok) throw new Error('Disable failed. A server administrator must perform this action.');
            await review(selected, release?.id); setNotice('Plugin disabled.');
          });
        }}>Disable runtime</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => {
          if (!window.confirm(`Uninstall ${selected.plugin} from this server? This removes its registration and access grants.`)) return;
          void run(async () => {
            const response = await authenticatedRequest(`/api/plugins/${encodeURIComponent(selected.plugin)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Uninstall failed. A server administrator must perform this action.');
            await review(selected, release?.id); setNotice('Plugin registration removed.');
          });
        }}>Uninstall runtime</Button>
      </div>}
      {health?.desired && <p className="break-all">Approved version: {health.desired.version} · {health.desired.image_digest}</p>}
      {health && !release && <p>{selected.trustStatus === 'BUNDLED' ? 'Bundled with Modulo; external artifact evidence does not apply.' : 'No immutable release evidence is available.'}</p>}
      {release && <>
        <label className="flex flex-wrap items-center gap-2">Review version<select className="rounded border border-border bg-background p-1" value={release.id} disabled={busy} onChange={e => void run(() => review(selected, e.target.value))}>{health?.releases.map(item => <option key={item.id} value={item.id}>{item.version}</option>)}</select></label>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt>Digest</dt><dd className="break-all font-mono">{release.image_digest}</dd><dt>Publisher</dt><dd>{release.publisher ?? 'Unknown'} · {release.verification_level}</dd>
          <dt>Release signer</dt><dd className="break-all">{release.release_signing_identity ?? 'Not established'}</dd><dt>Trust</dt><dd>{release.trustStatus}</dd>
        </dl>
        {release.trustStatus !== 'VERIFIED' && <p role="alert" className="text-destructive">Approval is blocked: evidence is missing, expired or failed.</p>}
        <ul className="space-y-2" aria-label="Requested permissions">{release.permissions.map(permission => <li key={permission} className={highRisk(permission) ? 'font-medium text-destructive' : ''}>{permission} — {consequence(permission)}</li>)}</ul>
        {diff && <div role="status"><p>Added permissions: {diff.added.join(', ') || 'None'}</p><p>Removed permissions: {diff.removed.join(', ') || 'None'}</p><p>{diff.renewedConsentRequired ? 'This release changes code or permissions and needs renewed consent.' : 'No additional consent impact detected.'}</p></div>}
        <details><summary className="cursor-pointer">Verification evidence</summary><ul className="space-y-3 py-2">{release.evidence.map(item => <li key={item.evidence_type}>
          <p className={item.status === 'FAILED' ? 'font-medium text-destructive' : ''}>{item.evidence_type}: {item.status} · {item.summary}</p>
          <p>Source: {item.source} · Evaluated: {item.evaluated_at} · Expires: {item.expires_at ?? 'Unknown'}</p>
        </li>)}</ul></details>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consent} disabled={busy || release.trustStatus !== 'VERIFIED'} onChange={e => setConsent(e.target.checked)} />I approve this exact digest and its requested permissions.</label>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !consent || release.trustStatus !== 'VERIFIED'} onClick={() => void run(async () => {
          await api(`/plugins/${encodeURIComponent(selected.plugin)}/install`, { release: release.id, consented: true });
          await review(selected, release.id); setNotice('Release approved and pinned. Attach the deployed workload through Plugin Manager; attachment rechecks the approved version and permissions.');
        })}>Approve pinned release</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { setRelease(await api<Release>(`/releases/${release.id}/recheck`, {})); setConsent(false); })}>Recheck evidence</Button>
          {health?.desired && health.desired.id !== release.id && <Button size="sm" variant="outline" disabled={busy || !consent || release.trustStatus !== 'VERIFIED'} onClick={() => {
            if (!window.confirm(`Approve rollback to ${release.version} at ${release.image_digest}?`)) return;
            void run(async () => { await api(`/plugins/${encodeURIComponent(selected.plugin)}/rollback/${release.id}`, {}); await review(selected, release.id); setNotice('Rollback target approved. Run the operator deployment command with --rollback to restore its historical workload configuration.'); });
          }}>Approve rollback target</Button>}
        </div>
        <label className="flex flex-col gap-1">Report reason<textarea className="rounded border border-border bg-background p-2" maxLength={4000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <Button size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await api(`/plugins/${encodeURIComponent(selected.plugin)}/report`, { release: release.id, reason: 'USER_REPORT', detail: reason }); setReason(''); setNotice('Report recorded.'); })}>Submit report</Button>
      </>}
      {health && <details><summary className="cursor-pointer">Release operation history</summary><ul className="space-y-2 py-2">{health.history.map(item => <li key={item.id}>{item.action} · {item.status} · {item.created_at}{item.failure ? ` · ${item.failure}` : ''}</li>)}</ul></details>}
      {health?.recentRuns && health.recentRuns.length > 0 && <ul aria-label="Recent plugin workflow runs" className="space-y-2">{health.recentRuns.map(run => <li key={run.id}><Link className="underline" to={`/app/executions?run=${encodeURIComponent(run.id)}`}>{run.state}{run.error_class ? ` · ${run.error_class}` : ''} · {run.created_at}</Link></li>)}</ul>}
      <Link className="underline" to="/app/executions">Open workflow runs and execution failures</Link>
    </section>}
  </section>;
}
