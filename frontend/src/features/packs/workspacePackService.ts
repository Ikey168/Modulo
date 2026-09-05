import {authenticatedRequest} from '../../services/authenticatedRequest';
import type {PackManifest} from '../blueprint/pack/packManifest';
export interface PackPlan {id:string;pack_key:string;kind:string;manifest_digest:string;status:string;failure_code?:string;plan:{changes:{resource:string;kind:string;action:string}[];requiredCapabilities:string[];includeDemo:boolean}}
export interface Installation {id:string;pack_key:string;state:string;version?:string;active_release?:string;runtime_pending:number}
export interface PackOperation {id:string;pack_key:string;kind:string;status:string;failure_code?:string;created_at:string}
export interface PackRelease {id:string;version:string;manifest_digest:string}
export async function packRequest<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await authenticatedRequest(`/api/workspace-packs${path}`,options);
  if(!response.ok){let code='';try{code=(await response.json()).code??'';}catch{/* No server details. */}
    throw new Error(code.startsWith('MISSING_DEPENDENCY:')?`Install dependency ${code.split(':')[1]} first.`:code.startsWith('DEPENDENCY_VERSION_CONFLICT:')?`Update dependency ${code.split(':')[1]} before installing.`:code==='PLUGIN_IMAGE_NOT_PROVISIONED'?'Provision the pinned plugin image for your account before installing this pack.':code==='STALE_INSTALL_PLAN'?'Your installed packs changed. Create and review a new plan.':code==='DEPENDENT_PACK_BLOCKS_REMOVAL'?'Another installed pack depends on this pack. Remove that dependency first.':code==='CAPABILITY_CONSENT_REQUIRED'?'Review and accept the capabilities in this plan.':response.status===404?'This pack operation is unavailable.':`Pack operation could not complete${code?` (${code})`:''}.`);
  }return response.json();
}
const post=(body:unknown):RequestInit=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const createPackPlan=(manifest:PackManifest,includeDemo:boolean)=>packRequest<PackPlan>('/plans',post({manifest,includeDemo}));
export const applyPackPlan=(plan:PackPlan)=>packRequest<PackPlan>(`/plans/${plan.id}/apply`,post({manifestDigest:plan.manifest_digest,acceptedCapabilities:plan.plan.requiredCapabilities}));
export const uninstallPlan=(pack:string)=>packRequest<PackPlan>(`/${encodeURIComponent(pack)}/uninstall-plan`,post({}));
export const rollbackPlan=(pack:string,release:string)=>packRequest<PackPlan>(`/${encodeURIComponent(pack)}/rollback-plan`,post({release}));
