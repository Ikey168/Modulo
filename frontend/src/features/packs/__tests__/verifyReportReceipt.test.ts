// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { signedAuditReceipt } from '../../../../tests/fixtures/auditReceipt';
import { verifyReportReceipt } from '../verifyReportReceipt';
afterEach(() => vi.unstubAllGlobals());
test('verifies the signed report independently and requires an explicit trusted fingerprint', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const receipt = signedAuditReceipt();
  expect(await verifyReportReceipt(receipt, '')).toContain('identity unverified');
  expect(await verifyReportReceipt(receipt, receipt.signature.keyId)).toMatch(/^Verified:/);
  expect(await verifyReportReceipt({ ...receipt, markdown: 'Changed' }, receipt.signature.keyId)).toMatch(/^Tampered:/);
  expect(await verifyReportReceipt({ ...receipt, evidenceCanonical: receipt.evidenceCanonical.replace('"summary":{}', '"summary":{"changed":true}') }, receipt.signature.keyId)).toMatch(/^Tampered:/);
  expect(await verifyReportReceipt({ ...receipt, signature: undefined }, '')).toMatch(/^Unverifiable:/);
});
