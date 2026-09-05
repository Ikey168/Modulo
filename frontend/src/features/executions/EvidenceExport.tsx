import {useState} from 'react';
import {authenticatedRequest} from '../../services/authenticatedRequest';
export function EvidenceExport({runId}: {runId: string}) {
  const [omitSummaries,setSummaries]=useState(false);
  const [omitComments,setComments]=useState(false);
  const [omitSignatures,setSignatures]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [root,setRoot]=useState('');
  async function download() {
    setBusy(true);setError('');setRoot('');
    try {
      const query=new URLSearchParams({omitSummaries:String(omitSummaries),omitComments:String(omitComments),omitSignatures:String(omitSignatures)});
      const response=await authenticatedRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/evidence-bundle?${query}`);
      if(!response.ok)throw new Error('Evidence export unavailable. Refresh the completed run and try again.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`workflow-${runId}.zip`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setRoot(response.headers.get('X-Modulo-Evidence-Root') || 'See manifest.json in the archive');
    } catch(reason) {setError(reason instanceof Error?reason.message:'Export failed.');} finally {setBusy(false);}
  }
  return <details className="my-4 border-y border-border py-3"><summary className="cursor-pointer font-medium">Export evidence bundle</summary>
    <p className="my-3 text-sm">Includes retained run and step summaries, approval history, and available signatures. Raw inputs, note contents, private checkpoints, and full Blueprint configuration are omitted and marked in the manifest.</p>
    <fieldset disabled={busy} className="space-y-2 text-sm"><legend className="mb-2">Additional omissions</legend>
      <label className="flex items-start gap-2"><input type="checkbox" checked={omitSummaries} onChange={event=>setSummaries(event.target.checked)} />Omit step summaries</label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={omitComments} onChange={event=>setComments(event.target.checked)} />Omit decision comments and signatures that contain them</label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={omitSignatures} onChange={event=>setSignatures(event.target.checked)} />Omit signatures</label>
      <button className="my-2 border border-border px-3 py-2" onClick={download}>{busy?'Exporting…':'Download evidence ZIP'}</button>
    </fieldset>
    {error&&<p role="alert">{error}</p>}{root&&<p role="status" className="my-2 break-all text-sm">Exported root hash: {root}</p>}
    <p className="text-sm text-muted-foreground">This export is not anchored. Share the root hash through a trusted channel for independent integrity verification.</p>
  </details>;
}
