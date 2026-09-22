#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function deploymentPlan(release, helmRelease, namespace) {
  if (!/^[a-z0-9][a-z0-9-]{0,52}$/.test(helmRelease) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(namespace)) throw new Error('Explicit valid Helm release and namespace are required');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(release.plugin_key) || !/^[0-9a-f-]{36}$/.test(release.id) || !/^sha256:[0-9a-f]{64}$/.test(release.image_digest)) throw new Error('Invalid immutable release identity');
  if (release.trustStatus !== 'VERIFIED') throw new Error('Release evidence is not verified');
  const image = release.image_reference;
  if (typeof image !== 'string' || !/^[a-z0-9][a-z0-9./_:@-]*$/i.test(image)) throw new Error('Invalid image repository');
  if (image.includes('@') && image.split('@')[1] !== release.image_digest) throw new Error('Image digest differs from approved digest');
  let repository = image.split('@')[0];
  if (repository.lastIndexOf(':') > repository.lastIndexOf('/')) repository = repository.slice(0, repository.lastIndexOf(':'));
  return ['upgrade', '--install', helmRelease, fileURLToPath(new URL('../helm/plugin', import.meta.url)), '--namespace', namespace, '--atomic', '--wait', '--timeout', '5m', '--reuse-values',
    '--set-string', `pluginName=${release.plugin_key}`, '--set-string', `image.repository=${repository}`, '--set-string', `image.digest=${release.image_digest}`, '--description', `modulo-release:${release.id}`];
}

export async function deploy({ api, helm, releaseId, helmRelease, namespace, apply = false, consent = false, rollback = false }) {
  const release = await api(`/releases/${releaseId}`);
  const plan = deploymentPlan(release, helmRelease, namespace);
  const plugin = encodeURIComponent(release.plugin_key);
  const health = await api(`/plugins/${plugin}/health`);
  if (!apply) return { release: release.id, digest: release.image_digest, previousRelease: health.desired?.id ?? null, command: ['helm', ...plan], rollback, applied: false };
  if (!consent) throw new Error('--consent is required to approve the exact release and permissions');
  // Recheck at the point of deployment. The approved digest remains fixed even if a tag moves.
  await api(`/releases/${releaseId}/install-check`, {});
  let command = plan;
  if (rollback) {
    const history = JSON.parse(await helm(['history', helmRelease, '--namespace', namespace, '--output', 'json']));
    const target = history.filter(row => row.description === `modulo-release:${releaseId}` && ['superseded', 'deployed'].includes(row.status)).sort((a, b) => Number(b.revision) - Number(a.revision))[0];
    if (!target || !Number.isSafeInteger(Number(target.revision))) throw new Error('No deployed Helm revision matches this release');
    // Verify the revision's actual values as well as its annotation before restoring config.
    const values = JSON.parse(await helm(['get', 'values', helmRelease, '--namespace', namespace, '--revision', String(target.revision), '--output', 'json']));
    if (values.pluginName !== release.plugin_key || values.image?.digest !== release.image_digest) throw new Error('Helm revision does not match the approved plugin digest');
    command = ['rollback', helmRelease, String(target.revision), '--namespace', namespace, '--wait', '--timeout', '5m'];
    await api(`/plugins/${plugin}/rollback/${releaseId}`, {});
  } else await api(`/plugins/${plugin}/install`, { release: releaseId, consented: true });
  try { await helm(command); }
  catch (failure) {
    // --atomic restores a failed upgrade's prior Kubernetes configuration. Restore
    // the approval pin as well; never clear plugin-owned records or volumes.
    if (health.desired && !rollback) await api(`/plugins/${plugin}/rollback/${health.desired.id}`, {});
    await api(`/plugins/${plugin}/deployment`, { release: releaseId, outcome: 'FAILED' });
    throw failure;
  }
  await api(`/plugins/${plugin}/deployment`, { release: releaseId, outcome: 'SUCCEEDED' });
  return { release: release.id, digest: release.image_digest, applied: true, rollback };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const option = name => args[args.indexOf(name) + 1];
    for (const name of ['--api', '--release', '--helm-release', '--namespace']) if (!args.includes(name)) throw new Error(`Required: ${name}`);
    const base = new URL(option('--api'));
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('Use HTTPS, or loopback HTTP, for the API');
    if (!process.env.MODULO_API_TOKEN) throw new Error('Set MODULO_API_TOKEN to an operator access token');
    const api = async (path, body) => {
      const response = await fetch(new URL(`/api/marketplace/trust${path}`, base), { redirect: 'error', signal: AbortSignal.timeout(120000), method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${process.env.MODULO_API_TOKEN}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw new Error(`Trust API rejected request (${response.status})`);
      return response.json();
    };
    const helm = async args => { const result = spawnSync('helm', args, { encoding: 'utf8', timeout: 360000, maxBuffer: 8 * 1024 * 1024 }); if (result.error || result.status !== 0) throw new Error('Helm operation failed; inspect the release status before retrying'); return result.stdout; };
    console.log(JSON.stringify(await deploy({ api, helm, releaseId: option('--release'), helmRelease: option('--helm-release'), namespace: option('--namespace'), apply: args.includes('--apply'), consent: args.includes('--consent'), rollback: args.includes('--rollback') }), null, 2));
  } catch (failure) { console.error(failure.message); process.exitCode = 1; }
}
