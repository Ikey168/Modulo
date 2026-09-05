export const decisionFields = ['format','keyId','decisionId','requestId','requestRevision','runId','runAttempt','nodeId','blueprintDigest','evidenceDigest','policyDigest','nonceDigest','checkpoint','actor','outcome','comment','commentDigest','decidedAt','idempotencyKey'];
export function canonicalDecision(fields) {
  if(Object.keys(fields).length!==decisionFields.length || decisionFields.some(key=>!Object.hasOwn(fields,key)))throw new Error('Invalid statement fields');
  const values=decisionFields.map(key=>{
    const value=fields[key];if(typeof value!=='string'||value.normalize('NFC')!==value)throw new Error('Invalid statement string');
    for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw new Error('Invalid Unicode');}else if(c>=0xdc00&&c<=0xdfff)throw new Error('Invalid Unicode');}
    return value;
  });
  if(fields.format!=='modulo.approval.decision.v1')throw new Error('Unsupported decision format');
  const canonical=JSON.stringify(values);if(new TextEncoder().encode(canonical).length>32768)throw new Error('Statement too large');return canonical;
}
