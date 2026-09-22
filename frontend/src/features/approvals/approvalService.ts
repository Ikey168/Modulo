import { authenticatedRequest } from '../../services/authenticatedRequest';
export interface Approval {
  id: string; hasReport?:boolean; runState?: string; revision: number; state: string; requester: string; reviewer: string;
  blueprintName: string; expiresAt: string; createdAt: string; evidenceDigest: string;
  summary: { message?: string; omissions?: string[] }; canDecide: boolean; runId?: string;
  decisions: { id: string; outcome: string; actor_ref: string; comment_text: string; decided_at: string; signature_state: string }[];
  events: {state: string; actor_ref?: string; created_at: string}[];
}
export class ApprovalError extends Error { constructor(public status: number, message: string) {super(message);} }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedRequest(`/api/approvals${path}`, init);
  if (!response.ok) throw new ApprovalError(response.status, response.status === 404 ? 'This approval is unavailable or you are no longer eligible to review it.' : response.status === 409 ? 'This request changed or has already been resolved. Review its current status before trying again.' : 'Unable to reach the approval service. Try again.');
  return response.json();
}
export const listApprovals = (state: string, page: number, signal?: AbortSignal) => request<Approval[]>(`?state=${encodeURIComponent(state)}&page=${page}&size=25`, {signal});
export const getApproval = (id: string, signal?: AbortSignal) => request<Approval>(`/${encodeURIComponent(id)}`, {signal});
export const decideApproval = (approval: Approval, outcome: string, comment: string, idempotencyKey: string) => request<{state: string}>(`/${encodeURIComponent(approval.id)}/decision`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expectedRevision:approval.revision,idempotencyKey,outcome,comment})});

export const getApprovalEvidence = (id: string) => request<{digest: string; summary: Approval["summary"]}>(`/${encodeURIComponent(id)}/evidence`);

export const getDecisionSignature = (requestId: string, decisionId: string) => request<Record<string,unknown>>(`/${encodeURIComponent(requestId)}/decisions/${encodeURIComponent(decisionId)}/signature`);
