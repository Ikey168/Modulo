import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(execFile);
const sdk = process.env.ANDROID_HOME || `${homedir()}/Android/Sdk`;
const adb = existsSync(`${sdk}/platform-tools/adb`) ? `${sdk}/platform-tools/adb` : 'adb';
const packageId = 'com.modulo';

async function command(...args) {
  const { stdout } = await run(adb, args, { timeout: 15_000 });
  return stdout.trim();
}

async function eventually(work, label) {
  let last;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { return await work(); }
    catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error(`${label}: ${last}`);
}

async function inspect() {
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
      const pages = await response.json();
      const found = pages.find(item => item.type === 'page' && item.url.startsWith('https://localhost/'));
      if (!found) throw new Error('Packaged WebView page has not loaded');
      return found;
    }, 'Packaged WebView');
    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      const timeout = setTimeout(() => { socket.close(); reject(new Error('WebView probe timed out')); }, 15_000);
      socket.addEventListener('open', () => socket.send(JSON.stringify({
        id: 1, method: 'Runtime.evaluate', params: {
          expression: `(async () => {
            const cache = window.Capacitor?.Plugins?.ModuloStateCache;
            if (!cache) throw new Error('Native SQLite bridge is missing');
            const partition = 'android-smoke-v1';
            const replica = (await cache.replica()).replica;
            const before = (await cache.load({ partition })).snapshot;
            if (before === null) {
              await cache.save({ partition, snapshot: JSON.stringify({ format: 1, partition, entries: [] }) });
            }
            let rejectsInsecureServer = false;
            try { await cache.setServer({ origin: 'http://insecure.example' }); }
            catch { rejectsInsecureServer = true; }
            return { replica, snapshot: (await cache.load({ partition })).snapshot,
              server: (await cache.server()).origin, rejectsInsecureServer,
              screen: document.body.innerText, route: location.pathname };
          })()`, awaitPromise: true, returnByValue: true,
        },
      })));
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timeout); socket.close();
        const result = message.result?.result;
        if (message.result?.exceptionDetails || !result?.value) {
          reject(new Error(`WebView probe failed: ${JSON.stringify(message.result?.exceptionDetails ?? result)}`));
        } else resolve(result.value);
      });
      socket.addEventListener('error', reject);
    });
  } finally {
    await command('forward', '--remove', `tcp:${port}`).catch(() => {});
  }
}

if (await command('shell', 'getprop', 'sys.boot_completed') !== '1') throw new Error('Android has not booted');
await command('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`);
const first = await eventually(async () => {
  const result = await inspect();
  if (!result.screen.includes('Connect to Modulo') && !result.screen.includes('Sign in')) {
    throw new Error('Packaged onboarding or login screen has not rendered');
  }
  return result;
}, 'Cold launch');
if (!first.snapshot || !first.replica || !first.rejectsInsecureServer) throw new Error('Cold launch or SQLite bridge failed');
await command('shell', 'am', 'force-stop', packageId);
await command('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`);
const second = await eventually(async () => {
  const result = await inspect();
  if (!result.screen.includes('Connect to Modulo') && !result.screen.includes('Sign in')) {
    throw new Error('Packaged onboarding or login screen has not rendered');
  }
  return result;
}, 'Process restart');
if (second.replica !== first.replica || second.snapshot !== first.snapshot || second.server !== first.server) {
  throw new Error('SQLite snapshot, replica or server selection did not survive process death');
}
console.log(`Android smoke passed: API ${await command('shell', 'getprop', 'ro.build.version.sdk')}, packaged ${first.server ? 'login' : 'onboarding'} screen, SQLite round trip, HTTPS selection guard and force-stop recovery`);
