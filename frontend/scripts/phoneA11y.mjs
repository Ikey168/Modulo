/**
 * Accessibility audit of key screens at phone and tablet size (#497), with
 * axe-core (WCAG 2.1 A/AA rules). Fails on critical or serious violations.
 * TalkBack reads the same accessibility tree Chromium builds here, so missing
 * names, roles and labels found by axe are what a screen-reader user meets.
 *   node scripts/phoneA11y.mjs <baseUrl>
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPhone } from './phoneHarness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const [base = 'http://127.0.0.1:5188'] = process.argv.slice(2);
const SCREENS = ['/app/dashboard', '/app/notes', '/app/notes?note=4', '/app/graph', '/app/marketplace', '/app/recovery'];
const DEVICES = { phone: { width: 412, height: 883 }, tablet: { width: 800, height: 1280 } };
const BLOCKING = new Set(['critical', 'serious']);

const results = [];
for (const [device, viewport] of Object.entries(DEVICES)) {
  const { browser, page, settle } = await openPhone({ viewport });
  for (const screen of SCREENS) {
    await page.goto(base + screen, { waitUntil: 'domcontentloaded' });
    await settle(800);
    await page.addScriptTag({ content: axe });
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })).violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })));
    results.push({ device, screen, violations });
    const blocking = violations.filter(v => BLOCKING.has(v.impact));
    console.log(`${blocking.length ? 'FAIL' : 'ok  '} ${device.padEnd(6)} ${screen.padEnd(20)} ${violations.map(v => `${v.id}(${v.impact}×${v.nodes})`).join(' ')}`);
  }
  await browser.close();
}
writeFileSync(join(ROOT, 'docs/mobile/android-accessibility.json'), `${JSON.stringify({ generatedBy: 'frontend/scripts/phoneA11y.mjs', rules: 'WCAG 2.1 A/AA (axe-core)', results }, null, 2)}\n`);
const blocking = results.flatMap(r => r.violations.filter(v => BLOCKING.has(v.impact)).map(v => `${r.device} ${r.screen}: ${v.id} — ${v.help} (${v.sample})`));
if (blocking.length) { console.error(`\n${blocking.length} blocking accessibility violations:\n${[...new Set(blocking)].join('\n')}`); process.exit(1); }
