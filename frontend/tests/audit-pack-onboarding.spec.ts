import { expect, test } from '@playwright/test';
import { signedAuditReceipt } from './fixtures/auditReceipt';

test('fresh workspace completes the guided Security Audit journey', async ({ page }) => {
  let installed = false;
  let engagement: Record<string, unknown> | undefined;
  let approved = false;
  const receipt = signedAuditReceipt();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });

    if (path === '/api/audit-pack' && request.method() === 'GET') return json({ installed, signingConfigured: true });
    if (path === '/api/approvals/approval-1/decision') {
      approved = true;
      engagement = { ...engagement, run_state: 'SUCCEEDED', approvals: [{ id: 'approval-1', state: 'APPROVED', signature_state: 'SERVER_SIGNED' }] };
      return json({ state: 'APPROVED' });
    }
    if (path === '/api/approvals/approval-1') return json({ id: 'approval-1', hasReport: true, revision: 1, state: approved ? 'APPROVED' : 'PENDING', requester: '1', reviewer: '2', blueprintName: 'Demo report review', expiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-09-08T00:00:00Z', evidenceDigest: 'fixture', summary: { message: 'Review this demo report.' }, canDecide: !approved, decisions: [], events: [], runState: approved ? 'SUCCEEDED' : 'WAITING' });
    if (path === '/api/audit-pack/approvals/approval-1/report') return json(approved ? receipt : { ...receipt, signature: undefined });
    if (path === '/api/audit-pack/engagements/demo-1/demo' && request.method() === 'DELETE') { engagement = undefined; return json({ removed: true }); }
    if (path === '/api/audit-pack/manifest') return json({ manifestVersion: 2, id: 'org.modulo.security-audit', version: '1.1.0', name: 'Security Audit', capabilities: ['approval:request'], contributes: {}, resources: [] });
    if (path === '/api/workspace-packs/plans' && request.method() === 'POST') return json({ id: 'plan-1', pack_key: 'org.modulo.security-audit', kind: 'INSTALL', manifest_digest: 'digest', status: 'PLANNED', plan: { changes: [], requiredCapabilities: ['approval:request'], includeDemo: false } });
    if (path === '/api/workspace-packs/plans/plan-1/apply') { installed = true; return json({ id: 'plan-1', status: 'APPLIED', plan: { changes: [], requiredCapabilities: ['approval:request'], includeDemo: false } }); }
    if (path === '/api/workspace-packs/resources') return json([]);
    if (path === '/api/audit-pack/engagements' && request.method() === 'GET') return json(engagement ? [engagement] : []);
    if (path === '/api/audit-pack/engagements' && request.method() === 'POST') {
      engagement = { id: 'demo-1', title: 'Demo security review', demo: true, intake_note: 10, checklist_note: 11, records: [
        { note_id: 10, title: 'Demo security review', kind: 'engagement' },
        { note_id: 11, title: 'Demo security review — checklist', kind: 'checklist' },
      ] };
      return json(engagement);
    }
    if (path === '/api/audit-pack/engagements/demo-1/findings') {
      engagement = { ...engagement, records: [...((engagement?.records as unknown[]) ?? []), { note_id: 20, title: 'Demo access-control finding', kind: 'finding' }] };
      return json(engagement);
    }
    if (path === '/api/audit-pack/engagements/demo-1/report') {
      engagement = { ...engagement, report_note: 30, records: [...((engagement?.records as unknown[]) ?? []).filter((entry) => (entry as { kind?: string }).kind !== 'report'), { note_id: 30, title: 'Audit report — Demo security review', kind: 'report' }] };
      return json(engagement);
    }
    if (path === '/api/notes/30') return json({ id: 30, version: 1, title: 'Audit report — Demo security review', markdownContent: '# Demo audit report\n\nLocal fixture.' });
    if (path === '/api/audit-pack/engagements/demo-1/submit') {
      engagement = { ...engagement, review_run: 'run-1', run_state: 'WAITING', approvals: [{ id: 'approval-1', state: 'PENDING', signature_state: 'NOT_DECIDED' }] };
      return json({ runId: 'run-1', requestId: 'approval-1' });
    }
    if (path === '/api/audit-pack/engagements/demo-1') return json(engagement ?? {});
    return json([]);
  });

  await page.goto('/app/audit-pack');
  await expect(page.getByRole('heading', { name: 'Security Audit' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Security Audit guided setup' })).toBeVisible();

  await page.getByLabel('Reviewer account ID').fill('2');
  await page.getByRole('button', { name: 'Review Audit Pack installation' }).click();
  await expect(page.getByRole('button', { name: 'Install Security Audit Pack' })).toBeDisabled();
  await page.getByLabel('I approve this installation and its requested capabilities.').check();
  await page.getByRole('button', { name: 'Install Security Audit Pack' }).click();
  await expect(page.getByRole('button', { name: 'Create privacy-safe demo engagement' })).toBeVisible();

  await page.getByRole('button', { name: 'Create privacy-safe demo engagement' }).click();
  await expect(page.getByText('Demo security review · Demo')).toBeVisible();
  if (process.env.UPDATE_DOC_SCREENSHOTS === '1') {
    await page.screenshot({ path: '../docs/images/security-audit-guided-journey.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Generate report snapshot' }).click();
  await page.getByLabel('Share this exact report with the configured reviewer for approval.').check();
  await page.getByRole('button', { name: 'Submit report for review' }).click();

  await expect(page.getByText('○ Complete human review')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove demo Demo security review' })).toBeVisible();
  await page.getByRole('link', { name: 'Review request', exact: true }).click();
  await page.getByLabel('I confirm this approval for this request.').check();
  await page.getByRole('button', { name: 'Record decision' }).click();
  await expect(page.getByText(/Decision recorded: APPROVED/)).toBeVisible();
  await page.getByRole('button', { name: 'Read shared report snapshot' }).click();
  await page.getByLabel('Trusted signing key fingerprint').fill(receipt.signature.keyId);
  await page.getByRole('button', { name: 'Verify report receipt locally' }).click();
  await expect(page.getByText('Verified: report and decision match the trusted key. Not anchored.')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report and decision receipt' }).click();
  expect((await download).suggestedFilename()).toBe('audit-report-receipt.json');
});

test('guided setup skip persists and can be resumed', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const value = path === '/api/audit-pack' ? { installed: false, signingConfigured: false } : [];
    return route.fulfill({ json: value });
  });
  await page.goto('/app/audit-pack');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Restart guided setup' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart guided setup' }).click();
  await expect(page.getByRole('region', { name: 'Security Audit guided setup' })).toBeVisible();
});
