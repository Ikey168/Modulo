import { expect, test } from '@playwright/test';
import { installWorkspaceToolsFixture } from '../fixtures/workspaceToolsApi';

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
test('command search opens an indexed project without visiting its view first', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page, ['project-workspaces']);
  state.records.set('project-workspaces/records', { key: 'records', schemaId: 'workspace-tool', schemaVersion: 1, version: 1, deleted: false, createdAt: '', updatedAt: '', value: { version: 1, data: { projects: [{ id: 'release', title: 'September launch', description: 'Unique acceptance criterion', status: 'Active', deadline: '', noteIds: [2], evidenceIds: [], procedureIds: [], decisionIds: [], createdAt: '', updatedAt: '' }] } } });
  await page.goto('/app/notes?note=2');
  await expect(page.getByText('Referenced by', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /September launch/ }).first()).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search notes, records, or views…').fill('unique acceptance');
  await page.getByRole('option', { name: /September launch/ }).click();
  await expect(page).toHaveURL(/project-workspaces\?project=release/);
  await expect(page.getByRole('heading', { name: 'September launch' })).toBeVisible();
});
test('offline note edits survive reload and synchronize on reconnect', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page); let disconnected = false;
  await page.route(/\/api\/notes(?:\/|$)/, route => disconnected ? route.abort('internetdisconnected') : route.fallback());
  await page.goto('/app/notes?note=2'); await expect(page.getByLabel('Note title')).toHaveValue('Project evidence');
  disconnected = true; await page.getByLabel('Note title').fill('Offline evidence update');
  await expect(page.getByRole('region', { name: 'Offline note synchronization' })).toContainText('1 note edit saved on this device');
  expect(state.notes[1].title).toBe('Project evidence');
  await page.reload(); await expect(page.getByLabel('Note title')).toHaveValue('Offline evidence update');
  disconnected = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => state.notes[1].title).toBe('Offline evidence update');
  await expect(page.getByRole('region', { name: 'Offline note synchronization' })).toHaveCount(0);
});
test('offline conflict preserves both copies until a reviewed choice', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page); let disconnected = false;
  await page.route(/\/api\/notes(?:\/|$)/, route => disconnected ? route.abort('internetdisconnected') : route.fallback());
  await page.goto('/app/notes?note=2'); await expect(page.getByLabel('Note title')).toHaveValue('Project evidence');
  disconnected = true; await page.getByLabel('Note title').fill('Local review');
  await expect(page.getByRole('region', { name: 'Offline note synchronization' })).toBeVisible();
  state.notes[1] = { ...state.notes[1], title: 'Remote review', content: 'Concurrent server text', version: 2 };
  disconnected = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Local review — Changed on the server').click();
  await expect(page.getByText('Concurrent server text', { exact: true })).toBeVisible();
  expect(state.notes[1].title).toBe('Remote review');
  await page.getByRole('button', { name: 'Keep local edit' }).click();
  await expect.poll(() => state.notes[1].title).toBe('Local review');
  await expect(page.getByRole('region', { name: 'Offline note synchronization' })).toHaveCount(0);
});
test('attachment extraction is reviewed and retained in its source note', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page);
  await page.route('**/api/attachments/note/2', route => route.fulfill({ json: [{ id: 9, originalFilename: 'report.txt', contentType: 'text/plain', fileSize: 16 }] }));
  await page.route('**/api/attachments/9/download-url', route => route.fulfill({ body: '/api/files/2/report.txt' }));
  await page.route('**/api/files/2/report.txt', route => route.fulfill({ body: 'Extracted report', contentType: 'text/plain' }));
  await page.route('**/api/knowledge/extract', route => route.fulfill({ json: { text: 'Extracted report', checksum: 'abc' } }));
  await page.goto('/app/notes?note=2'); await page.getByRole('button', { name: 'Extract text: report.txt' }).click();
  await page.getByLabel('Extracted attachment text').fill('Reviewed report');
  await page.getByRole('button', { name: 'Add reviewed text to note' }).click();
  await expect.poll(() => state.notes[1].content).toContain('Reviewed report'); expect(state.notes[1].content).toContain('modulo-attachment:9:abc');
});
test('browser document import creates a searchable note and uploads the original', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page, ['document-inbox-ocr', 'universal-attachments']); let uploads = 0;
  await page.route('**/api/knowledge/extract', route => route.fulfill({ json: { text: 'Browser source text', checksum: 'abc123' } }));
  await page.route('**/api/attachments/upload', route => { uploads++; return route.fulfill({ json: { success: true } }); });
  await page.goto('/app/document-inbox-ocr');
  await page.getByLabel('Import document file').setInputFiles({ name: 'evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('Browser source text') });
  await expect(page.getByText('Document and extracted text saved in its source note.')).toBeVisible();
  expect(uploads).toBe(1); expect(state.notes).toHaveLength(3); expect(state.notes[2].content).toContain('Browser source text');
  await page.getByRole('button', { name: 'Open source note' }).click(); await expect(page).toHaveURL(/notes\?note=3/);
});

test('semantic search includes workspace records and opens the returned receipt', async ({ page }) => {
  const state = await installWorkspaceToolsFixture(page, ['semantic-search']);
  state.records.set('executable-runbooks/records', { key: 'records', schemaId: 'workspace-tool', schemaVersion: 1, version: 1, deleted: false, createdAt: '', updatedAt: '', value: { version: 1, data: { runs: [{ id: 'receipt', noteId: 1, title: 'Deployment receipt', source: '- [ ] Inspect', startedAt: '', steps: [{ label: 'Inspect', requestId: 'step', state: 'SUCCEEDED' }] }] } } });
  await page.route('**/api/knowledge/workspace-search', route => {
    const payload = route.request().postDataJSON();
    const doc = payload.documents.find((item: { id: string }) => item.id.includes('receipt'));
    return route.fulfill({ json: doc ? [{ id: doc.id, score: 0.8, excerpt: 'Verified deployment evidence' }] : [] });
  });
  await page.goto('/app/semantic-search');
  await page.getByPlaceholder('Describe what you are looking for…').fill('shipping confidence');
  await page.getByRole('button', { name: /Deployment receipt.*Verified deployment evidence/ }).click();
  await expect(page).toHaveURL(/executable-runbooks\?run=receipt/);
  await expect(page.getByRole('heading', { name: 'Deployment receipt' })).toBeVisible();
});
