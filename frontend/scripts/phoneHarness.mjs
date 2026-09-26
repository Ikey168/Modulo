/**
 * Shared Playwright phone harness: a Pixel-class touch viewport, a stubbed
 * identity, a fixed note set and an in-memory plugin-state API, so phone checks
 * run against the real frontend without a backend or identity provider.
 */
import { chromium, devices } from 'playwright';

const TOKEN = 'phone-shot-token';
const TIME = '2026-09-07T00:00:00Z';
export const DEFAULT_PLUGINS = ['notes-editor', 'graph-view', 'daily-notes'];
export const NOTES = ['Quarterly planning', 'Meeting: infra review', 'Reading list', 'Android shell rollout',
  'Keycloak realm migration', 'Weekly review 2026-W37', 'Oracle deployment runbook', 'Design tokens audit',
  'Trip: Lisbon', 'Onboarding checklist', 'Glossary', 'Ideas backlog'].map((title, i) => ({
  id: i + 1, title,
  content: `# ${title}\n\nBody text for ${title}. Links to [[Reading list]] and carries a couple of sentences so a preview has something to show.`,
  markdownContent: `# ${title}\n\nBody text for ${title}. Links to [[Reading list]].`,
  tags: i % 3 === 0 ? [{ id: i + 1, name: 'work' }] : i % 3 === 1 ? [{ id: i + 1, name: 'personal' }, { id: i + 40, name: 'reading' }] : [],
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: `2026-09-${String(2 + (i % 10)).padStart(2, '0')}T10:00:00Z`,
}));

export async function openPhone({ plugins = DEFAULT_PLUGINS, fontScale = 1, notes = NOTES, links = [], storageThrows = false, viewport = { width: 412, height: 883 } } = {}) {
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH lets a preinstalled browser stand in for Playwright's pinned download.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await ctx.newPage();
if (storageThrows) {
  // Blocked site data: every browser Storage access throws, as in a hardened browser or a
  // WebView with DOM storage disabled. Plugins must keep working (#497).
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('Storage is disabled', 'SecurityError'); } });
    }
  });
}
if (fontScale !== 1) {
  // Android's WebView applies the system font scale as text zoom; the shell's
  // rem-based type follows the root font size, which is what this reproduces.
  await page.addInitScript((scale) => {
    const apply = () => { document.documentElement.style.fontSize = `${scale * 100}%`; };
    if (document.documentElement) apply(); else document.addEventListener('DOMContentLoaded', apply);
  }, fontScale);
}

await page.route('**/src/features/auth/authService.ts*', (route) => route.fulfill({
  contentType: 'application/javascript',
  body: `const session={issuer:'https://identity.example.test',subject:'phone-shot',accessToken:'${TOKEN}'};
    export const authService={stateSession:()=>session,subscribeSession:()=>()=>{},getAccessToken:async()=>session.accessToken,
    getUser:async()=>({id:session.subject,name:'Ada Lovelace',email:'ada@example.test',roles:['ADMIN'],accessToken:session.accessToken}),
    isAuthenticated:()=>true,isOffline:()=>false,logout:async()=>{},hasRole:()=>true,hasAnyRole:()=>true};`,
}));

const records = new Map();
const writes = [];
records.set('workspace-settings/installed', {
  key: 'installed', schemaId: 'modulo.workspace.installations', schemaVersion: 1, version: 1,
  value: plugins.map((id) => ({ id, enabled: true })), deleted: false, createdAt: TIME, updatedAt: TIME,
});

await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();
  if (method !== 'GET' && !path.includes('/plugin-state/')) writes.push({ namespace: path, key: '', method });
  if (path === '/api/notes' && method === 'POST') {
    const body = route.request().postDataJSON() ?? {};
    const note = { ...NOTES[0], id: 1000 + writes.length, title: body.title ?? 'Untitled Note', content: body.content ?? '',
      markdownContent: body.content ?? '', tags: [], createdAt: TIME, updatedAt: TIME };
    return route.fulfill({ json: note });
  }
  if (path === '/api/notes') return route.fulfill({ json: notes });
  if (path.startsWith('/api/notes/')) return route.fulfill({ json: notes.find((note) => String(note.id) === path.split('/')[3]) ?? notes[0] });
  if (path === '/api/links' || path === '/api/note-links') return route.fulfill({ json: links });
  if (path === '/api/tags') return route.fulfill({ json: [{ id: 1, name: 'work' }, { id: 2, name: 'personal' }, { id: 3, name: 'reading' }] });
  if (path === '/api/blueprints') return route.fulfill({ json: [] });
  if (path === '/api/workflow-runs/summary') return route.fulfill({ json: { counts: [] } });
  if (path === '/api/workflow-runs') return route.fulfill({ json: { items: [], hasMore: false } });
  const match = path.match(/^\/api\/workspaces\/personal\/plugin-state\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return route.fulfill({ json: [] });
  const namespace = decodeURIComponent(match[1]);
  const key = match[2] ? decodeURIComponent(match[2]) : undefined;
  // The state protocol pins every client to the server's storage generation.
  if (!key && url.searchParams.has('generation')) return route.fulfill({ json: { generation: '00000000-0000-4000-8000-000000000001' } });
  if (!key) return route.fulfill({ json: { records: [...records].filter(([id]) => id.startsWith(`${namespace}/`)).map(([, v]) => v), nextCursor: null } });
  const id = `${namespace}/${key}`;
  const current = records.get(id);
  if (route.request().method() === 'GET') return route.fulfill(current ? { json: current } : { status: 404, json: { code: 'STATE_NOT_FOUND' } });
  if (route.request().method() === 'DELETE') {
    const deleted = { ...(current ?? { key, createdAt: TIME }), version: (current?.version ?? 0) + 1, deleted: true, updatedAt: TIME };
    records.set(id, deleted);
    writes.push({ namespace, key, method: 'DELETE' });
    return route.fulfill({ json: deleted });
  }
  const body = route.request().postDataJSON();
  writes.push({ namespace, key, method: route.request().method() });
  const next = { key, schemaId: body.schemaId, schemaVersion: body.schemaVersion, value: body.value,
    version: (current?.version ?? 0) + 1, deleted: false, createdAt: current?.createdAt ?? TIME, updatedAt: TIME };
  records.set(id, next);
  return route.fulfill({ json: next });
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

async function settle(pause = 1200) {
  for (let i = 0; i < 40; i += 1) {
    const ready = await page.evaluate(() => !/^Loading/.test(document.body.innerText.trim()) && document.body.innerText.trim().length > 0);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(pause);
}

/** Horizontal overflow outside deliberate scrollers, and touch targets under 44px. */
function layoutReport() {
  return page.evaluate(() => {
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
}

return { browser, context: ctx, page, records, writes, errors, settle, layoutReport };
}
