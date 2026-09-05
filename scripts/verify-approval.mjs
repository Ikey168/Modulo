#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {canonicalDecision,decisionFields} from '../shared/approval/canonical.mjs';
export function verifyApproval(envelope, trustedKeyId) {
  try {
    if(envelope.signatureState==='UNSIGNED')return {status:'UNVERIFIABLE',reason:'Unsigned decision'};
    if(envelope.formatVersion!==1 || envelope.algorithm!=='Ed25519')return {status:'UNSUPPORTED'};
    const values=JSON.parse(envelope.statement);
    if(!Array.isArray(values)||values.length!==decisionFields.length)return {status:'TAMPERED'};
    const fields=Object.fromEntries(decisionFields.map((key,index)=>[key,values[index]]));
    if(canonicalDecision(fields)!==envelope.statement)return {status:'TAMPERED'};
    const publicBytes=Buffer.from(envelope.publicKey,'base64');
    const keyId=createHash('sha256').update(publicBytes).digest('hex');
    const digest=createHash('sha256').update(envelope.statement,'utf8').digest('hex');
    if(keyId!==envelope.keyId || keyId!==fields.keyId || digest!==envelope.digest || fields.decisionId!==envelope.decisionId || createHash('sha256').update(fields.comment,'utf8').digest('hex')!==fields.commentDigest)return {status:'TAMPERED'};
    const key=createPublicKey({key:publicBytes,format:'der',type:'spki'});
    if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(envelope.statement,'utf8'),key,Buffer.from(envelope.signature,'base64')))return {status:'TAMPERED'};
    return {status:'VALID',identity:trustedKeyId===keyId?'TRUSTED_KEY':'UNTRUSTED_KEY',keyId,anchoring:'NOT_VERIFIED',wallet:'NOT_PROVIDED'};
  } catch {return {status:'UNVERIFIABLE',reason:'Malformed or unsupported signature envelope'};}
}
if(process.argv[1] && import.meta.url===new URL(`file://${process.argv[1]}`).href) {
  try {
    const path=process.argv[2];if(!path||statSync(path).size>65536)throw new Error();
    const result=verifyApproval(JSON.parse(readFileSync(path,'utf8')),process.argv[3]);
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='VALID'?0:1;
  }catch{console.error('Usage: node scripts/verify-approval.mjs envelope.json [trusted-public-key-sha256]');process.exitCode=2;}
}
