/**
 * Packaged-app journeys on an emulator (#487, #497). Each step drives the real
 * APK through adb and inspects the WebView over DevTools; screenshots and a
 * JSON report land in mobile/app/android-smoke/ for the CI artifact.
 */
import { writeFileSync } from 'node:fs';
import { command, eventually, evaluate, out, packageId, screenshot } from './adbWebView.mjs';

const report = { steps: [] };

async function step(name, work) {
  const started = Date.now();
  try {
    const detail = await work();
    report.steps.push({ name, ok: true, ms: Date.now() - started, detail });
    await screenshot(name).catch(() => {});
    console.log(`ok   ${name}`);
  } catch (error) {
    report.steps.push({ name, ok: false, ms: Date.now() - started, error: String(error) });
    await screenshot(`${name}-failed`).catch(() => {});
    throw error;
  }
}

const launch = () => command('shell', 'am', 'start', '-W', '-n', `${packageId}/.MainActivity`);
const restart = async () => { await command('shell', 'am', 'force-stop', packageId); await launch(); };
const onboardingVisible = async () => eventually(async () => {
  const screen = await evaluate('return document.body.innerText;');
  if (!screen.includes('Connect to Modulo') && !screen.includes('Sign in')) throw new Error('Onboarding or login screen has not rendered');
  return screen;
}, 'First screen');

const BRIDGE = `
  const cache = window.Capacitor?.Plugins?.ModuloStateCache;
  if (!cache) throw new Error('Native SQLite bridge is missing');
  const partition = 'android-smoke-v1';
  const replica = (await cache.replica()).replica;
  if ((await cache.load({ partition })).snapshot === null) {
    await cache.save({ partition, snapshot: JSON.stringify({ format: 1, partition, entries: [] }) });
  }
  let rejectsInsecureServer = false;
  try { await cache.setServer({ origin: 'http://insecure.example' }); } catch { rejectsInsecureServer = true; }
  return { replica, snapshot: (await cache.load({ partition })).snapshot, server: (await cache.server()).origin, rejectsInsecureServer };`;

try {
  if (await command('shell', 'getprop', 'sys.boot_completed') !== '1') throw new Error('Android has not booted');
  report.device = { sdk: await command('shell', 'getprop', 'ro.build.version.sdk'), model: await command('shell', 'getprop', 'ro.product.model') };

  let first;
  await step('cold-launch', async () => {
    const started = Date.now();
    await launch();
    await onboardingVisible();
    first = await evaluate(BRIDGE);
    if (!first.snapshot || !first.replica || !first.rejectsInsecureServer) throw new Error('SQLite bridge or HTTPS guard failed');
    return { coldStartMs: Date.now() - started };
  });

  await step('force-stop-recovery', async () => {
    await restart();
    await onboardingVisible();
    const second = await evaluate(BRIDGE);
    if (second.replica !== first.replica || second.snapshot !== first.snapshot || second.server !== first.server) {
      throw new Error('SQLite snapshot, replica or server selection did not survive process death');
    }
  });

  await step('secure-store', async () => {
    await evaluate(`await window.Capacitor.Plugins.ModuloSecureStore.set({ key: 'smoke.token', value: 'refresh-123' });`);
    await restart();
    await onboardingVisible();
    const value = await evaluate(`const store = window.Capacitor.Plugins.ModuloSecureStore;
      const read = (await store.get({ key: 'smoke.token' })).value; await store.remove({ key: 'smoke.token' });
      return { read, after: (await store.get({ key: 'smoke.token' })).value };`);
    if (value.read !== 'refresh-123' || value.after !== null) throw new Error(`Keystore round trip failed: ${JSON.stringify(value)}`);
  });

  await step('share-to-modulo', async () => {
    await command('shell', 'am', 'start', '-a', 'android.intent.action.SEND', '-t', 'text/plain',
      '--es', 'android.intent.extra.TEXT', 'https://example.org/shared-from-smoke', '-n', `${packageId}/.MainActivity`);
    const pending = () => evaluate(`return (await window.Capacitor.Plugins.ModuloShare.pending()).shares;`);
    const shares = await eventually(async () => {
      const list = await pending();
      if (!list.some(share => share.text === 'https://example.org/shared-from-smoke')) throw new Error('Share not received');
      return list;
    }, 'Share inbox');
    // Killed before routing: the share must still be there.
    await restart();
    await onboardingVisible();
    const kept = await pending();
    const share = kept.find(item => item.text === 'https://example.org/shared-from-smoke');
    if (!share) throw new Error('Share did not survive process death');
    await evaluate('await window.Capacitor.Plugins.ModuloShare.complete({ id: args.id });', { id: share.id });
    if ((await pending()).some(item => item.id === share.id)) throw new Error('Completed share was not removed');
    return { received: shares.length };
  });

  await step('reminder-alarms', async () => {
    // dumpsys does not print a PendingIntent's data, so compare Modulo's alarm count.
    const moduloAlarms = async () => ((await command('shell', 'dumpsys', 'alarm')).match(/com\.modulo\b/g) ?? []).length;
    const baseline = await moduloAlarms();
    const at = Date.now() + 60 * 60 * 1000;
    const local = new Date(at).toISOString().slice(0, 16);
    const status = await evaluate('return await window.Capacitor.Plugins.ModuloReminders.replaceAll({ reminders: args.reminders });', {
      reminders: [{ id: 'smoke:1', at, local, title: 'Smoke reminder', body: 'From CI', route: '/app/reminders-notifications?record=smoke' }],
    });
    if (status.scheduled !== 1) throw new Error(`Reminder not stored: ${JSON.stringify(status)}`);
    const armed = await moduloAlarms();
    if (armed <= baseline) throw new Error('Alarm was not armed');
    await evaluate(`await window.Capacitor.Plugins.ModuloReminders.replaceAll({ reminders: [] });`);
    const cleared = await moduloAlarms();
    if (cleared > baseline) throw new Error('Alarm survived removal from the published set');
    return { ...status, baseline, armed, cleared };
  });

  await step('large-text', async () => {
    await command('shell', 'settings', 'put', 'system', 'font_scale', '2.0');
    try {
      await restart();
      await onboardingVisible();
      const layout = await evaluate(`return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth };`);
      if (layout.scrollWidth > layout.width + 1) throw new Error(`Horizontal overflow at 200% text: ${JSON.stringify(layout)}`);
      return layout;
    } finally {
      await command('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
    }
  });

  console.log(`Android smoke passed on API ${report.device.sdk}: ${report.steps.map(item => item.name).join(', ')}`);
} finally {
  writeFileSync(`${out}report.json`, `${JSON.stringify(report, null, 2)}\n`);
}
