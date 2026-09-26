# Full Modulo Android frontend and durable plugin state

Tracking epic: https://github.com/Ikey168/Modulo/issues/478

Modulo needs an installable Android frontend for the complete current plugin catalog, using the same records as web and desktop. All normal plugin persistence must stop using browser localStorage, including indirect access through shared helpers, recovery journals and caches.

## Architecture and scope

- Reuse the React frontend and plugin runtime in a Capacitor Android shell with native Kotlin adapters where needed. Package production frontend assets with the application.
- Extend the existing versioned, namespaced Modulo server-state API. The configured server (including the current Oracle deployment) is the authoritative system of record.
- Use a transactional IndexedDB cache/outbox on web and Electron, and a SQLite adapter on Android. These support offline work; they are not independent localStorage stores.
- Permit legacy localStorage reads only inside an isolated migration module. Validate, export for recovery, upload, verify, and only then retire legacy keys. No runtime fallback to browser Storage.
- Cover every runnable plugin and contribution: views, panels, editor actions, renderers and workflow nodes. Add touch-friendly workflows plus Android/server equivalents for desktop dependencies.
- Keep existing IDs, relations, archives, Area hierarchy/icons, health criteria, checked items, custom requirements and deletion/revision state.
- Implement secure server onboarding/OIDC, device files/sharing/capture, reminders, remote services and lifecycle-aware synchronization.

## Delivery order

1. Inventory and architecture: P01–P02.
2. Shared durable state, safe migration and all plugin data: P03–P08.
3. Android shell, authentication and platform/plugin runtime: P09–P11.
4. Phone/tablet UI and complete workflow parity: P12–P14.
5. Native capabilities and remote service workflows: P15–P17.
6. Cross-client recovery, CI gates and signed release: P18–P20.

## Definition of done

- Every current runnable plugin has catalog-linked Android workflow evidence; no silent read-only or unsupported exclusions.
- Normal plugin operation uses no localStorage or sessionStorage for records, settings, drafts, recovery or queues, directly or through helpers.
- A new device retrieves acknowledged records from the server; offline edits survive process death and synchronize without silent loss or duplication.
- Existing desktop/browser data migrates with IDs, relationships and checklist state intact.
- Account/server switching cannot leak records, credentials or pending mutations.
- A signed, upgradeable APK is tested on supported Android devices; whole-catalog coverage and storage enforcement gates pass.

## Existing work and evidence

Repository inspection found an older Notes-oriented Kotlin/Room scaffold, React workspace plugins, an existing server-state API/client, and remaining localStorage stores. The shared offline-state adapter now uses IndexedDB, while most plugin-owned domain stores still use localStorage. Existing mobile documentation and closed issues are prior work, not proof of whole-catalog Android completion.

The [Android inventory](android-inventory.md) is generated from the activated catalog and the legacy key registry: [android-inventory.json](android-inventory.json) lists every plugin's contributions, storage ownership, schemas, device/backend dependencies and responsible issues, and [android-parity-matrix.md](android-parity-matrix.md) defines the phone/tablet target per plugin. Regenerate both with `npm run inventory:android --workspace=frontend`; CI runs the `--check` variant.

The new Capacitor shell under `mobile/app` packages the React build. Android now selects a native SQLite persistence adapter behind the same state contract; its Java plugin commits each snapshot transaction before resolving the write and retains the same queue replica after process death. Android system backup is disabled for the private offline database. Browser/Electron remain on IndexedDB. The separate Notes offline queue now uses those durable adapters too; Chromium confirms an offline edit survives reload, and migration tests retain legacy bytes until acknowledgement. Its offline editor rejects a stale tab's attempt to replace another tab's pending text until that edit has been reviewed. Android SDK Platform 36, Build Tools 35/36, Platform Tools and JDK 21 are now installed on this PC. `assembleDebug` compiles the Java plugin and packages the frontend successfully. An Android 36 Pixel emulator runs packaged first-launch onboarding, native cache round trip, force-stop recovery and hardware Back smoke checks. A verified HTTPS server origin routes Android API and OIDC traffic. The isolated in-app WebView and HTTPS callback completed a login against the live Oracle Keycloak realm using a disposable account; the dashboard appeared, and an API health request from the packaged WebView returned 200. The disposable account was not provisioned as a Modulo data user, so authenticated data workflows and whole-catalog workflow acceptance remain unverified. The emulator needs host graphics on this PC and can be killed by memory pressure when Gradle builds run concurrently.

The shared frontend now has a phone presentation layer rather than a narrowed
desktop one. `frontend/src/features/workspace/mobile` supplies a 56dp app bar
that names the open screen, a labelled bottom navigation bar, an edge-swipe
drawer over the full destination list, a capture floating action button, and a
scrollable hub tab strip in place of the `<select>` that previously stood in for
a hub's sidebar. Control sizing keys off a `coarse:` Tailwind variant (pointer,
not width) so icon buttons keep their drawn size and gain a 44px target, and
dialogs present as bottom sheets below `md`. `services/mobileViewport.ts`
publishes the measured viewport, device insets and keyboard state as document
state; `ShellWindowPlugin` insets the WebView for the IME under edge-to-edge,
reports that inset back to the page, and follows the selected theme with the
system bar icons. Emulator evidence on an Android 36 Pixel: onboarding, sign-in,
dashboard, the Knowledge hub, the command palette and Marketplace, with the
bottom bar and action button yielding to the soft keyboard and the content
resizing above it.

A second pass reworked the parts of that layer that were still desktop shapes
in phone chrome. Toasts dock to the bottom edge as snackbars instead of
dropping over the app bar; session banners (settings sync, offline notes,
device storage) portal into a slot under the app bar instead of pushing the app
bar off the top of the screen; the floating action button publishes its
footprint so no view ends underneath it; the bottom bar prefers content
destinations over Recovery and Marketplace, and re-tapping the open one scrolls
it to the top; a view can claim the whole screen, which an open note does, so a
note has one bar instead of three; `/app/notes` lands on the list rather than
auto-opening the first note; the desktop dashboard is replaced below `md` by a
phone home of stat tiles, quick actions and recent notes; a hub's views are chosen from a combo box that names the
open one and opens the full grouped list, rather than a tab strip that showed
three of a hub's views at a time and clipped the fourth; the marketplace is one
dense list with full-size install controls; the blueprint editor no longer
overflows 412dp and moves its node palette into a bottom sheet; and the drawer's
account row no longer signs you out for tapping your own name. A labelled button
now reaches 44px on a coarse pointer, and pull-to-refresh works on the phone
shell. `frontend/scripts/phoneShots.mjs` reports zero horizontal overflows and
zero sub-44px targets across dashboard, notes list, note detail, marketplace,
blueprints, the Knowledge hub and recovery at 412×883. The rebuilt APK installs
on an Android 36 Pixel emulator, completes onboarding against
`https://modulo.141.147.5.114.sslip.io` and reaches its sign-in screen; the new
chrome also renders in the device's own browser at 1080×2280. Authenticated
on-device workflows still need a provisioned Modulo account. Whole-catalog phone
verification across all 177 views, tablet layouts, and real-device checks remain
open under P12–P14.

CI regenerates the Android inventory, rejects any browser Storage reference outside the isolated legacy migration module and authentication code (ESLint and the inventory check), and syncs the packaged Android shell.

Related closed issues: #42, #43, #44, #49, #52, #188 and #409, #416–#423. Coordinate the separate open Information Intake workflow work in #474; do not duplicate it.

References: [Capacitor documentation](https://capacitorjs.com/docs), [Android web content and external identity-provider flows](https://developer.android.com/develop/ui/views/layout/webapps).

## Implementation issues

- [ ] [Android P01: Inventory every plugin, storage key, and Android parity gap](https://github.com/Ikey168/Modulo/issues/479)
- [ ] [Android P02: Define the shared React and Capacitor Android architecture](https://github.com/Ikey168/Modulo/issues/480)
- [ ] [Android P03: Replace shared localStorage persistence with durable synchronized state](https://github.com/Ikey168/Modulo/issues/481)
- [ ] [Android P04: Migrate existing local data safely into the server-backed store](https://github.com/Ikey168/Modulo/issues/482)
- [ ] [Android P05: Move PARA and productivity records off localStorage](https://github.com/Ikey168/Modulo/issues/483)
- [ ] [Android P06: Migrate personal, life, hobbies and media plugin stores](https://github.com/Ikey168/Modulo/issues/484)
- [ ] [Android P07: Migrate work, learning, research and all remaining plugin-owned stores](https://github.com/Ikey168/Modulo/issues/485)
- [ ] [Android P08: Remove localStorage from plugin settings, runtime and shared helpers](https://github.com/Ikey168/Modulo/issues/486)
- [ ] [Android P09: Build the installable Android shell from the shared frontend](https://github.com/Ikey168/Modulo/issues/487)
- [ ] [Android P10: Connect Android to Modulo servers with secure OIDC login](https://github.com/Ikey168/Modulo/issues/488)
- [ ] [Android P11: Provide Android platform capabilities and full plugin runtime support](https://github.com/Ikey168/Modulo/issues/489)
- [ ] [Android P12: Adapt workspace navigation and shared UI for Android](https://github.com/Ikey168/Modulo/issues/490)
- [ ] [Android P13: Complete Android workflows for all record-based plugins](https://github.com/Ikey168/Modulo/issues/491)
- [ ] [Android P14: Make complex editors and visual plugins usable on Android](https://github.com/Ikey168/Modulo/issues/492)
- [ ] [Android P15: Implement Android files, capture, sharing and attachments](https://github.com/Ikey168/Modulo/issues/493)
- [ ] [Android P16: Implement reminders and lifecycle-aware background work](https://github.com/Ikey168/Modulo/issues/494)
- [ ] [Android P17: Support desktop-dependent tools and remote service workflows on Android](https://github.com/Ikey168/Modulo/issues/495)
- [ ] [Android P18: Verify cross-device synchronization and lossless recovery](https://github.com/Ikey168/Modulo/issues/496)
- [ ] [Android P19: Gate CI on zero plugin localStorage and full Android coverage](https://github.com/Ikey168/Modulo/issues/497)
- [ ] [Android P20: Create the signed Android release and upgrade pipeline](https://github.com/Ikey168/Modulo/issues/498)

## Dependency map

| Issue | Depends on |
| --- | --- |
| [P01](https://github.com/Ikey168/Modulo/issues/479) | None |
| [P02](https://github.com/Ikey168/Modulo/issues/480) | [P01](https://github.com/Ikey168/Modulo/issues/479) |
| [P03](https://github.com/Ikey168/Modulo/issues/481) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P02](https://github.com/Ikey168/Modulo/issues/480) |
| [P04](https://github.com/Ikey168/Modulo/issues/482) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P03](https://github.com/Ikey168/Modulo/issues/481) |
| [P05](https://github.com/Ikey168/Modulo/issues/483) | [P03](https://github.com/Ikey168/Modulo/issues/481), [P04](https://github.com/Ikey168/Modulo/issues/482) |
| [P06](https://github.com/Ikey168/Modulo/issues/484) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P03](https://github.com/Ikey168/Modulo/issues/481), [P04](https://github.com/Ikey168/Modulo/issues/482) |
| [P07](https://github.com/Ikey168/Modulo/issues/485) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P03](https://github.com/Ikey168/Modulo/issues/481), [P04](https://github.com/Ikey168/Modulo/issues/482) |
| [P08](https://github.com/Ikey168/Modulo/issues/486) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P03](https://github.com/Ikey168/Modulo/issues/481), [P04](https://github.com/Ikey168/Modulo/issues/482) |
| [P09](https://github.com/Ikey168/Modulo/issues/487) | [P02](https://github.com/Ikey168/Modulo/issues/480), [P03](https://github.com/Ikey168/Modulo/issues/481) |
| [P10](https://github.com/Ikey168/Modulo/issues/488) | [P03](https://github.com/Ikey168/Modulo/issues/481), [P09](https://github.com/Ikey168/Modulo/issues/487) |
| [P11](https://github.com/Ikey168/Modulo/issues/489) | [P02](https://github.com/Ikey168/Modulo/issues/480), [P03](https://github.com/Ikey168/Modulo/issues/481), [P09](https://github.com/Ikey168/Modulo/issues/487), [P10](https://github.com/Ikey168/Modulo/issues/488) |
| [P12](https://github.com/Ikey168/Modulo/issues/490) | [P09](https://github.com/Ikey168/Modulo/issues/487), [P10](https://github.com/Ikey168/Modulo/issues/488), [P11](https://github.com/Ikey168/Modulo/issues/489) |
| [P13](https://github.com/Ikey168/Modulo/issues/491) | [P05](https://github.com/Ikey168/Modulo/issues/483), [P06](https://github.com/Ikey168/Modulo/issues/484), [P07](https://github.com/Ikey168/Modulo/issues/485), [P08](https://github.com/Ikey168/Modulo/issues/486), [P11](https://github.com/Ikey168/Modulo/issues/489), [P12](https://github.com/Ikey168/Modulo/issues/490) |
| [P14](https://github.com/Ikey168/Modulo/issues/492) | [P07](https://github.com/Ikey168/Modulo/issues/485), [P11](https://github.com/Ikey168/Modulo/issues/489), [P12](https://github.com/Ikey168/Modulo/issues/490) |
| [P15](https://github.com/Ikey168/Modulo/issues/493) | [P03](https://github.com/Ikey168/Modulo/issues/481), [P10](https://github.com/Ikey168/Modulo/issues/488), [P11](https://github.com/Ikey168/Modulo/issues/489) |
| [P16](https://github.com/Ikey168/Modulo/issues/494) | [P03](https://github.com/Ikey168/Modulo/issues/481), [P09](https://github.com/Ikey168/Modulo/issues/487), [P10](https://github.com/Ikey168/Modulo/issues/488), [P11](https://github.com/Ikey168/Modulo/issues/489) |
| [P17](https://github.com/Ikey168/Modulo/issues/495) | [P10](https://github.com/Ikey168/Modulo/issues/488), [P11](https://github.com/Ikey168/Modulo/issues/489), [P15](https://github.com/Ikey168/Modulo/issues/493) |
| [P18](https://github.com/Ikey168/Modulo/issues/496) | [P05](https://github.com/Ikey168/Modulo/issues/483), [P06](https://github.com/Ikey168/Modulo/issues/484), [P07](https://github.com/Ikey168/Modulo/issues/485), [P08](https://github.com/Ikey168/Modulo/issues/486), [P09](https://github.com/Ikey168/Modulo/issues/487), [P10](https://github.com/Ikey168/Modulo/issues/488), [P15](https://github.com/Ikey168/Modulo/issues/493), [P16](https://github.com/Ikey168/Modulo/issues/494) |
| [P19](https://github.com/Ikey168/Modulo/issues/497) | [P01](https://github.com/Ikey168/Modulo/issues/479), [P03](https://github.com/Ikey168/Modulo/issues/481), [P09](https://github.com/Ikey168/Modulo/issues/487), [P11](https://github.com/Ikey168/Modulo/issues/489), [P12](https://github.com/Ikey168/Modulo/issues/490), [P13](https://github.com/Ikey168/Modulo/issues/491), [P14](https://github.com/Ikey168/Modulo/issues/492), [P17](https://github.com/Ikey168/Modulo/issues/495), [P18](https://github.com/Ikey168/Modulo/issues/496) |
| [P20](https://github.com/Ikey168/Modulo/issues/498) | [P09](https://github.com/Ikey168/Modulo/issues/487), [P10](https://github.com/Ikey168/Modulo/issues/488), [P13](https://github.com/Ikey168/Modulo/issues/491), [P14](https://github.com/Ikey168/Modulo/issues/492), [P15](https://github.com/Ikey168/Modulo/issues/493), [P16](https://github.com/Ikey168/Modulo/issues/494), [P17](https://github.com/Ikey168/Modulo/issues/495), [P18](https://github.com/Ikey168/Modulo/issues/496), [P19](https://github.com/Ikey168/Modulo/issues/497) |
