/**
 * Upgrade continuity (#498): install the previous release, leave a pending
 * edit in the offline queue, the replica identity and a Keystore credential,
 * then install the new release over it and check that all of them survived.
 * Both APKs must carry the same signing key, or Android refuses the upgrade.
 *   node scripts/upgrade-android.mjs <previous.apk> <next.apk>
 */
import { writeFileSync } from 'node:fs';
import { command, eventually, evaluate, out, packageId, screenshot } from './adbWebView.mjs';

const [previous, next] = process.argv.slice(2);
if (!previous || !next) throw new Error('Usage: upgrade-android.mjs <previous.apk> <next.apk>');

const versionCode = async () => Number(/versionCode=(\d+)/.exec(await command('shell', 'dumpsys', 'package', packageId))?.[1] ?? 0);
const launch = async () => {
  await command('shell', 'am', 'force-stop', packageId);
  await command('shell', 'am', 'start', '-W', '-n', `${packageId}/.MainActivity`);
  await eventually(() => evaluate('if (!window.Capacitor?.Plugins?.ModuloStateCache) throw new Error("bridge"); return true;'), 'Packaged app');
};
const SNAPSHOT = JSON.stringify({ format: 1, partition: 'upgrade-check', sequence: 1, entries: [{ key: 'data',
  pending: { sequence: 1, value: { areas: [{ id: 'home', requirements: ['keep me'] }] }, schemaId: 'modulo.workspace.para', schemaVersion: 1, deleted: false } }] });

await command('uninstall', packageId).catch(() => {});
await command('install', previous);
const before = await versionCode();
await launch();
const seeded = await evaluate(`
  const cache = window.Capacitor.Plugins.ModuloStateCache;
  await cache.save({ partition: 'upgrade-check', snapshot: ${JSON.stringify(SNAPSHOT)} });
  await window.Capacitor.Plugins.ModuloSecureStore.set({ key: 'upgrade.check', value: 'refresh-token' });
  return { replica: (await cache.replica()).replica };`);
await screenshot('upgrade-before');

const installed = await command('install', '-r', next);
if (!installed.includes('Success')) throw new Error(`Upgrade install failed: ${installed}`);
const after = await versionCode();
if (after <= before) throw new Error(`versionCode did not increase (${before} -> ${after}); Android would refuse this as an update`);
await launch();
const kept = await evaluate(`
  const cache = window.Capacitor.Plugins.ModuloStateCache;
  return { snapshot: (await cache.load({ partition: 'upgrade-check' })).snapshot, replica: (await cache.replica()).replica,
    secret: (await window.Capacitor.Plugins.ModuloSecureStore.get({ key: 'upgrade.check' })).value };`);
await screenshot('upgrade-after');

const problems = [];
if (kept.snapshot !== SNAPSHOT) problems.push('the pending offline edit changed or disappeared');
if (kept.replica !== seeded.replica) problems.push('the replica identity changed, which would orphan queued edits');
if (kept.secret !== 'refresh-token') problems.push('the Keystore credential did not survive');
writeFileSync(`${out}upgrade.json`, `${JSON.stringify({ previousVersionCode: before, nextVersionCode: after, problems }, null, 2)}\n`);
if (problems.length) throw new Error(`Upgrade lost data: ${problems.join('; ')}`);
console.log(`Upgrade ${before} -> ${after} kept the pending edit, replica identity and credentials.`);
