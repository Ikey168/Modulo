import nacl from 'tweetnacl';
import { canonicalDecision, decisionFields } from '../../../../shared/approval/canonical.mjs';

export interface ReportReceipt {
  format: string; title: string; markdown: string; reportCanonical: string; evidenceCanonical: string;
  signature?: { formatVersion: number; signatureState?: string; algorithm: string; statement: string; publicKey: string; keyId: string; digest: string; decisionId: string; signature: string };
}
const bytes = (value: string) => new TextEncoder().encode(value);
const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
async function hash(value: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value as BufferSource)), byte => byte.toString(16).padStart(2, '0')).join(''); }

/** The browser verifies the receipt itself; a server-supplied status is not proof. */
export async function verifyReportReceipt(receipt: ReportReceipt, trustedKey: string): Promise<string> {
  try {
    if (receipt.format !== 'modulo.audit-report.v1' || !receipt.signature || receipt.signature.signatureState === 'UNSIGNED') return 'Unverifiable: no supported signed receipt.';
    const envelope = receipt.signature;
    if (envelope.formatVersion !== 1 || envelope.algorithm !== 'Ed25519') return 'Unverifiable: unsupported signature format.';
    const values: unknown = JSON.parse(envelope.statement);
    if (!Array.isArray(values) || values.length !== decisionFields.length) return 'Tampered: invalid statement.';
    const fields = Object.fromEntries(decisionFields.map((key, index) => [key, values[index]]));
    if (canonicalDecision(fields) !== envelope.statement) return 'Tampered: noncanonical statement.';
    const publicKey = decode(envelope.publicKey);
    const spkiPrefix = [48, 42, 48, 5, 6, 3, 43, 101, 112, 3, 33, 0];
    if (publicKey.length !== 44 || !spkiPrefix.every((value, index) => publicKey[index] === value)) return 'Unverifiable: invalid Ed25519 public key.';
    const keyId = await hash(publicKey);
    if (keyId !== envelope.keyId || keyId !== fields.keyId || await hash(bytes(envelope.statement)) !== envelope.digest || fields.decisionId !== envelope.decisionId || await hash(bytes(fields.comment)) !== fields.commentDigest) return 'Tampered: signature metadata mismatch.';
    if (!nacl.sign.detached.verify(bytes(envelope.statement), decode(envelope.signature), publicKey.slice(12))) return 'Tampered: signature does not verify.';
    const note = JSON.parse(receipt.reportCanonical), evidence = JSON.parse(receipt.evidenceCanonical);
    if (!Array.isArray(note) || note.length !== 6 || !note.slice(0, 3).every(Number.isSafeInteger) || typeof note[3] !== 'string' || typeof (note[5] ?? note[4]) !== 'string') return 'Tampered: invalid report snapshot.';
    const noteDigest = await hash(bytes(receipt.reportCanonical));
    const inputDigest = await hash(bytes(JSON.stringify({ context: { noteDigest, noteId: String(note[0]) } })));
    if (receipt.title !== note[3] || receipt.markdown !== (note[5] ?? note[4])
      || evidence.notes?.length !== 1 || evidence.notes[0].id !== String(note[0])
      || evidence.notes[0].digest !== noteDigest || evidence.inputDigest !== inputDigest)
      return 'Tampered: report differs from reviewed evidence.';
    if (fields.evidenceDigest !== await hash(bytes(receipt.evidenceCanonical))) return 'Tampered: evidence differs from signed decision.';
    return trustedKey.trim().toLowerCase() === keyId ? 'Verified: report and decision match the trusted key. Not anchored.' : 'Signature valid; publisher identity unverified. Supply a trusted key fingerprint. Not anchored.';
  } catch { return 'Unverifiable: malformed receipt or unavailable cryptography.'; }
}
