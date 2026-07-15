#!/usr/bin/env node
'use strict';

/**
 * One-command deploy for the desktop experience:
 *
 *   npm run deploy:desktop        (from the repo root)
 *
 * 1. builds the frontend (Vite -> frontend/dist)
 * 2. starts the backend stack with Docker Compose (backend + its
 *    dependencies: db, neo4j, keycloak — not the web frontend container)
 * 3. waits until the backend answers on MODULO_BACKEND_URL
 * 4. launches the Electron shell (desktop/), which serves frontend/dist
 *    and proxies API/WebSocket traffic to the backend
 *
 * The stack keeps running after the app window closes so relaunches are
 * instant; stop it with `npm run deploy:desktop -- --stop`.
 *
 * Flags:
 *   --no-build     skip the frontend build and Docker image rebuild
 *   --stack-only   deploy backend + build frontend, don't launch Electron
 *   --app-only     launch Electron only (backend already running somewhere)
 *   --stop         stop the Docker Compose stack and exit
 *   --help         usage
 *
 * Node built-ins only; works from any cwd.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const DESKTOP = path.join(ROOT, 'desktop');
const BACKEND_URL = process.env.MODULO_BACKEND_URL || 'http://localhost:8080';
const HEALTH_TIMEOUT_MS = Number(process.env.MODULO_DEPLOY_TIMEOUT_MS || 5 * 60 * 1000);
// Compose services the desktop app needs; depends_on pulls in db/neo4j/keycloak.
const STACK_SERVICES = ['backend'];

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

if (has('--help') || has('-h')) {
  console.log(`Usage: npm run deploy:desktop [-- <flags>]

Builds the frontend, starts the backend stack (Docker Compose) and launches
the Modulo desktop app once the backend is healthy.

Flags:
  --no-build     skip the frontend build and Docker image rebuild
  --stack-only   deploy backend + build frontend, don't launch Electron
  --app-only     launch Electron only (backend must already be running)
  --stop         stop the Docker Compose stack and exit

Environment:
  MODULO_BACKEND_URL         backend origin (default http://localhost:8080)
  MODULO_DEPLOY_TIMEOUT_MS   health-wait timeout (default 300000)`);
  process.exit(0);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, cmdArgs, opts = {}) {
  const label = `${cmd} ${cmdArgs.join(' ')}`;
  console.log(`\n[deploy:desktop] ${label}  (in ${path.relative(ROOT, opts.cwd || ROOT) || '.'})`);
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (res.error) throw new Error(`${label} failed: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`${label} exited with code ${res.status}`);
}

// `docker compose` (v2) with a fallback to the legacy docker-compose binary.
function composeCommand() {
  const v2 = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (v2.status === 0) return ['docker', ['compose']];
  const v1 = spawnSync('docker-compose', ['version'], { stdio: 'ignore' });
  if (v1.status === 0) return ['docker-compose', []];
  throw new Error(
    'Docker Compose not found. Install Docker (https://docs.docker.com/get-docker/) ' +
      'or start the backend yourself and use --app-only.'
  );
}

function compose(composeArgs) {
  const [cmd, prefix] = composeCommand();
  run(cmd, [...prefix, ...composeArgs], { cwd: ROOT });
}

function fetchStatus(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function waitForBackend() {
  const healthUrl = `${BACKEND_URL}/actuator/health`;
  const started = Date.now();
  let lastNote = started;
  console.log(`\n[deploy:desktop] waiting for backend at ${BACKEND_URL} ...`);

  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    const health = await fetchStatus(healthUrl);
    if (health && health.status === 200) {
      try {
        const parsed = JSON.parse(health.body);
        if (!parsed.status || parsed.status === 'UP') return console.log('[deploy:desktop] backend is UP');
      } catch {
        return console.log('[deploy:desktop] backend is UP');
      }
    } else if (health && health.status === 404) {
      // No actuator exposed on this deployment — any live response will do.
      const root = await fetchStatus(BACKEND_URL);
      if (root && root.status < 500) return console.log('[deploy:desktop] backend is responding');
    }

    if (Date.now() - lastNote > 15000) {
      lastNote = Date.now();
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`[deploy:desktop] still waiting (${secs}s) — first boot pulls images and can take a few minutes`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `Backend did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s. ` +
      `Check "docker compose logs backend" and re-run, or use --app-only once it is up.`
  );
}

function ensureFrontendDeps() {
  const hoisted = path.join(ROOT, 'node_modules', '.bin', 'vite');
  const local = path.join(FRONTEND, 'node_modules', '.bin', 'vite');
  if (!fs.existsSync(hoisted) && !fs.existsSync(local)) {
    run(npmCmd, ['install', '-w', 'frontend', '--no-audit', '--no-fund'], { cwd: ROOT });
  }
}

function buildFrontend() {
  ensureFrontendDeps();
  run(npmCmd, ['run', 'build'], { cwd: FRONTEND });
}

function launchDesktop() {
  if (!fs.existsSync(path.join(DESKTOP, 'node_modules'))) {
    run(npmCmd, ['install', '--no-audit', '--no-fund'], { cwd: DESKTOP });
  }
  console.log('\n[deploy:desktop] launching Modulo desktop ...');
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ['start'], {
      cwd: DESKTOP,
      stdio: 'inherit',
      env: { ...process.env, MODULO_BACKEND_URL: BACKEND_URL },
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Electron exited with code ${code}`))));
  });
}

async function main() {
  if (has('--stop')) {
    compose(['stop']);
    console.log('[deploy:desktop] stack stopped');
    return;
  }

  const appOnly = has('--app-only');
  const stackOnly = has('--stack-only');
  if (appOnly && stackOnly) throw new Error('--app-only and --stack-only are mutually exclusive');

  if (!appOnly) {
    if (!has('--no-build')) buildFrontend();
    compose(['up', '-d', ...(has('--no-build') ? [] : ['--build']), ...STACK_SERVICES]);
    await waitForBackend();
  } else if (!has('--no-build') && !fs.existsSync(path.join(FRONTEND, 'dist', 'index.html'))) {
    buildFrontend();
  }

  if (stackOnly) {
    console.log('\n[deploy:desktop] stack deployed. Launch the app with: npm run deploy:desktop -- --app-only --no-build');
    return;
  }

  await launchDesktop();
  console.log('\n[deploy:desktop] app closed. Backend stack is still running — stop it with: npm run deploy:desktop -- --stop');
}

main().catch((err) => {
  console.error(`\n[deploy:desktop] ${err.message}`);
  process.exit(1);
});
