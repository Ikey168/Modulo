/**
 * Android parity sweep for record-based plugins (#491).
 *
 * Installs the whole catalog in the phone harness, opens every contributed
 * view at a Pixel-class touch viewport and records, per view:
 *   - rendered: no page error, not an install prompt, no horizontal overflow;
 *   - interactive: at least one enabled control in the content area (a view
 *     that renders nothing actionable is "silently read-only");
 *   - persisted: for plugins with record schemas, tapping the view's primary
 *     create control (and submitting its form, if one opens) wrote to the
 *     plugin-state API.
 * Writes docs/mobile/android-parity-evidence.json and exits 1 when any view
 * fails to render or is not interactive.
 *   node scripts/phoneParity.mjs <baseUrl> [viewId ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPhone } from './phoneHarness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const inventory = JSON.parse(readFileSync(join(ROOT, 'docs/mobile/android-inventory.json'), 'utf8'));
const [base = 'http://127.0.0.1:5188', ...only] = process.argv.slice(2);

const plugins = inventory.plugins.filter((plugin) => plugin.runnable);
const views = plugins.flatMap((plugin) => plugin.contributions.views.map((view) => ({ view, plugin })))
  .filter(({ view }) => !only.length || only.includes(view.split(':')[0]));

// PHONE_STORAGE_THROWS=1 repeats the sweep with browser Storage blocked (#497).
const storageThrows = process.env.PHONE_STORAGE_THROWS === '1';
const { browser, page, writes, errors, settle, layoutReport } = await openPhone({ plugins: plugins.map((plugin) => plugin.id), storageThrows });
const CREATE = /^(\+\s*)?(add|new|create|log|record|capture|start|track|save)\b/i;
const SUBMIT = /^(add|save|create|log|record|submit|track|done)\b/i;

async function tryCreate() {
  const before = writes.length;
  const controls = page.locator('button:visible:not([disabled])');
  const count = await controls.count();
  let tapped;
  for (let index = 0; index < count && !tapped; index += 1) {
    const control = controls.nth(index);
    const inChrome = await control.evaluate((el) => !!el.closest('header, nav, [role="dialog"], [data-radix-popper-content-wrapper]'));
    const name = ((await control.getAttribute('aria-label')) || (await control.innerText().catch(() => ''))).trim();
    if (!inChrome && CREATE.test(name)) { tapped = name; await control.tap({ timeout: 3000 }).catch(() => control.click({ timeout: 3000 })); }
  }
  if (!tapped) return { create: 'no-create-control' };
  await page.waitForTimeout(500);
  const scope = (await page.locator('[role="dialog"]').count()) ? page.locator('[role="dialog"]').last() : page;
  const empty = scope.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible').first();
  if (await empty.count()) {
    const value = await empty.inputValue().catch(() => 'x');
    if (!value) await empty.fill('Phone parity check').catch(() => {});
    const submit = scope.getByRole('button', { name: SUBMIT });
    if (await submit.count()) await submit.last().click({ timeout: 3000 }).catch(() => {});
    else await empty.press('Enter').catch(() => {});
  }
  for (let wait = 0; wait < 8 && writes.length === before; wait += 1) await page.waitForTimeout(250);
  return { create: writes.length > before ? 'persisted' : 'no-write', control: tapped,
    namespaces: [...new Set(writes.slice(before).map((write) => write.namespace))] };
}

// Boot and wait until the whole catalog is active; activating 200+ lazy
// modules takes a while on a dev server. Views are then opened by client-side
// navigation, as a user tapping through the drawer would.
async function boot() {
  await page.goto(`${base}/app/marketplace`, { waitUntil: 'domcontentloaded' });
  await settle(400);
  const expected = plugins.length;
  for (let wait = 0; wait < 240; wait += 1) {
    const installed = await page.evaluate(() => Number(/Plugins \((\d+) installed\)/.exec(document.body.innerText)?.[1] ?? 0));
    if (installed >= expected) return;
    if (wait === 239) throw new Error(`Only ${installed} of ${expected} plugins became active.`);
    await page.waitForTimeout(500);
  }
}
await boot();

const results = [];
for (const { view, plugin } of views) {
  errors.length = 0;
  const open = () => page.evaluate((path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); },
    `/app/${encodeURIComponent(view)}`);
  await open();
  await settle(400);
  const text = await page.evaluate(() => document.body.innerText);
  const title = await page.evaluate(() => document.querySelector('header h1')?.textContent?.trim() ?? '');
  // An unknown view id falls back to the dashboard; that is not this view rendering.
  let shown = await page.evaluate(() => document.querySelector('[data-view]')?.getAttribute('data-view') ?? '');
  if (view !== 'dashboard' && (shown === 'dashboard' || shown === '')) {
    // The workspace may still be settling right after boot and drop the first
    // navigation; open the view once more before failing.
    await page.waitForTimeout(1500);
    await open();
    await settle(400);
    shown = await page.evaluate(() => document.querySelector('[data-view]')?.getAttribute('data-view') ?? '');
  }
  const layout = await layoutReport();
  const interactive = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="tab"], [contenteditable="true"]')]
    .filter((el) => !el.closest('header, nav') && !el.disabled && el.getBoundingClientRect().width > 0).length);
  const result = {
    view, plugin: plugin.id,
    rendered: !/is not installed/.test(text) && (view === 'dashboard' || (shown !== '' && shown !== 'dashboard')) && errors.length === 0 && layout.overflow.length === 0,
    title, shown,
    interactive: interactive > 0,
    errors: [...new Set(errors)].slice(0, 2),
    overflow: layout.overflow.slice(0, 2),
  };
  if (plugin.schemas.length > 0 && result.rendered) Object.assign(result, await tryCreate());
  // A create may open an editor or dialog; start the next view from a clean shell.
  await page.keyboard.press('Escape').catch(() => {});
  if (!(await page.locator('[data-view]').count())) await boot();
  results.push(result);
  const flag = result.rendered && result.interactive ? 'ok  ' : 'FAIL';
  console.log(`${flag} ${view.padEnd(34)} [${title}] ${result.create ?? ''} ${result.errors[0] ?? result.overflow[0] ?? ''}`);
}
await browser.close();

const failed = results.filter((result) => !result.rendered || !result.interactive);
const summary = {
  views: results.length,
  failed: failed.length,
  recordViews: results.filter((result) => result.create).length,
  persisted: results.filter((result) => result.create === 'persisted').length,
};
if (!only.length && !storageThrows) {
  writeFileSync(join(ROOT, 'docs/mobile/android-parity-evidence.json'), `${JSON.stringify({
    generatedBy: 'frontend/scripts/phoneParity.mjs',
    note: 'Phone-viewport (412x883, touch) sweep of every contributed view with the whole catalog installed against an in-memory plugin-state API. Device runs are recorded by the android-emulator CI job.',
    summary, results,
  }, null, 2)}\n`);
}
console.log(`\n${JSON.stringify(summary)}`);
process.exit(failed.length ? 1 : 0);
