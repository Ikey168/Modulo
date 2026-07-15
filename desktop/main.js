'use strict';

/**
 * Electron main process for the Modulo desktop shell.
 *
 * Two modes:
 *  - dev  (`electron . --dev` or ELECTRON_START_URL set): loads the Vite dev
 *    server, which already proxies /api and /ws to the backend.
 *  - prod (default): starts the embedded static+proxy server from serve.js
 *    over the built frontend and loads it at http://localhost:3000 — the
 *    same origin as the Vite dev server, which the Keycloak realm
 *    (redirectUris/webOrigins) and the backend CORS allowlist already
 *    trust, so OIDC login and API mutations work with no server-side
 *    configuration. Overriding MODULO_DESKTOP_PORT changes the origin and
 *    then requires registering it in both places.
 *
 * Environment variables:
 *  - ELECTRON_START_URL    dev-server URL (implies dev mode)
 *  - MODULO_BACKEND_URL    backend origin, default http://localhost:8080
 *  - MODULO_KEYCLOAK_URL   Keycloak origin allowed for in-window OIDC
 *                          navigation, default http://localhost:8180
 *  - MODULO_DESKTOP_PORT   port of the embedded server, default 3000
 *  - MODULO_SMOKE_TEST     path to write a screenshot to, then exit
 *                          (used by automated verification)
 */

const path = require('path');
const { app, BrowserWindow, shell } = require('electron');
const { createAppServer } = require('./serve');

const DEV_MODE = process.argv.includes('--dev') || !!process.env.ELECTRON_START_URL;
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.MODULO_BACKEND_URL || 'http://localhost:8080';
const KEYCLOAK_URL = process.env.MODULO_KEYCLOAK_URL || 'http://localhost:8180';
const DESKTOP_PORT = Number(process.env.MODULO_DESKTOP_PORT || 3000);
const SMOKE_TEST_PATH = process.env.MODULO_SMOKE_TEST || '';

let mainWindow = null;
let appServer = null;

// When packaged, electron-builder copies the frontend build into
// resources/app-dist (see "extraResources" in package.json). In a repo
// checkout we use frontend/dist directly.
function distDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-dist')
    : path.join(__dirname, '..', 'frontend', 'dist');
}

// Memoized so re-creating the window (macOS dock activate) doesn't try to
// start a second server on the same port.
let startUrlPromise = null;
function resolveStartUrl() {
  if (!startUrlPromise) {
    startUrlPromise = (async () => {
      if (DEV_MODE) return DEV_URL;
      appServer = await createAppServer({
        distDir: distDir(),
        backendUrl: BACKEND_URL,
        port: DESKTOP_PORT,
      });
      // Load via the `localhost` hostname, not 127.0.0.1: the origin string
      // must match what Keycloak's webOrigins and the backend CORS allowlist
      // contain (http://localhost:3000). The server binds 127.0.0.1;
      // Chromium resolves localhost to the loopback itself.
      const url = `http://localhost:${appServer.port}`;
      console.log(`Modulo desktop ready at ${url} (backend: ${BACKEND_URL})`);
      return url;
    })();
  }
  return startUrlPromise;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function createWindow() {
  const startUrl = await resolveStartUrl();

  // Origins the window itself may navigate to: the app and Keycloak (the
  // OIDC login flow leaves the SPA and comes back via /auth/callback).
  const trustedOrigins = new Set(
    [startUrl, KEYCLOAK_URL].map(originOf).filter(Boolean)
  );

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Modulo',
    backgroundColor: '#0a0a0b', // matches the pre-React splash in index.html
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Everything outside the app/Keycloak opens in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (trustedOrigins.has(originOf(url))) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!trustedOrigins.has(originOf(url))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (SMOKE_TEST_PATH) {
    wireSmokeTest(mainWindow, SMOKE_TEST_PATH);
  }

  await mainWindow.loadURL(startUrl);
}

// Automated-verification hook: render the app, screenshot it, exit. Exits
// non-zero if the page fails to load so scripts can assert on it.
function wireSmokeTest(win, screenshotPath) {
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`Smoke test: failed to load ${url}: ${desc} (${code})`);
    app.exit(1);
  });
  win.webContents.on('did-finish-load', () => {
    // Give React a moment to replace the splash screen before capturing.
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        require('fs').writeFileSync(screenshotPath, image.toPNG());
        console.log(`Smoke test: screenshot written to ${screenshotPath}`);
        app.exit(0);
      } catch (err) {
        console.error(`Smoke test: ${err.message}`);
        app.exit(1);
      }
    }, 3000);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() =>
    createWindow().catch((err) => {
      console.error(err.message);
      app.exit(1);
    })
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((err) => console.error(err.message));
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('quit', () => {
    if (appServer) appServer.close();
  });
}
