import { test, expect } from '@playwright/test';
import { installWorkspaceFixture } from '../fixtures/workspaceApi';

test.use({ serviceWorkers: 'block' });

test('installed SOP plugin persists a checklist run across reloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installWorkspaceFixture(page, ['notes-editor', 'personal-sops']);
  await page.goto('/app/personal-sops');
  await expect(page.getByRole('heading', { name: 'Personal SOPs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New procedure', exact: true }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Release checklist');
  await page.getByLabel('Steps', { exact: true }).fill('Verify deployment');
  await page.getByRole('button', { name: 'Save procedure', exact: true }).click();
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('checkbox', { name: '1. Verify deployment', exact: true }).check();
  await page.reload();
  await page.getByRole('button', { name: /Release checklist Active/ }).click();
  await expect(page.getByRole('checkbox', { name: '1. Verify deployment', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Complete run', exact: true }).click();
  await expect(page.getByRole('button', { name: /Release checklist Completed/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('legacy browser installations require explicit account import', async ({ page }) => {
  const records = await installWorkspaceFixture(page, ['notes-editor']);
  // No acknowledged server installation exists yet, as on a fresh account.
  records.delete('workspace-settings/installed');
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('smoke-legacy-seeded')) {
      localStorage.setItem('modulo-plugins-installed', JSON.stringify([
        { id: 'notes-editor', enabled: true }, { id: 'personal-sops', enabled: true },
      ]));
      sessionStorage.setItem('smoke-legacy-seeded', 'true');
    }
  });
  await page.goto('/app/personal-sops');
  const claim = page.getByRole('button', { name: 'Import into this account', exact: true });
  await expect(claim).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Personal SOPs', exact: true })).not.toBeVisible();
  expect(records.has('workspace-settings/installed')).toBe(false);
  await claim.click();
  await expect(page.getByRole('heading', { name: 'Personal SOPs', exact: true })).toBeVisible();
  await expect(claim).not.toBeVisible();
  expect(records.get('workspace-settings/installed')?.value).toEqual([
    { id: 'notes-editor', enabled: true }, { id: 'personal-sops', enabled: true },
  ]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Personal SOPs', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('modulo-plugins-installed'))).toBeNull();
});
