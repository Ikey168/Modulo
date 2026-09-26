# Android inventory: plugins, storage keys and parity gaps

Issue: [#479](https://github.com/Ikey168/Modulo/issues/479) · Epic: [#478](https://github.com/Ikey168/Modulo/issues/478)

## Sources of truth

| Artifact | What it holds | Produced by |
| --- | --- | --- |
| [`android-inventory.json`](android-inventory.json) | Every catalog plugin: stable ID, runnable flag, dependencies, contributions (views, note panels, fences, editor actions, workflow nodes), owned storage keys and schemas, device/native and backend dependencies, and the issues responsible for its storage migration and Android parity. Also every registered storage key, every browser Storage reference in source, and every declared key constant with its owner. | `npm run inventory:android --workspace=frontend` |
| [`android-parity-matrix.md`](android-parity-matrix.md) | The phone/tablet acceptance target per runnable plugin: record operations, domain actions, device needs, sync location, offline behaviour and responsible issues. | Same generator |
| [`legacyKeyRegistry.ts`](../../frontend/src/services/legacy/legacyKeyRegistry.ts) | The single owner, disposition (migrate, transfer, transient, retired), durable destination and issue of every browser Storage key Modulo has written. | Maintained by hand; enforced by tests and CI |

The generator activates every catalog plugin (including the dynamically
generated families: foundation tools, self-hosted tools, media types, life and
learning collections, awareness tools) and records what it actually registers,
so a plugin cannot be missed by reading source alone. Device and backend
dependencies come from a static scan of the plugin module and two levels of its
local imports; they are a triage aid, not proof of behaviour.

CI runs `npm run inventory:android:check --workspace=frontend`. It fails when:

- a plugin fails to activate,
- browser Storage is referenced outside `services/legacy`, authentication
  protocol code or tests,
- a storage key constant in source has no registered owner, or
- the checked-in inventory or matrix no longer matches the catalog.

## Ownership rules

- Every key or key family has exactly one owner. An exact key wins over a
  family pattern; two overlapping families are rejected.
- Shared stores have a single importer. When the desktop snapshot and `main`
  both claimed the business/productivity keys, the per-record stores from #422
  kept ownership and the whole-document duplicates were removed. Main's
  Noesis Information Intake owns `modulo-information-intake-v1`; the local
  ten-mode intake suite was retired.
- `migrate` keys import once into their durable destination through
  `services/legacy`, with a recovery copy written first.
- `transfer` keys are device caches, queues, drafts or device preferences that
  move into IndexedDB/SQLite rather than to the server.
- `transient` keys are session-only and now live in memory.
- Authentication protocol state (OIDC transaction state, return paths) is not
  plugin data and is owned by #488.

## Phone parity evidence

`frontend/scripts/phoneParity.mjs` installs the whole catalog in a
Pixel-class touch viewport (412x883) against an in-memory plugin-state API and
opens every contributed view by client-side navigation. For each view it
records whether the view itself rendered (not the dashboard fallback or an
install prompt), without page errors or horizontal overflow, and whether it
offers an enabled control. For plugins with registered record schemas it also
taps the view's primary create control and records whether the edit reached the
plugin-state API. Results are in `android-parity-evidence.json`.

This is browser evidence at phone size, not device evidence: it does not prove
WebView-specific behaviour, native plugins or performance. Device runs belong to
the `android-emulator` CI job and the release checklist (#497, #498). The
automatic create probe recognizes common "Add/New/Create" controls only; views
reported as `no-create-control` or `no-write` need their workflow checked by
hand or by a view-specific test before parity is claimed.

## Reconciliation with the working tree

The epic was written against a desktop working tree that was not on `main`.
It was preserved as `preserve/desktop-modulo-20260922` and merged into this
branch before the inventory was taken, so the catalog above is the complete
current plugin set (218 runnable entries at generation time). The
`preserve/oracle-modulo-20260922` branch is an older deployment snapshot and
contributes no plugin absent here.

## Legacy Android scaffold (`mobile/android`)

The Notes-only Kotlin/Room project predates the shared frontend. It does not
build as checked in, and none of it is packaged by the Capacitor shell in
`mobile/app`.

| Finding | Where | Disposition |
| --- | --- | --- |
| No `settings.gradle`, so Gradle cannot configure the project | `mobile/android/` | Not repaired; the project is reference-only |
| Manifest declares `NoteDetailActivity`, `AuthActivity`, `SettingsActivity` and `BootReceiver`, none of which exist | `AndroidManifest.xml` | Not repaired; the Capacitor shell has one `MainActivity` |
| Missing resources: `@xml/data_extraction_rules`, `@xml/backup_rules`, `@mipmap/ic_launcher*`, `@menu/activity_main_drawer`, `@navigation/mobile_navigation` | `AndroidManifest.xml`, layouts | Not repaired; the shell has its own backup rules, icons and navigation |
| Hard-coded hosts `https://api.modulo.app/` and `https://api-dev.modulo.app/` | `NetworkClient.kt`, `app/build.gradle` | Replaced by the user-configured HTTPS server origin (#488) |
| Token refresh returns `null` ("not implemented") | `TokenManager.kt` | Replaced by OIDC with PKCE in the system browser and native secure storage (#488) |
| Edit/delete, sync status and error UI are TODOs | `NotesFragment.kt` | Superseded by the shared Notes plugin |
| Room `NoteEntity`/`NoteDao` schema and encrypted token storage | `database/`, `auth/` | Kept as migration references for an upgrade from any installed build of the old app with the same `com.modulo` identity (#498) |

The old project stays in the repository until the signed release pipeline
proves upgrade continuity for the `com.modulo` identity (#498); it must not be
extended as a second product.
