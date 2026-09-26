# ADR 0009: Shared Android frontend and plugin state

Date: 2026-09-13, revised 2026-09-26 · Status: accepted · Epic: [#478](https://github.com/Ikey168/Modulo/issues/478) · Issue: [#480](https://github.com/Ikey168/Modulo/issues/480)

## Decision

Package the existing React frontend and the complete plugin catalog in a
Capacitor Android application. Plugin IDs, contribution registration, record
schemas, domain logic, API clients and the server-state protocol stay shared
with web and Electron. Native Android code provides device capabilities through
narrow Capacitor plugins; plugins never depend directly on Electron or on a
browser-only API.

The configured Modulo server is authoritative for acknowledged state. Every
client keeps a partitioned, transactional offline queue: IndexedDB on web and
Electron, SQLite on Android. A partition is `[server origin, OIDC issuer,
subject, workspace, namespace, replica]`. An edit is reported saved only after
the queue write committed; a stale version produces a conflict, which the client
first tries to merge per record (see [plugin-state-api.md](plugin-state-api.md))
before asking the user. Browser `localStorage` is read only by the isolated
migration module in `frontend/src/services/legacy` (#482); normal plugin data,
settings, drafts, recovery and queues never use browser Storage (#486).

## Toolchain and supported versions

| Component | Version | Why |
| --- | --- | --- |
| Capacitor (`@capacitor/core`, `android`, `cli`) | 8.5.x, pinned exactly | Current major. Capacitor 8 targets Android API 36 and requires JDK 21. Pinning the exact patch keeps the generated Android project and the npm runtime in step. |
| Android `minSdk` / `compileSdk` / `targetSdk` | 26 / 36 / 36 | API 26 (Android 8) is Capacitor 8's floor and covers adaptive icons and the platform APIs the shell uses. Google Play requires targeting a recent API level, so compile and target follow the SDK Capacitor 8 is tested against. |
| Android System WebView / Chrome | 120 or newer at runtime | The shared frontend uses modern CSS (`:has`, container queries) and IndexedDB features; older WebViews are refused at startup rather than rendered partially (#487). |
| Android Gradle Plugin | 8.13.x | Matches Capacitor 8's generated project. |
| Gradle | 8.14.3 (wrapper) | Required by AGP 8.13. |
| JDK | 21 | Required by Capacitor 8 and AGP 8.13. The backend stays on Java 17; the Android build uses its own JDK in CI. |

Upgrades move Capacitor, AGP, Gradle and the SDK levels together, following
Capacitor's migration guide, in a dedicated change with the Android smoke run.

## Build layout

```
frontend/            shared React app; `npm run build` emits frontend/dist
mobile/app/          Capacitor project (npm package "modulo-android-shell")
  capacitor.config.ts  appId com.modulo, webDir ../../frontend/dist
  android/             generated Gradle project plus Modulo's native plugins
    app/src/main/java/com/modulo/
      MainActivity.java            registers the native plugins
      ModuloStateCachePlugin.java  SQLite offline queue, replica id, server origin
      ShellWindowPlugin.java       edge-to-edge insets, IME, system bar appearance
desktop/             Electron shell (unchanged entry points)
mobile/android/      legacy Notes-only Kotlin scaffold (reference only, see below)
```

`npm run sync --prefix mobile/app` copies `frontend/dist` into the APK's
assets. Web and Electron keep their entry points: the web build is served by
nginx, Electron loads the same `dist` through `desktop/serve.js`. Platform
differences are selected at runtime (`Capacitor.getPlatform()`), never by
forking components.

## Frontend origin, server and API compatibility

- **Packaged origin.** The APK serves the frontend from its own assets
  (`https://localhost` inside the WebView). Cold launch renders the shell, the
  cached plugin records from SQLite and the offline notes cache without any
  network request. No part of the frontend is downloaded from the server.
- **Configured server.** On first launch the user enters an HTTPS server
  origin. The shell fetches its public configuration, rejects non-HTTPS and
  mixed content (`allowMixedContent: false`), and stores the origin natively.
  API calls, the state API and the websocket resolve against that origin
  (`window.__MODULO_CONFIG__.serverOrigin`); the browser build keeps same-origin
  `/api`. Switching servers closes every state client, discards credentials and
  leaves the old server's queues quarantined in their own partitions.
- **API compatibility.** The Android client uses the same versioned REST and
  state endpoints as the web client. The server must allow the packaged origin
  in CORS, accept bearer tokens without cookies, and keep the state API's
  `X-Modulo-State-Generation` contract. A server that lacks the state API is
  rejected during onboarding with an explanation rather than partially used.

## Authentication

OIDC authorization code with PKCE, as a public client. Login opens the
identity provider in the **system browser via Custom Tabs**, never in an
embedded WebView, as RFC 8252 requires and as major identity providers
enforce. The redirect returns through the private-use URI scheme
`com.modulo:/oauth2redirect` (RFC 8252 §7.1). A claimed HTTPS app link would
require every self-hosted server to publish an `assetlinks.json` bound to the
APK's signing key, which a user-configured server cannot be expected to do;
PKCE binds the authorization code to the app instance that started the login.
The PKCE transaction (state, nonce, verifier) is kept in app-private device
storage so a login finishes even if Android recreated the app behind the
Custom Tab. Access tokens stay in memory. The refresh token and the identity it
belongs to are stored by `ModuloSecureStorePlugin`, AES-GCM encrypted with an
Android Keystore key and excluded from backup; a relaunch renews the session
from it and verifies the subject and issuer. Without a connection the known
identity keeps the account's cached records, queue and drafts usable (state
requests wait for renewal); a rejected refresh token deletes the credential and
returns to login. Logout deletes it; changing servers clears the secure store.
The Keycloak client lists exact redirect URIs only. Implemented by #488.

## Storage

| Data | Web / Electron | Android |
| --- | --- | --- |
| Plugin state queue and cache | IndexedDB `modulo-plugin-state` (`snapshots`, `replicas`) | SQLite via `ModuloStateCachePlugin` |
| Offline notes cache | IndexedDB `modulo-offline-notes` | SQLite (same plugin, distinct partitions) |
| Device documents (unsaved drafts, theme) | IndexedDB `modulo-device-documents` | SQLite (same plugin) |
| Legacy migration recovery copies | IndexedDB `modulo-legacy-recovery` | none; Android never had a browser profile |
| Credentials | memory (browser session) | memory plus Keystore-backed refresh token (`ModuloSecureStorePlugin`) |

Both device adapters pass the same contract suite
(`statePersistenceContract.test.ts`). Android system backup is disabled for the
private database (`allowBackup="false"`): a restored queue would carry another
installation's replica identity.

## Navigation and layout

The shared frontend's phone layer (`frontend/src/features/workspace/mobile`)
provides the app bar, bottom navigation, edge-swipe drawer, capture button,
bottom sheets and pull-to-refresh. It switches on pointer type and viewport,
not on platform, so a tablet in landscape keeps the desktop list/detail split.
Hardware Back first closes the topmost overlay (dialog, sheet, open menu,
listbox or popover), then walks route history, and on the dashboard leaves the
app only after pending note edits were sent or committed to device storage; text
held nowhere else asks before leaving. When the soft keyboard opens, or focus
moves while it is open, the focused field is scrolled into view inside the
shell's own scroll containers. Deep links (`/app/...`) open the matching route.

Every contributed view is reachable by taps alone: the drawer lists each hub
and sidebar view, a hub's picker sheet lists its tabs, and child views open from
their parent (`phoneReachability.test.ts`). `npm run phone:audit` renders the
phone layout at the default text size and at twice the root font size (Android's
largest font scale is applied by the WebView as text zoom) and fails CI on
horizontal overflow or a page error (#490).

## Native capability contract

Plugins reach device features only through `frontend/src/platform`
(implemented by #489), which exposes one interface per capability with a web
and an Android implementation:

| Capability | Android route | Web/Electron route |
| --- | --- | --- |
| Files: pick, save, share | Storage Access Framework, share sheet, `FileProvider` | file input, download, Web Share |
| Camera capture | camera intent (`CAMERA` only when requested) | `capture` input |
| Notifications and reminders | `POST_NOTIFICATIONS`, exact alarms only where granted | Notification API / Electron |
| Background synchronisation | lifecycle resume, network callbacks, WorkManager for queued sync | focus/online events |
| External links | Custom Tabs | new tab |
| Secure storage | Keystore-backed plugin | none (tokens stay in memory) |
| Desktop-only services (local folders, OCR, PDF tools) | server/remote workflows (#495) | Electron `native-services` |

A plugin whose workflow needs a capability the platform lacks must show a
documented alternative route; hiding the view or rendering it read-only is not
parity. The Android inventory lists every plugin's device needs (#479).

## Trust boundaries

- The APK's own assets are trusted code. Content from the configured server
  (notes, plugin records, rendered Markdown, attachments) is untrusted data: it
  is rendered through the same sanitising Markdown pipeline as the web client
  and never evaluated.
- The WebView loads only the packaged origin. Server pages, identity provider
  pages and external links open outside it (Custom Tabs), so a server cannot
  inject script into the app's origin or read its storage.
- The native bridge exposes only the Modulo plugins above plus Capacitor's
  audited core plugins. Each native method validates its arguments (partition
  shape, HTTPS origin) instead of trusting the WebView.
- External plugin workloads (ADR 0004) run server-side; the Android app never
  downloads or executes plugin code at runtime. Plugin packaging is the same
  bundled catalog as the web build.

## Backend and deployment implications

- CORS must allow the packaged origin for the API, state API and websocket.
- Register `com.modulo:/oauth2redirect` and `com.modulo:/logout` on the
  Keycloak client, next to the exact web callbacks (`deploy/oci/render-realm.sh`).
- The Keycloak client for Android is public (PKCE), separate from any
  confidential web client.
- Nothing in the backend is Android-specific beyond these settings; all data
  paths are the existing owner-scoped APIs.

## Older Android scaffold

`mobile/android` (Notes-only Kotlin/Room) is not buildable as checked in and is
not packaged by the new shell; [android-inventory.md](../mobile/android-inventory.md)
records each defect. Its Room `NoteEntity`/`NoteDao` schema and encrypted token
code are kept only as references for migrating an installed copy of the old app
with the same `com.modulo` identity. Its UI, fixed hosts and token stubs are not
reused, and it is not extended as a second product. It is deleted once the
signed release pipeline has proven upgrade continuity (#498).

## Rejected alternatives

- Loading the web deployment as the entire app: no offline launch, and the
  server would control the app's origin.
- Keeping the Notes-only Kotlin UI: duplicates the catalog and leaves most
  workflows missing.
- Treating IndexedDB or SQLite as the source of truth: new devices would not
  receive data and account transitions would be ambiguous.
- An embedded WebView for login: rejected by RFC 8252 and by identity
  providers, and it exposes credentials to the app.
