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

/**
 * Runs an async function body in the packaged WebView and returns its JSON
 * value. `body` is a fixed string written in these scripts; data goes in
 * `args` (available as `args` in the body) and is passed as a CDP call
 * argument, never spliced into code.
 */
export async function evaluate(body, args = {}) {
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
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 0;
    const send = (method, params) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('WebView probe timed out')), 20_000));
    try {
      return await Promise.race([timeout, (async () => {
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
        const global = await send('Runtime.evaluate', { expression: 'globalThis' });
        const result = await send('Runtime.callFunctionOn', {
          objectId: global.result.objectId,
          functionDeclaration: `async function (args) {\n${body}\n}`,
          arguments: [{ value: args }], awaitPromise: true, returnByValue: true,
        });
        if (result.exceptionDetails) throw new Error(`WebView probe failed: ${JSON.stringify(result.exceptionDetails)}`);
        return result.result?.value;
      })()]);
    } finally {
      socket.close();
    }
  } finally {
    await command('forward', '--remove', `tcp:${port}`).catch(() => {});
  }
}

