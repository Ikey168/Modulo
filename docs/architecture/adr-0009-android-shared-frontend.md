# ADR 0009: Shared Android frontend and plugin state

Date: 2026-09-13 · Status: implementation in progress · Epic: [#478](https://github.com/Ikey168/Modulo/issues/478)

## Decision

Package the existing React frontend and complete plugin registry in a Capacitor
Android application. Keep plugin IDs, contribution registration, record schemas,
and the server-state protocol shared with web and desktop. Native Android code
provides device capabilities through explicit interfaces; plugins do not directly
depend on Electron or a browser-only API.

The Modulo server is authoritative for acknowledged plugin state. Each client
keeps a partitioned, transactional offline queue: IndexedDB on web and Electron,
SQLite on Android. A queue partition includes server origin, OIDC issuer, subject,
workspace, namespace, and replica. Writes are durable before the UI reports them
saved; version conflicts require an explicit resolution path. Account switching
closes old clients and never displays their cached records in the new session.

Existing browser `localStorage` data is read only by a dedicated migration path.
The migration preserves source bytes until a verified durable copy and server
acknowledgement exist. Normal plugin data, settings, drafts, recovery, and queues
do not use `localStorage` or `sessionStorage`. A transient tab-replica identifier
may use `sessionStorage`; it contains no plugin record or credential.

## Android boundaries

The packaged application starts from its bundled assets, with a configurable
HTTPS Modulo server. The current web client assumes same-origin `/api` and a
browser OIDC redirect. Android cannot use those unchanged: API and websocket
URLs must resolve against the selected server; OIDC uses the system browser,
PKCE, an app link return, and OS-backed credential storage. WebView cookies and
browser storage are not a credential vault. Server switching must revoke or
discard credentials, close state clients, and quarantine old queues.

Native file selection, share intent, camera capture, notifications, background
work, and secure storage belong behind platform interfaces. The React catalog
remains the source of truth for available plugin views and actions. A plugin with
a desktop-only action needs a documented Android/server route, not a hidden or
read-only placeholder. Phone and tablet layouts must be verified against every
catalog contribution type.

## Older Android scaffold

`mobile/android` has a Notes-only Kotlin/Room UI, a fixed
`https://api.modulo.app/` host in `NetworkClient.kt`, and an unfinished refresh
path in `TokenManager.kt`. Its `NotesFragment` still marks edit/delete and sync
status as TODO. Keep its Room schema and encrypted-token code as migration
references, but do not extend the Notes UI as a second product. The new
Capacitor project lives in `mobile/app`; before shipping with the same
`com.modulo` package identity, test signing continuity and a data migration from
the old installed version. The old network/auth stubs must not be packaged in
the new application.

## Rollout and verification

First inventory all catalog entries and storage paths. Introduce durable state
and lossless legacy migration, then migrate every domain store. Build and test the
packaged shell, authentication, platform adapters, and whole-catalog workflows.
Gate release on zero normal plugin `localStorage` access, cross-device recovery,
account separation, signed upgrade tests, and an Android device matrix. The old
Kotlin Notes scaffold under `mobile/android` remains distinct until an upgrade
path and package identity are verified; a new shell alone does not retire it.

## Rejected alternatives

- Loading the web deployment as the entire app would avoid an installable offline
  frontend and leave local work dependent on network availability.
- Keeping the old Notes-only Kotlin UI would duplicate the 180-plugin catalog and
  leave most workflows missing.
- Treating IndexedDB or SQLite as the source of truth would not synchronize new
  devices and would keep account transitions ambiguous.
