/**
 * Phone performance budget (#492). Renders the heavy views with a large
 * workspace (2,000 notes, 4,000 links) at a Pixel-class viewport with the CPU
 * throttled 4x (a mid-range phone relative to a CI runner) and fails when a
 * budget is exceeded. Writes docs/mobile/android-performance.json.
 *   node scripts/phonePerf.mjs <baseUrl>
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPhone } from './phoneHarness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const [base = 'http://127.0.0.1:5188'] = process.argv.slice(2);
const NOTE_COUNT = 2000;
const LINK_COUNT = 4000;
const CPU_THROTTLE = 4;

// Budgets for a throttled run; see docs/mobile/android-performance.md.
const BUDGET = {
  notesListMs: 5000,
  noteOpenMs: 2500,
  graphFirstFrameMs: 5000,
  canvasMs: 4000,
  longestTaskMs: 1500,
  heapMb: 250,
};

const notes = Array.from({ length: NOTE_COUNT }, (_, i) => ({
  id: i + 1, title: `Note ${i + 1} ${['planning', 'research', 'journal', 'meeting'][i % 4]}`,
  content: `# Note ${i + 1}\n\n${'Body text with [[Note ' + ((i * 7) % NOTE_COUNT + 1) + ']] and more words. '.repeat(8)}`,
  markdownContent: `# Note ${i + 1}\n\nBody text with [[Note ${(i * 7) % NOTE_COUNT + 1}]].`,
  tags: i % 5 === 0 ? [{ id: 1, name: 'work' }] : [], createdAt: '2026-01-01T00:00:00Z',
  updatedAt: `2026-09-${String(1 + (i % 25)).padStart(2, '0')}T10:00:00Z`,
}));
const links = Array.from({ length: LINK_COUNT }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, linkType: 'related',
  sourceNoteId: (i % NOTE_COUNT) + 1, targetNoteId: ((i * 13 + 5) % NOTE_COUNT) + 1,
}));

const { browser, context, page, errors } = await openPhone({
  plugins: ['notes-editor', 'graph-view', 'canvas-board', 'daily-notes'], notes, links,
});
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await cdp.send('Performance.enable');
await page.addInitScript(() => {
  window.__longest = 0;
  new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__longest = Math.max(window.__longest, entry.duration); })
    .observe({ type: 'longtask', buffered: true });
});

async function timed(label, action, ready) {
  const start = Date.now();
  await action();
  await page.waitForFunction(ready, undefined, { timeout: 60_000 });
  const ms = Date.now() - start;
  console.log(`${label.padEnd(20)} ${ms} ms`);
  return ms;
}

const results = {};
await page.goto(`${base}/app/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('[data-view]'), undefined, { timeout: 60_000 });
const navigate = (path) => page.evaluate((to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }, path);

// Warm-up: load each view's code once. On the dev server the first visit includes on-demand module
// transformation, which a production build does not have; the timed pass measures rendering the data.
for (const path of ['/app/notes', '/app/graph', '/app/canvas', '/app/dashboard']) {
  await navigate(path);
  await page.waitForFunction((view) => document.querySelector(`[data-view="${view}"]`), path.split('/')[2], { timeout: 60_000 });
}
await page.evaluate(() => { window.__longest = 0; });

results.notesListMs = await timed('notes list', () => navigate('/app/notes'),
  () => document.body.innerText.includes('Note 1 planning'));
results.noteOpenMs = await timed('open note', () => navigate('/app/notes?note=1500'),
  () => document.body.innerText.includes('Note 1500 meeting'));
results.graphFirstFrameMs = await timed('graph first frame', () => navigate('/app/graph'), () => {
  const canvas = document.querySelector('[data-view] canvas');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.width) return false;
  const context2d = canvas.getContext('2d');
  const { data } = context2d.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] !== 0) return true;
  return false;
});
results.canvasMs = await timed('canvas board', () => navigate('/app/canvas'), () => document.querySelector('[data-view="canvas"]'));
results.longestTaskMs = Math.round(await page.evaluate(() => window.__longest));
const metrics = (await cdp.send('Performance.getMetrics')).metrics;
results.heapMb = Math.round((metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1024 / 1024);
console.log(`longest task         ${results.longestTaskMs} ms\nJS heap              ${results.heapMb} MB`);
await browser.close();

const failures = Object.entries(BUDGET).filter(([key, limit]) => results[key] > limit).map(([key, limit]) => `${key} ${results[key]} > ${limit}`);
writeFileSync(join(ROOT, 'docs/mobile/android-performance.json'), `${JSON.stringify({
  generatedBy: 'frontend/scripts/phonePerf.mjs', dataset: { notes: NOTE_COUNT, links: LINK_COUNT }, cpuThrottle: CPU_THROTTLE,
  viewport: '412x883 touch', budget: BUDGET, results, pageErrors: [...new Set(errors)].slice(0, 5),
}, null, 2)}\n`);
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 3));
if (failures.length) { console.error(`Budget exceeded: ${failures.join('; ')}`); process.exit(1); }
