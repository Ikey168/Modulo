import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installWorkspaceToolsFixture } from '../fixtures/workspaceToolsApi';

test.use({ serviceWorkers: 'block' });
const workspace = (page: Page) => installWorkspaceToolsFixture(page, ['project-workspaces']);
const section = (page: Page, name: string) => page.getByRole('navigation', { name: 'Project sections' }).getByRole('button', { name, exact: true }).click();
async function createProject(page: Page) {
  await page.goto('/app/project-workspaces'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Release September');
  await page.getByLabel('Purpose and outcome').fill('Ship a verified release and retain its evidence.');
  await page.getByLabel('Deadline', { exact: true }).fill('2026-09-30');
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page.getByRole('heading', { name: 'Release September', exact: true })).toBeVisible();
  return page.url();
}
async function attach(page: Page, tab: string, note: string, role: string) {
  await section(page, tab); await page.getByLabel('Existing project note').selectOption(note);
  await page.getByRole('button', { name: `Attach ${role}`, exact: true }).click();
}

test('projects keep task edits in the source note and persist membership across reload', async ({ page }) => {
  const state = await workspace(page); const url = await createProject(page);
  await attach(page, 'Notes', '2', 'note'); await section(page, 'Tasks');
  await page.getByLabel('Task', { exact: true }).fill('Review acceptance evidence'); await page.getByLabel('Task note', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByLabel('Complete Review acceptance evidence', { exact: true }).click();
  await expect.poll(() => state.notes[1].content).toContain('- [x] Review acceptance evidence');
  await page.reload(); await expect(page.getByLabel('Complete Review acceptance evidence', { exact: true })).toBeChecked();
  await attach(page, 'Evidence', '2', 'evidence');
  await section(page, 'Notes'); await page.getByRole('button', { name: 'Detach note', exact: true }).click();
  expect(state.notes).toHaveLength(2); expect(state.notes[1].content).toContain('Review acceptance evidence');
  await section(page, 'Evidence'); await expect(page.getByText('No evidence attached yet.')).toBeVisible();
  await page.goto(url); await expect(page.getByText('0 notes · 0/0 tasks complete · 0 decisions · 0 runbook receipts')).toBeVisible();
});

test('a whole project round-trips its decisions, procedure receipts, tasks and evidence', async ({ page }) => {
  const state = await workspace(page); const url = await createProject(page);
  await attach(page, 'Evidence', '2', 'evidence'); await attach(page, 'Runbooks', '1', 'procedure');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Release procedure', exact: true })).toBeVisible();
  await page.getByLabel('I completed this manual step.').check(); await page.getByRole('button', { name: 'Complete step', exact: true }).click();
  await page.goto(url); await section(page, 'Decisions');
  await page.getByText('Create a project decision', { exact: true }).click();
  await page.getByLabel('Decision title', { exact: true }).fill('Adopt weekly releases');
  await page.getByLabel('Chosen option', { exact: true }).fill('Weekly'); await page.getByLabel('Expected outcome', { exact: true }).fill('Predictable release windows');
  await page.getByRole('button', { name: 'Save project decision' }).click();
  await expect(page.getByRole('heading', { name: 'Adopt weekly releases', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit decision', exact: true }).click();
  await page.getByLabel('Supporting evidence', { exact: true }).fill('The pilot passed.'); await page.getByLabel('Evidence note', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Save decision', exact: true }).click();
  await page.goto(url); await page.getByRole('link', { name: 'Export project capsule' }).click();
  await expect(page.getByLabel('Project / capsule name')).toHaveValue('Release September');
  await page.getByLabel('Include attachment bytes').uncheck(); await page.getByRole('button', { name: 'Prepare export preview' }).click();
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download capsule' }).click();
  const file = await downloading; const payload = await readFile((await file.path())!); const capsule = JSON.parse(payload.toString());
  expect(capsule.project.workspace.evidenceIds).toEqual([2]); expect(capsule.project.workspace.procedureIds).toEqual([1]); expect(capsule.project.decisions[0].values.evidence).toBe('The pilot passed.'); expect(capsule.project.runs).toHaveLength(1);
  await page.getByLabel('Open capsule for import').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: payload });
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByText('Release September — Complete', { exact: true })).toBeVisible(); await page.getByRole('link', { name: 'Open imported project' }).click();
  expect(page.url()).not.toBe(url); await section(page, 'Evidence'); await expect(page.getByRole('button', { name: 'Release September / Project evidence', exact: true })).toBeVisible();
  await section(page, 'Decisions'); await page.getByRole('link', { name: 'Adopt weekly releases · Pending review' }).click(); await expect(page.getByText('The pilot passed.', { exact: true })).toBeVisible();
  await page.goBack(); await section(page, 'Runbooks'); await page.getByRole('link', { name: /Imported receipt/ }).click();
  await expect(page.getByText('Imported historical receipt.', { exact: false })).toBeVisible(); await expect(page.getByRole('button', { name: 'Execute step', exact: true })).not.toBeVisible();
  expect(state.notes).toHaveLength(4); expect(state.requests).toHaveLength(0);
});

test('archiving a project makes organization read-only and deletion retains source records', async ({ page }) => {
  const state = await workspace(page); await createProject(page); await attach(page, 'Notes', '2', 'note');
  await page.getByRole('button', { name: 'Edit project', exact: true }).click(); await page.getByLabel('Project status').selectOption('Archived'); await page.getByRole('button', { name: 'Save project' }).click();
  await section(page, 'Notes'); await expect(page.getByRole('button', { name: 'Detach note', exact: true })).toBeDisabled();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Delete project', exact: true }).click();
  await expect(page.getByText('Create a project or choose one to organize its work.')).toBeVisible(); expect(state.notes).toHaveLength(2);
});

test('project task writes reject a source edited after the project was loaded', async ({ page }) => {
  const state = await workspace(page); state.notes[1].content = '- [ ] Check evidence'; await createProject(page); await attach(page, 'Notes', '2', 'note'); await section(page, 'Tasks');
  state.notes[1] = { ...state.notes[1], version: 2, content: 'Changed elsewhere' };
  await page.getByLabel('Complete Check evidence').click(); await expect(page.getByRole('alert').filter({ hasText: 'Changed elsewhere' })).toBeVisible(); expect(state.notes[1].content).toBe('Changed elsewhere');
});

test('project navigation and populated views remain usable on phones', async ({ page }) => {
  await workspace(page); await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await createProject(page); await attach(page, 'Notes', '2', 'note');
  for (const tab of ['Overview', 'Notes', 'Tasks', 'Decisions', 'Runbooks', 'Evidence']) {
    await section(page, tab); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await section(page, 'Overview'); await page.screenshot({ path: '../.verification/project-workspaces-mobile.png', fullPage: true }); expect(errors).toEqual([]);
});

test('a note can join a project from its Projects detail panel', async ({ page }) => {
  await workspace(page); await page.setViewportSize({ width: 1440, height: 1000 }); const url = await createProject(page);
  const projectId = new URL(url).searchParams.get('project')!;
  await page.goto('/app/notes?note=2');
  await page.getByLabel('Add note to project', { exact: true }).selectOption(projectId);
  await page.getByRole('button', { name: 'Attach to project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detach from Release September' })).toBeVisible();
  await page.getByRole('link', { name: 'Release September', exact: true }).click();
  await section(page, 'Notes'); await expect(page.getByRole('button', { name: 'Project evidence', exact: true })).toBeVisible();
  await page.screenshot({ path: '../.verification/project-workspaces-desktop.png', fullPage: true });
});

test('project import resumes an interrupted state sync without duplicating notes or plugin records', async ({ page }) => {
  const state = await workspace(page); let fail = true;
  await page.route('**/api/workspaces/personal/plugin-state/project-workspaces/records', route => route.request().method() === 'PUT' && fail ? route.fulfill({ status: 503, json: {} }) : route.fallback());
  const capsule = { format: 'modulo-capsule', version: 1, id: 'project-resume', title: 'Resumed project', createdAt: '', notes: state.notes, links: [], attachments: [], definitions: [], properties: [], plugins: [], packs: [], project: {
    workspace: { id: 'original', title: 'Resumed project', description: '', status: 'Active', deadline: '', noteIds: [1, 2], evidenceIds: [2], procedureIds: [1], decisionIds: ['decision-original'], createdAt: '', updatedAt: '' },
    decisions: [{ id: 'decision-original', title: 'Ship', status: 'Pending review', category: 'Project', recurrence: 'Once', favorite: false, tags: [], checklist: [], log: [], values: { choice: 'Yes', expectedOutcome: 'Ready', sourceNoteId: '2' } }],
    runs: [{ id: 'run-original', noteId: 1, title: 'Procedure', source: '- [ ] Check', startedAt: '', steps: [{ label: 'Check', state: 'PENDING', requestId: 'source-request' }] }],
  } };
  const file = { name: 'resume.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(capsule)) };
  await page.goto('/app/workspace-capsules'); await page.getByLabel('Open capsule for import').setInputFiles(file);
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Progress is saved locally' })).toBeVisible(); expect(state.notes).toHaveLength(4);
  fail = false; await page.reload(); await page.getByLabel('Open capsule for import').setInputFiles(file);
  await page.getByLabel('I reviewed the contents, attachments, schemas and requirements.').check(); await page.getByRole('button', { name: 'Import / resume project' }).click();
  await expect(page.getByText('Resumed project — Complete', { exact: true })).toBeVisible(); expect(state.notes).toHaveLength(4);
  const projects = state.records.get('project-workspaces/records')!.value as { data: { projects: { decisionIds: string[] }[] } };
  const decisions = state.records.get('decision-journal/records')!.value as { data: { records: { id: string }[] } };
  const runs = state.records.get('executable-runbooks/records')!.value as { data: { runs: { imported: boolean }[] } };
  expect(projects.data.projects).toHaveLength(1); expect(decisions.data.records).toHaveLength(1); expect(runs.data.runs).toHaveLength(1); expect(runs.data.runs[0].imported).toBe(true);
  expect(projects.data.projects[0].decisionIds).toEqual([decisions.data.records[0].id]);
});
