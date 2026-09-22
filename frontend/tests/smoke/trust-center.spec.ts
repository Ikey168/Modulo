import { expect, test } from '@playwright/test';
import { installWorkspaceFixture } from '../fixtures/workspaceApi';
test.use({ serviceWorkers: 'block' });

for (const width of [390, 1280]) {
  test(`Trust Center review is keyboard accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installWorkspaceFixture(page, ['notes-editor']);
    const release = { id: 'release-1', plugin_key: 'sample-plugin', version: '1.0', image_digest: `sha256:${'a'.repeat(64)}`, verification_level: 'UNVERIFIED', trustStatus: 'UNKNOWN', permissions: ['notes:write'], evidence: [] };
    await page.route(/\/api\/marketplace\/trust(?:\/|$)/, route => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ json: path.endsWith('/trust') ? [{ plugin: 'sample-plugin', trustStatus: 'UNKNOWN', release }]
        : path.endsWith('/health') ? { releases: [release], history: [], runtime: { status: 'NOT_DEPLOYED' } } : release });
    });
    await page.goto('/app/marketplace');
    await page.getByRole('tab', { name: 'Trust Center' }).click();
    const review = page.getByRole('button', { name: 'Review sample-plugin' });
    await review.focus(); await page.keyboard.press('Enter');
    await expect(page.getByText('Approval is blocked: evidence is missing, expired or failed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve pinned release' })).toBeDisabled();
    await expect(page.getByText(/Can change your data/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
