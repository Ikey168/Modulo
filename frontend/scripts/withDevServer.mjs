/**
 * Runs a phone check against a freshly started dev server:
 *   node scripts/withDevServer.mjs scripts/phonePerf.mjs
 * The script receives the server's base URL as its first argument.
 */
import { spawn } from 'node:child_process';

const PORT = 5189;
const BASE = `http://127.0.0.1:${PORT}`;
const [script, ...args] = process.argv.slice(2);
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { if (!server.killed) server.kill(); });

let up = false;
for (let attempt = 0; attempt < 60 && !up; attempt += 1) {
  try { up = (await fetch(BASE)).ok; } catch { /* not up yet */ }
  if (!up) await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!up) { console.error('Dev server did not start.'); process.exit(1); }
const code = await new Promise(resolve => spawn('node', [script, BASE, ...args], { stdio: 'inherit' }).on('exit', status => resolve(status ?? 1)));
server.kill();
process.exit(code);
