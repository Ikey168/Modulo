/**
 * Phone layout gate (#490): serves the app, then runs the phone harness in
 * strict mode at the default text size and at Android's largest system font
 * scale. Fails on horizontal overflow or a page error on any audited screen.
 *   npm run phone:audit
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 5188;
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = [
  '/app/dashboard:dashboard', '/app/notes:notes', '/app/notes!Reading list:note', '/app/graph:graph',
  '/app/canvas:canvas', '/app/tags:tags', '/app/calendar:calendar', '/app/marketplace:marketplace',
  '/app/recovery:recovery',
];

const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => { if (!server.killed) server.kill(); };
process.on('exit', stop);

async function ready() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Dev server did not start.');
}

function run(scale) {
  const out = mkdtempSync(join(tmpdir(), `phone-audit-${scale}-`));
  return new Promise(resolve => {
    spawn('node', ['scripts/phoneShots.mjs', BASE, out, ...ROUTES], {
      stdio: 'inherit', env: { ...process.env, PHONE_STRICT: '1', PHONE_FONT_SCALE: String(scale) },
    }).on('exit', code => resolve(code ?? 1));
  });
}

await ready();
let failed = false;
for (const scale of [1, 2]) {
  console.log(`\n== Font scale ${scale} ==`);
  if (await run(scale) !== 0) failed = true;
}
stop();
process.exit(failed ? 1 : 0);
