# Modulo Desktop (Electron)

Electron shell that runs the Modulo web frontend as a native desktop app.
The renderer is the **unmodified** web build: the shell embeds a tiny local
HTTP server (`serve.js`, Node built-ins only) that serves the compiled SPA
and reverse-proxies `/api`, `/ws` and `/actuator` to the Spring Boot backend.
That preserves the same-origin contract the frontend already relies on in
dev (Vite proxy) and Docker (nginx) — no CORS setup, no absolute API URLs,
and WebSockets/STOMP work unchanged.

```
┌────────────── Electron ──────────────┐
│  BrowserWindow (sandboxed renderer)  │
│      http://127.0.0.1:34600          │
│                │                     │
│   ┌────────────▼────────────┐        │      ┌──────────────────┐
│   │ serve.js                │  /api  │      │ Spring Boot      │
│   │  static: frontend/dist  ├────────┼─────►│ localhost:8080   │
│   │  proxy:  /api /ws       │  /ws   │      │ (REST + STOMP)   │
│   └─────────────────────────┘        │      └──────────────────┘
└──────────────────────────────────────┘
```

## Prerequisites

- Node.js ≥ 18
- A running Modulo backend (`docker-compose up` from the repo root, or any
  backend reachable via `MODULO_BACKEND_URL`)

## Development

Run against the Vite dev server (hot reload):

```sh
# terminal 1 — from frontend/
npm run dev

# terminal 2 — from desktop/
npm install
npm run dev        # loads http://localhost:3000
```

Run against a production build of the frontend:

```sh
cd frontend && npm run build
cd ../desktop && npm start
```

`npm run serve` starts only the embedded static+proxy server (no Electron) —
useful for testing the serving layer in a headless environment.

## Packaging

```sh
cd frontend && npm run build     # electron-builder bundles frontend/dist
cd ../desktop
npm run pack     # unpacked app in release/ (quick sanity check)
npm run dist     # installers: AppImage/deb, dmg/zip, nsis (per host OS)
```

Or from the repo root: `npm run build:desktop`.

## Configuration

All settings are environment variables read by the main process:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MODULO_BACKEND_URL` | `http://localhost:8080` | Backend origin the embedded server proxies to |
| `MODULO_KEYCLOAK_URL` | `http://localhost:8180` | Keycloak origin allowed for in-window OIDC navigation |
| `MODULO_DESKTOP_PORT` | `34600` | Fixed port of the embedded server (the app's origin) |
| `ELECTRON_START_URL` | — | Dev-server URL to load instead (implies dev mode) |
| `MODULO_SMOKE_TEST` | — | Path to write a screenshot to, then exit (automation hook) |

### Keycloak

The OIDC redirect URI is derived from `window.location.origin`, so the
desktop app authenticates from a stable origin: `http://127.0.0.1:34600`
(dev mode: `http://localhost:3000`, same as the browser). Add

```
http://127.0.0.1:34600/*
```

to the `modulo-frontend` client's *Valid redirect URIs* (and *Web origins*)
in Keycloak to log in from the packaged app.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- The preload (`preload.cjs`) exposes a minimal read-only
  `window.moduloDesktop` object; extend it via `contextBridge` +
  `ipcRenderer.invoke`, never by enabling node integration
- Window navigation is restricted to the app origin and Keycloak; all other
  links open in the system browser
- The embedded server binds to `127.0.0.1` only
