/** adb and WebView DevTools helpers shared by the emulator journeys and the upgrade test (#497, #498). */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

export const run = promisify(execFile);
export const sdk = process.env.ANDROID_HOME || `${homedir()}/Android/Sdk`;
export const adb = existsSync(`${sdk}/platform-tools/adb`) ? `${sdk}/platform-tools/adb` : 'adb';
export const packageId = 'com.modulo';
export const out = new URL('../android-smoke/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

export async function command(...args) {
  const { stdout } = await run(adb, args, { timeout: 20_000, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

export async function screenshot(name) {
  const { stdout } = await run(adb, ['exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(`${out}${name}.png`, stdout);
}

export async function eventually(work, label, attempts = 60) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await work(); }
    catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error(`${label}: ${last}`);
}

/** Evaluates an async expression in the packaged WebView and returns its JSON value. */
export async function evaluate(expression) {
  const pid = await eventually(async () => {
    const value = await command('shell', 'pidof', packageId);
    if (!/^\d+$/.test(value)) throw new Error('App process has not started');
    return value;
  }, 'App process');
  const port = Number(await command('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`));
  if (!Number.isInteger(port) || port <= 0) throw new Error('Could not forward WebView DevTools');
  try {
    const page = await eventually(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`DevTools returned ${response.status}`);
      const found = (await response.json()).find(item => item.type === 'page' && item.url.startsWith('https://localhost/'));
      if (!found) throw new Error('Packaged WebView page has not loaded');
      return found;
    }, 'Packaged WebView');
    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      const timeout = setTimeout(() => { socket.close(); reject(new Error('WebView probe timed out')); }, 20_000);
      socket.addEventListener('open', () => socket.send(JSON.stringify({
        id: 1, method: 'Runtime.evaluate', params: { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true },
      })));
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timeout); socket.close();
        const result = message.result?.result;
        if (message.result?.exceptionDetails) reject(new Error(`WebView probe failed: ${JSON.stringify(message.result.exceptionDetails)}`));
        else resolve(result?.value);
      });
      socket.addEventListener('error', reject);
    });
  } finally {
    await command('forward', '--remove', `tcp:${port}`).catch(() => {});
  }
}

