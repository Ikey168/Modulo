import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploy, deploymentPlan } from './deploy-marketplace-release.mjs';
const release = { id: '00000000-0000-4000-8000-000000000001', plugin_key: 'example-plugin', trustStatus: 'VERIFIED', image_reference: 'ghcr.io/example/plugin:latest', image_digest: `sha256:${'a'.repeat(64)}` };
const previous = { id: '00000000-0000-4000-8000-000000000002' };
function fixture(fail = false) {
  const calls = [], commands = [];
  const api = async (path, body) => { calls.push([path, body]); return path.endsWith('/health') ? { desired: previous } : release; };
  const helm = async command => { commands.push(command); if (fail) throw new Error('simulated deployment failure'); return ''; };
  return { calls, commands, api, helm, releaseId: release.id, helmRelease: 'example', namespace: 'modulo' };
}
test('preview is read-only and the deployment always pins the reviewed digest', async () => {
  const context = fixture(); const result = await deploy(context);
  assert.equal(result.applied, false); assert.deepEqual(context.commands, []);
  assert.ok(context.calls.every(([, body]) => body === undefined));
  assert.ok(result.command.includes(`image.digest=${release.image_digest}`));
  assert.ok(result.command.includes('image.repository=ghcr.io/example/plugin'));
  assert.ok(result.command.includes('--atomic'));
  assert.throws(() => deploymentPlan({ ...release, image_reference: 'ghcr.io/example/plugin@sha256:' + 'b'.repeat(64) }, 'example', 'modulo'));
});
test('deployment requires consent and rechecks policy before invoking Helm', async () => {
  const context = fixture(); await assert.rejects(deploy({ ...context, apply: true }), /consent/);
  await deploy({ ...context, apply: true, consent: true });
  assert.ok(context.calls.find(([path, body]) => path.endsWith('/install') && body.release === release.id && body.consented));
  assert.equal(context.commands.length, 1);
  assert.ok(context.calls.find(([path, body]) => path.endsWith('/deployment') && body.outcome === 'SUCCEEDED'));
});
test('failed atomic upgrade restores the prior approval and audits failure', async () => {
  const context = fixture(true); await assert.rejects(deploy({ ...context, apply: true, consent: true }), /simulated/);
  assert.ok(context.calls.find(([path]) => path.endsWith(`/rollback/${previous.id}`)));
  assert.ok(context.calls.find(([path, body]) => path.endsWith('/deployment') && body.outcome === 'FAILED'));
});
test('rollback restores a matching historical Helm revision including its configuration', async () => {
  const context = fixture(); context.helm = async command => {
    context.commands.push(command);
    if (command[0] === 'history') return JSON.stringify([{ revision: 4, status: 'superseded', description: `modulo-release:${release.id}` }]);
    if (command[0] === 'get') return JSON.stringify({ pluginName: release.plugin_key, image: { digest: release.image_digest } });
    return '';
  };
  await deploy({ ...context, apply: true, consent: true, rollback: true });
  assert.deepEqual(context.commands[2].slice(0, 3), ['rollback', 'example', '4']);
  assert.ok(context.calls.find(([path]) => path.endsWith(`/rollback/${release.id}`)));
});
