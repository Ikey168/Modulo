export interface WorkflowRun {
  max_auto_attempts?: number; retry_backoff_seconds?: number;
  parent_run_id?: string; cancel_requested_at?: string;
  id: string; blueprint_id: number | null; blueprint_name: string | null;
  blueprint_version: string; trigger_type: string; state: string; attempt: number;
  created_at: string; started_at: string | null; finished_at: string | null;
  duration_ms: number; error_class: string | null;
}
export interface WorkflowStep {
  id: string; sequence: number; attempt: number; node_id: string; node_type: string;
  state: string; duration_ms: number | null; error_class: string | null;
  input_metadata: string; output_metadata: string;
}
export interface RunPage { items: WorkflowRun[]; total: number; page: number; size: number }
export interface RunDetail { run: WorkflowRun; steps: WorkflowStep[]; nodeIds: string[]; stepTotal: number; stepPage: number; checkpoints?: number[] }
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/workflow-runs${path}`, { signal });
  if (response.status === 404) throw new Error('This run is unavailable. It may have expired under the retention policy.');
  if (!response.ok) throw new Error('Unable to load workflow runs. Try again.');
  return response.json() as Promise<T>;
}
export const listRuns = (params: URLSearchParams, signal?: AbortSignal) => read<RunPage>(`?${params}`, signal);
export const getRun = (id: string, signal?: AbortSignal, stepPage = 0) => read<RunDetail>(`/${encodeURIComponent(id)}?stepPage=${stepPage}`, signal);
export const getRunSummary = (signal?: AbortSignal) => read<{ counts: {state: string; count: number}[] }>('/summary', signal);
export function editorRunLink(run: WorkflowRun, node?: string) {
  const query = new URLSearchParams({ blueprint: run.blueprint_name ?? '', run: run.id });
  if (node) query.set('node', node);
  return `/app/blueprints?${query}`;
}
export function safeSummary(raw: string): string {
  try {
    const value = JSON.parse(raw);
    const fields = Number.isSafeInteger(value.fields) ? value.fields : 0;
    const types = Object.entries(value.types ?? {}).filter(([key,count]) => ['null','number','boolean','text','collection','object','reference'].includes(key) && Number.isSafeInteger(count));
    return `${fields} fields${types.length ? ` · ${types.map(([key,count]) => `${count} ${key}`).join(', ')}` : ''} · Values redacted`;
  } catch { return 'Values redacted'; }
}

export async function cancelRun(id: string) {
  const response=await fetch(`/api/workflow-runs/${encodeURIComponent(id)}/cancel`,{method:'POST'});
  if(!response.ok) throw new Error('This run can no longer be cancelled. Refresh its status.');
}
export async function retryRun(id: string,requestId: string,checkpoint: number,confirmSideEffects: boolean): Promise<string> {
  const response=await fetch(`/api/workflow-runs/${encodeURIComponent(id)}/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,checkpoint,confirmSideEffects})});
  if(!response.ok) throw new Error('Retry unavailable: the checkpoint may have changed, the run may still be active, or side-effect confirmation is required.');
  const result=await response.json() as {id:string};return result.id;
}
