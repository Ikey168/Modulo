import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalDecision, decisionFields } from '../../../shared/approval/canonical.mjs';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
/** Local signing fixture only: no live publisher identity is asserted. */
export function signedAuditReceipt() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ format: 'der', type: 'spki' });
  const keyId = hash(der);
  const reportCanonical = JSON.stringify([30, 1, 1, 'Audit report — Demo security review', 'Body', '# Demo audit report\n\nLocal fixture.']);
  const noteDigest = hash(reportCanonical);
  const evidenceCanonical = JSON.stringify({ inputDigest: hash(JSON.stringify({ context: { noteDigest, noteId: '30' } })), notes: [{ digest: noteDigest, id: '30' }], summary: {} });
  const fields = Object.fromEntries(decisionFields.map(key => [key, 'value']));
  Object.assign(fields, { format: 'modulo.approval.decision.v1', keyId, decisionId: 'decision-1', requestId: 'approval-1', evidenceDigest: hash(evidenceCanonical), outcome: 'APPROVE', comment: '', commentDigest: hash('') });
  const statement = canonicalDecision(fields);
  return { format: 'modulo.audit-report.v1', reportCanonical, evidenceCanonical, title: 'Audit report — Demo security review', markdown: '# Demo audit report\n\nLocal fixture.', signature: { signatureState: 'SERVER_SIGNED', formatVersion: 1, algorithm: 'Ed25519', statement, keyId, decisionId: 'decision-1', publicKey: der.toString('base64'), digest: hash(statement), signature: sign(null, Buffer.from(statement), privateKey).toString('base64') } };
}
