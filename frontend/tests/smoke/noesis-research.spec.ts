import { expect, test } from '@playwright/test';
import { installWorkspaceFixture } from '../fixtures/workspaceApi';
test.use({ serviceWorkers: 'block' });
test('research persists, refreshes and creates linked work on desktop and phone', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await installWorkspaceFixture(page, ['notes-editor']);
  let record: any; let outputs = 0;
  await page.route(/\/api\/research\/noesis(?:[/?].*)?$/, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path.endsWith('/domains')) return route.fulfill({ json: [{ name: 'technology', description: 'Public corpus' }] });
    if (path === '/api/research/noesis') return route.fulfill({ json: { records: record ? [record] : [], nextCursor: null } });
    const body = request.method() === 'GET' ? undefined : request.postDataJSON();
    if (request.method() === 'PUT') {
      expect(body.publicQuestionConfirmed).toBe(true);
      record = { key: path.split('/').pop(), version: 1, value: { id: path.split('/').pop(), question: body.question, domain: body.domain, references: [], policy: body.policy, createdAt: '2026-09-21T08:00:00Z', refreshedAt: '2026-09-21T08:00:00Z', runId: 'noesis-run-1', runReference: '/api/v1/kb/cross-domain/answer', history: [], outputs: [], snapshot: { status: 'answered', findings: [{ id: 'finding-1', text: 'The release changes the supported API.', verdict: 'supported', citationState: 'single-source', method: 'deterministic-extractive', support: ['source-1'], contradictions: [] }], sources: [{ id: 'source-1', title: 'Official release notes', url: 'https://example.org/release', documentId: 'doc-1', authority: 'configured-primary', excerpt: 'The supported API changed.' }], coverageGaps: ['Only acquired sources were searched.'], assumptions: ['A citation is not proof of truth.'], refusal: '' }, delta: { kind: 'baseline', material: false, findings: { added: ['finding-1'], changed: [], removed: [] }, sources: { added: ['source-1'], changed: [], removed: [] } } } };
    }
    if (path.endsWith('/refresh')) { expect(body.expectedVersion).toBe(record.version); record.version++; record.value.runId = 'noesis-run-2'; record.value.delta = { ...record.value.delta, kind: 'unchanged', findings: { added: [], changed: [], removed: [] }, sources: { added: [], changed: [], removed: [] } }; }
    if (path.endsWith('/outputs')) { expect(body.findingId).toBe('finding-1'); expect(body.rationale).toBe('Review compatibility for the project.'); outputs++; record.version++; record.value.outputs.push({ id: 'output-1', kind: 'task', runId: record.value.runId, targetId: 'task-1', createdAt: '2026-09-21' }); }
    return route.fulfill({ json: record });
  });
  await page.goto('/app/research-noesis');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByLabel('Research question').fill('What does the release change?');
  await page.getByLabel('I have reviewed the question').check();
  await page.getByRole('button', { name: 'Run research', exact: true }).click();
  await expect(page.locator('article li > p').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('article li > p').first()).toBeVisible();
  await page.getByRole('button', { name: 'Refresh research', exact: true }).click();
  await expect(page.getByText('No material evidence changes. No new work is needed.')).toBeVisible();
  await page.getByText('Turn a finding into work', { exact: true }).click();
  await page.getByRole('combobox', { name: /^Finding/ }).selectOption('finding-1');
  await page.getByRole('combobox', { name: /^Output/ }).selectOption('task');
  await page.getByLabel('Title', { exact: true }).fill('Review API compatibility');
  await page.getByLabel('Why this matters / next action').fill('Review compatibility for the project.');
  await page.getByRole('button', { name: 'Create linked work' }).click();
  await expect(page.getByRole('link', { name: 'task: open output' })).toBeVisible(); expect(outputs).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/noesis-research-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
