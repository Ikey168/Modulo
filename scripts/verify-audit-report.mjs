#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyApproval} from './verify-approval.mjs';
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
export function verifyAuditReport(receipt,trustedKeyId){try{
 if(receipt.format!=='modulo.audit-report.v1')return {integrity:'UNSUPPORTED'};
 const note=JSON.parse(receipt.reportCanonical),evidence=JSON.parse(receipt.evidenceCanonical);
 if(!Array.isArray(note)||note.length!==6||!Number.isSafeInteger(note[0])||!Number.isSafeInteger(note[1])||!Number.isSafeInteger(note[2])||typeof note[3]!=='string'||typeof note[5]!=='string')throw new Error();
 const noteDigest=hash(receipt.reportCanonical);
 if(!Array.isArray(evidence.notes)||evidence.notes.length!==1||evidence.notes[0].id!==String(note[0])||evidence.notes[0].digest!==noteDigest||evidence.inputDigest!==hash(JSON.stringify({context:{noteDigest,noteId:String(note[0])}}))||receipt.markdown!==note[5]||receipt.title!==note[3])return {integrity:'TAMPERED'};
 const signature=verifyApproval(receipt.signature,trustedKeyId);if(signature.status!=='VALID')return {integrity:'UNVERIFIABLE',signature};
 const statement=JSON.parse(receipt.signature.statement);if(statement[9]!==hash(receipt.evidenceCanonical))return {integrity:'TAMPERED'};
 return {integrity:'VALID',signature:signature.status,identity:signature.identity,outcome:statement[14],keyId:signature.keyId,anchoring:'NOT_VERIFIED'};
 }catch{return {integrity:'UNVERIFIABLE'};}}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){try{const path=process.argv[2];if(!path||statSync(path).size>8388608)throw new Error();const result=verifyAuditReport(JSON.parse(readFileSync(path,'utf8')),process.argv[3]);console.log(JSON.stringify(result,null,2));process.exitCode=result.integrity==='VALID'?0:1;}catch{console.error('Usage: node scripts/verify-audit-report.mjs report-receipt.json [trusted-key-sha256]');process.exitCode=2;}}
