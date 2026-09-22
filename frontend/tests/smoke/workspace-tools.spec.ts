import { expect, test } from '@playwright/test';
import { installWorkspaceToolsFixture as workspace, workspaceToolIds as ids } from '../fixtures/workspaceToolsApi';
import { readFile } from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });

test('runbooks persist manual completion and require real workflow success', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/executable-runbooks');
  await page.getByLabel('Procedure', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByLabel('I completed this manual step.').check();
  await page.getByRole('button', { name: 'Complete step', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Execute step', exact: true })).toBeDisabled();
  await page.getByLabel('Run review with this source note and its granted capabilities.').check();
  await page.getByRole('button', { name: 'Execute step', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh execution', exact: true }).click();
  await expect(page.getByText('Run complete.', { exact: true })).toBeVisible();
  expect(state.requests).toHaveLength(1); expect(state.requests[0].body).toMatchObject({ noteId: 1, triggerId: 'manual', confirmed: true });
  const replica = await page.evaluate(() => sessionStorage.getItem('modulo.state.replica'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Executable Runbooks', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('modulo.state.replica'))).toBe(replica);
  await page.getByRole('button', { name: /Release procedure · 2\/2/ }).click();
  await expect(page.getByText('Run complete.', { exact: true })).toBeVisible();
});

test('inbox captures and explicitly files a note with reviewed tags', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/universal-inbox');
  await page.getByLabel('Title', { exact: true }).fill('Inbox item');
  await page.getByLabel('Text, URL or email', { exact: true }).fill('https://example.test/article');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByLabel('Suggested tags — edit before filing', { exact: true }).fill('research');
  await page.getByRole('button', { name: 'File capture', exact: true }).click();
  await expect(page.getByRole('button', { name: /Inbox item · URL/ })).not.toBeVisible();
  await page.getByLabel('Show filed captures').check();
  await expect(page.getByRole('button', { name: /Inbox item · URL · Filed/ })).toBeVisible();
  expect(state.notes.find(note => note.title === 'Inbox item')?.tags).toContainEqual({ id: '1', name: 'research' });
});

test('checkpoint restore previews old content and saves a safety checkpoint', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/workspace-time-machine');
  await page.getByLabel('Checkpoint name').fill('Before release'); await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await expect(page.getByRole('button', { name: 'Export checkpoint' })).toBeVisible();
  state.notes[0] = { ...state.notes[0], content: 'Changed procedure', version: 2 };
  await page.reload(); await page.getByLabel('Checkpoint', { exact: true }).selectOption({ label: (await page.getByLabel('Checkpoint', { exact: true }).locator('option').nth(1).textContent())! });
  await page.getByRole('button', { name: 'Compare and restore' }).first().click();
  await expect(page.getByText('Changed procedure', { exact: false }).last()).toBeVisible();
  await page.getByLabel('Restore this content and tags. A safety checkpoint will be saved first.').check();
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Restore preview' })).not.toBeVisible();
  expect(state.notes[0].content).toContain('Inspect inputs');
  await expect(page.getByLabel('Checkpoint', { exact: true }).locator('option')).toHaveCount(3);
});

test('living documents create ordinary notes with live source fences', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/living-documents');
  await page.getByLabel('Document title').fill('Living project report'); await page.getByLabel('Source note', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Embed source', exact: true }).click();
  await expect(page.getByText('The acceptance checks passed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create living document' }).click();
  await expect.poll(() => state.notes.find(note => note.title === 'Living project report')?.content).toContain('```living-note\n2\n```');
});

test('briefings retain their checkpoint and identify subsequent edits', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/workspace-briefings');
  await page.getByRole('button', { name: 'Mark briefing read' }).click();
  await expect(page.getByText('No note changes.', { exact: true })).toBeVisible();
  state.notes[1].content = 'New evidence'; await page.reload();
  await expect(page.getByRole('button', { name: 'Edited: Project evidence' })).toBeVisible();
});

test('capsules preview and round-trip notes into a separate project', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/workspace-capsules');
  await page.getByLabel('Project / capsule name').fill('Portable project'); await page.getByLabel('Project evidence', { exact: true }).check();
  await page.getByLabel('Include attachment bytes').uncheck(); await page.getByRole('button', { name: 'Prepare export preview' }).click();
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download capsule' }).click();
  const download = await downloading; const payload = await readFile((await download.path())!);
  await page.getByLabel('Open capsule for import').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: payload });
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check();
  await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByText('Portable project — Complete', { exact: true })).toBeVisible();
  expect(state.notes.some(note => note.title === 'Project evidence')).toBe(true);
  expect(state.notes.find(note => note.title === 'Portable project / Project evidence')?.content).toBe('The acceptance checks passed.');
});

test('folder bridge imports Markdown and surfaces simultaneous edits as conflicts', async ({ page }) => {
  const state = await workspace(page);
  await page.addInitScript(() => {
    const files = new Map([['capture.md', 'Local folder content']]);
    const handle = (name: string) => ({ kind: 'file', name, getFile: async () => new File([files.get(name)!], name, { type: 'text/markdown' }), createWritable: async () => { let pending = files.get(name)!; return { write: async (value: string) => { pending = value; }, close: async () => { files.set(name, pending); }, abort: async () => {} }; } });
    Object.assign(window, { testFolderFiles: files, showDirectoryPicker: async () => ({ kind: 'directory', name: 'Test folder', async *values() { for (const name of files.keys()) yield handle(name); }, getFileHandle: async (name: string, options?: { create?: boolean }) => { if (!files.has(name) && !options?.create) throw new DOMException('Missing', 'NotFoundError'); return handle(name); } }) });
  });
  await page.goto('/app/local-folder-bridge'); await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
  await page.getByRole('button', { name: 'Scan and preview' }).click(); await page.getByRole('button', { name: 'Use folder version' }).click();
  await expect.poll(() => state.notes.find(note => note.title === 'capture')?.content).toBe('Local folder content');
  state.notes.find(note => note.title === 'capture')!.content = 'Changed in Modulo';
  await page.evaluate(() => (window as unknown as { testFolderFiles: Map<string, string> }).testFolderFiles.set('capture.md', 'Changed on disk'));
  // Refresh the workspace through a route remount while retaining the selected handle.
  await page.getByRole('button', { name: 'Scan and preview' }).click();
  await expect(page.getByText('capture.md — conflict', { exact: true })).toBeVisible();
  expect(state.notes.find(note => note.title === 'capture')?.content).toBe('Changed in Modulo');
});

test('decision journal saves evidence, compares outcomes and survives reload', async ({ page }) => {
  await workspace(page); await page.goto('/app/decision-journal');
  await page.getByRole('button', { name: 'New decision', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Choose a release cadence');
  await page.getByLabel('Chosen option', { exact: true }).fill('Weekly releases');
  await page.getByLabel('Alternatives', { exact: true }).fill('Daily or monthly');
  await page.getByLabel('Supporting evidence', { exact: true }).fill('Pilot deployment results');
  await page.getByLabel('Expected outcome', { exact: true }).fill('Fewer interrupted workdays');
  await page.getByLabel('Review date', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Evidence note', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Save decision', exact: true }).click();
  await page.getByLabel('Actual outcome', { exact: true }).fill('One uninterrupted week');
  await page.getByLabel('Lessons learned', { exact: true }).fill('Keep the cadence');
  await page.getByRole('button', { name: 'Complete review', exact: true }).click();
  await expect(page.getByText('Outcome: One uninterrupted week', { exact: false })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Choose a release cadence', exact: true }).click();
  await expect(page.getByText('Pilot deployment results', { exact: true })).toBeVisible();
  await expect(page.getByText('Outcome: One uninterrupted week', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open evidence note' })).toBeVisible();
});

test('a failed automated step cannot complete a runbook or advance its checklist', async ({ page }) => {
  const state = await workspace(page);
  state.notes[0].content = '- [ ] Review [blueprint:review#manual]\n- [ ] Publish release';
  await page.route('**/api/workflow-runs/00000000-0000-0000-0000-000000000001', route => route.fulfill({ json: { run: { state: 'FAILED' }, steps: [] } }));
  await page.goto('/app/executable-runbooks');
  await page.getByLabel('Procedure', { exact: true }).selectOption('1'); await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByLabel('Run review with this source note and its granted capabilities.').check(); await page.getByRole('button', { name: 'Execute step', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh execution' }).click();
  await expect(page.getByText('This step did not succeed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete step', exact: true })).not.toBeVisible();
  await expect(page.getByText('Run complete.', { exact: true })).not.toBeVisible();
});

test('checkpoint restore rejects edits made after the preview', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/workspace-time-machine');
  await page.getByLabel('Checkpoint name').fill('Baseline'); await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await page.getByRole('button', { name: 'Compare and restore' }).first().click();
  state.notes[0] = { ...state.notes[0], content: 'Someone else updated this', version: 2 };
  await page.getByLabel('Restore this content and tags. A safety checkpoint will be saved first.').check(); await page.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Changed elsewhere' })).toBeVisible();
  expect(state.notes[0].content).toBe('Someone else updated this');
  await expect(page.getByRole('region', { name: 'Restore preview' })).toBeVisible();
});

test('invalid saved plugin data stays read-only and can be exported for recovery', async ({ page }) => {
  const { records } = await workspace(page);
  records.set('executable-runbooks/records', { key: 'records', schemaId: 'workspace-tool', schemaVersion: 1, version: 1, value: { version: 1, data: { runs: 'broken' } }, deleted: false, createdAt: '', updatedAt: '' });
  await page.goto('/app/executable-runbooks');
  await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export recovery data' })).toBeVisible();
  expect(records.get('executable-runbooks/records')?.value).toEqual({ version: 1, data: { runs: 'broken' } });
});

test('capsule preflight rejects incompatible schemas without creating notes', async ({ page }) => {
  const state = await workspace(page); await page.goto('/app/workspace-capsules');
  const definition = { key: 'status', title: 'Status', type: 'text', options: [], revision: 1 };
  const value = { format: 'modulo-capsule', version: 1, id: 'conflicting-capsule', title: 'Imported', createdAt: '2026-09-08', notes: [state.notes[1]], links: [], attachments: [], definitions: [definition], properties: [{ noteId: 2, values: { status: 'Ready' } }], plugins: [], packs: [] };
  await page.route('**/api/note-properties/definitions', route => route.fulfill({ json: [{ ...definition, type: 'number' }] }));
  await page.getByLabel('Open capsule for import').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Incompatible property schemas' })).toBeVisible();
  expect(state.notes).toHaveLength(2);
});

test('all eight plugin views fit a mobile viewport without page errors', async ({ page }) => {
  await workspace(page); await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const titles = ['Executable Runbooks', 'Universal Inbox', 'Workspace Time Machine', 'Local Folder Bridge', 'What Changed?', 'Living Documents', 'Workspace Capsules', 'Decision Journal'];
  for (const [index, id] of ids.slice(1).entries()) {
    await page.goto(`/app/${id}`);
    await expect(page.getByRole('heading', { name: titles[index], exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('combobox', { name: 'Planning view', exact: true })).toBeVisible();
    const heading = await page.getByRole('heading', { name: titles[index], exact: true }).boundingBox();
    expect(heading!.x).toBeLessThan(40);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: '../.verification/workspace-tools-mobile.png', fullPage: true });
});

test('failed audio uploads retain the file and retry without duplicating the note', async ({ page }) => {
  const state = await workspace(page); let uploads = 0;
  await page.route('**/api/attachments/upload', route => { uploads++; return route.fulfill(uploads === 1 ? { status: 503, json: { success: false } } : { json: { success: true } }); });
  await page.goto('/app/universal-inbox');
  await page.getByLabel('Capture file', { exact: true }).setInputFiles({ name: 'voice.webm', mimeType: 'audio/webm', buffer: Buffer.from('fixture-audio') });
  await expect(page.getByRole('region', { name: 'Pending attachment' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry pending attachment' }).click();
  await expect(page.getByRole('region', { name: 'Pending attachment' })).not.toBeVisible();
  expect(uploads).toBe(2); expect(state.notes.filter(note => note.title === 'voice.webm')).toHaveLength(1);
});

test('capsule import resumes after a failed note update without duplicating created notes', async ({ page }) => {
  const state = await workspace(page); let fail = true;
  await page.route('**/api/notes/3', route => {
    if (route.request().method() === 'PUT' && fail) return route.fulfill({ status: 503, json: {} });
    return route.fallback();
  });
  await page.goto('/app/workspace-capsules');
  const value = { format: 'modulo-capsule', version: 1, id: 'resume-capsule', title: 'Resumable', createdAt: '2026-09-08', notes: [state.notes[1]], links: [], attachments: [], definitions: [], properties: [], plugins: [], packs: [] };
  const file = { name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) };
  await page.getByLabel('Open capsule for import').setInputFiles(file);
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Request failed' })).toBeVisible();
  expect(state.notes).toHaveLength(3); fail = false;
  await page.reload(); await page.getByLabel('Open capsule for import').setInputFiles(file);
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByText('Resumable — Complete', { exact: true })).toBeVisible();
  expect(state.notes).toHaveLength(3); expect(state.notes[2].content).toBe('The acceptance checks passed.');
});
