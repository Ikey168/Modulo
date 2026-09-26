/**
 * Phone-viewport screenshot harness for the Android/phone presentation layer.
 *
 * Runs the dev server's workspace at Pixel-class dimensions with a stubbed
 * identity provider and a fixed note set, so a change to the phone chrome can
 * be seen rather than argued about. Usage:
 *   node scripts/phoneShots.mjs <baseUrl> <outDir> [route:name ...]
 *
 * Environment:
 *   PHONE_FONT_SCALE=2   render as Android does with the largest system font
 *                        size (WebView text zoom scales the root font size);
 *   PHONE_STRICT=1       exit 1 on horizontal overflow or a page error, so the
 *                        audit can gate CI (#490).
 */
import { chromium, devices } from 'playwright';

const [base = 'http://127.0.0.1:5188', out = '/tmp/phone-shots', ...rest] = process.argv.slice(2);
const FONT_SCALE = Number(process.env.PHONE_FONT_SCALE || 1);
const STRICT = process.env.PHONE_STRICT === '1';
let failures = 0;
const targets = (rest.length ? rest : [
  '/app/dashboard:dashboard', '/app/notes:notes', '/app/marketplace:marketplace',
]).map((t) => { const i = t.lastIndexOf(':'); return [t.slice(0, i), t.slice(i + 1)]; });

const TOKEN = 'phone-shot-token';
const TIME = '2026-09-07T00:00:00Z';
const PLUGINS = ['notes-editor', 'graph-view', 'daily-notes'];
const NOTES = ['Quarterly planning', 'Meeting: infra review', 'Reading list', 'Android shell rollout',
  'Keycloak realm migration', 'Weekly review 2026-W37', 'Oracle deployment runbook', 'Design tokens audit',
  'Trip: Lisbon', 'Onboarding checklist', 'Glossary', 'Ideas backlog'].map((title, i) => ({
  id: i + 1, title,
  content: `# ${title}\n\nBody text for ${title}. Links to [[Reading list]] and carries a couple of sentences so a preview has something to show.`,
  markdownContent: `# ${title}\n\nBody text for ${title}. Links to [[Reading list]].`,
  tags: i % 3 === 0 ? [{ id: i + 1, name: 'work' }] : i % 3 === 1 ? [{ id: i + 1, name: 'personal' }, { id: i + 40, name: 'reading' }] : [],
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: `2026-09-${String(2 + (i % 10)).padStart(2, '0')}T10:00:00Z`,
}));

// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH lets a preinstalled browser stand in for Playwright's pinned download.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 412, height: 883 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await ctx.newPage();
if (FONT_SCALE !== 1) {
  // Android's WebView applies the system font scale as text zoom; the shell's
  // rem-based type follows the root font size, which is what this reproduces.
  await page.addInitScript((scale) => {
    const apply = () => { document.documentElement.style.fontSize = `${scale * 100}%`; };
    if (document.documentElement) apply(); else document.addEventListener('DOMContentLoaded', apply);
  }, FONT_SCALE);
}

await page.route('**/src/features/auth/authService.ts*', (route) => route.fulfill({
  contentType: 'application/javascript',
  body: `const session={issuer:'https://identity.example.test',subject:'phone-shot',accessToken:'${TOKEN}'};
    export const authService={stateSession:()=>session,subscribeSession:()=>()=>{},getAccessToken:async()=>session.accessToken,
    getUser:async()=>({id:session.subject,name:'Ada Lovelace',email:'ada@example.test',roles:['ADMIN'],accessToken:session.accessToken}),
    isAuthenticated:()=>true,isOffline:()=>false,logout:async()=>{},hasRole:()=>true,hasAnyRole:()=>true};`,
}));

const records = new Map();
records.set('workspace-settings/installed', {
  key: 'installed', schemaId: 'modulo.workspace.installations', schemaVersion: 1, version: 1,
  value: PLUGINS.map((id) => ({ id, enabled: true })), deleted: false, createdAt: TIME, updatedAt: TIME,
});

await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path === '/api/notes') return route.fulfill({ json: NOTES });
  if (path.startsWith('/api/notes/')) return route.fulfill({ json: NOTES[0] });
  if (path === '/api/links') return route.fulfill({ json: [] });
  if (path === '/api/tags') return route.fulfill({ json: [{ id: 1, name: 'work' }, { id: 2, name: 'personal' }, { id: 3, name: 'reading' }] });
  if (path === '/api/blueprints') return route.fulfill({ json: [] });
  if (path === '/api/workflow-runs/summary') return route.fulfill({ json: { counts: [] } });
  if (path === '/api/workflow-runs') return route.fulfill({ json: { items: [], hasMore: false } });
  const match = path.match(/^\/api\/workspaces\/personal\/plugin-state\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return route.fulfill({ json: [] });
  const namespace = decodeURIComponent(match[1]);
  const key = match[2] ? decodeURIComponent(match[2]) : undefined;
  if (!key) return route.fulfill({ json: { records: [...records].filter(([id]) => id.startsWith(`${namespace}/`)).map(([, v]) => v), nextCursor: null } });
  const id = `${namespace}/${key}`;
  const current = records.get(id);
  if (route.request().method() === 'GET') return route.fulfill(current ? { json: current } : { status: 404, json: { code: 'STATE_NOT_FOUND' } });
  const body = route.request().postDataJSON();
  const next = { key, schemaId: body.schemaId, schemaVersion: body.schemaVersion, value: body.value,
    version: (current?.version ?? 0) + 1, deleted: false, createdAt: current?.createdAt ?? TIME, updatedAt: TIME };
  records.set(id, next);
  return route.fulfill({ json: next });
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

async function settle() {
  for (let i = 0; i < 40; i += 1) {
    const ready = await page.evaluate(() => !/^Loading/.test(document.body.innerText.trim()) && document.body.innerText.trim().length > 0);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
}

for (const [route, name] of targets) {
  // "path!Tap text" taps that text after the route settles, so a detail screen
  // can be captured without a second harness.
  const [path, tap] = route.split('!');
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await settle();
  if (tap) {
    // "@Label" taps by accessible name; anything else by visible text.
    const target = tap.startsWith('@')
      ? page.getByRole('button', { name: tap.slice(1) })
      : page.getByText(tap, { exact: false });
    await target.first().click({ timeout: 10000 }).catch((e) => console.log('  tap failed:', e.message.split('\n')[0]));
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = [], small = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // A child of a deliberately swipeable strip is not an overflow bug.
      let inStrip = false;
      for (let up = el.parentElement; up && !inStrip; up = up.parentElement) {
        const x = getComputedStyle(up).overflowX;
        inStrip = x === 'auto' || x === 'scroll';
      }
      if (!inStrip && r.right > vw + 2 && overflow.length < 6) overflow.push(`${el.tagName.toLowerCase()}[${String(el.className).slice(0, 55)}] "${(el.textContent || '').trim().slice(0, 30)}" right=${Math.round(r.right)}`);
      const tag = el.tagName.toLowerCase(), role = el.getAttribute('role');
      if ((tag === 'button' || tag === 'a' || role === 'button' || role === 'tab' || role === 'checkbox') && (r.height < 44 || r.width < 44) && small.length < 12)
        small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26)}"`);
    }
    return { overflow, small };
  });
  console.log(`\n### ${name}  ${route}`);
  if (report.overflow.length) { failures += 1; console.log('  OVERFLOW  ', report.overflow.join('\n             ')); }
  if (report.small.length) console.log('  <44px      ', report.small.join(', '));
}
if (errors.length) { failures += 1; console.log('\nPAGE ERRORS:', [...new Set(errors)].slice(0, 6)); }
await browser.close();
if (STRICT && failures) {
  console.error(`\nPhone audit failed: ${failures} problem(s) at font scale ${FONT_SCALE}.`);
  process.exit(1);
}
