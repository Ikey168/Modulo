import {authenticatedRequest} from '../../services/authenticatedRequest';
import type {PropertyValue} from './propertyFrontmatter';
export interface QueryConfiguration {filters:{key:string;operator:string;value?:PropertyValue}[];sort:{key:string;direction:'asc'|'desc'};groupBy:string|null;columns:string[];formulas:{title:string;operation:'sum'|'concat';keys:string[]}[];view:'table'|'list'|'card'|'board'}
export interface SavedQuery {id:string;title:string;revision:number;configuration:QueryConfiguration}
export interface QueryRow {noteId:number;title:string;version:number;values:Record<string,PropertyValue>;formulas:Record<string,PropertyValue>}
export interface QueryResults {query:SavedQuery;rows:QueryRow[];page:number;hasMore:boolean}
export async function queryRequest<T>(path:string,body?:unknown,method='POST'):Promise<T>{const response=await authenticatedRequest(`/api/property-queries${path}`,body===undefined?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(response.status===409?'This query changed elsewhere. Your edits are retained; reload before saving.':`Query request failed (${response.status}).`);return response.json();}
