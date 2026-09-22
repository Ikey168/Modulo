import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalDecision,decisionFields} from './canonical.mjs';
import {verifyApproval} from '../../scripts/verify-approval.mjs';
const vectors=JSON.parse(readFileSync(new URL('./vectors.json',import.meta.url),'utf8'));
test('shared canonical vectors, signatures and independent key trust',()=>{
  for(const {fields,canonical,envelope} of vectors){
    assert.equal(canonicalDecision(fields),canonical);assert.equal(verifyApproval(envelope).status,'VALID');
    assert.equal(verifyApproval(envelope).identity,'UNTRUSTED_KEY');assert.equal(verifyApproval(envelope,envelope.keyId).identity,'TRUSTED_KEY');
    for(const key of decisionFields){const changed={...fields,[key]:fields[key]+'changed'};const statement=JSON.stringify(decisionFields.map(name=>changed[name]));assert.notEqual(verifyApproval({...envelope,statement}).status,'VALID');}
    assert.equal(verifyApproval({...envelope,formatVersion:2}).status,'UNSUPPORTED');
    assert.notEqual(verifyApproval({...envelope,publicKey:'invalid'}).status,'VALID');
    assert.notEqual(verifyApproval({...envelope,signature:'invalid'}).status,'VALID');
    assert.throws(()=>canonicalDecision({...fields,comment:'e\u0301'}));assert.throws(()=>canonicalDecision({...fields,comment:'\uD800'}));
  }
});
