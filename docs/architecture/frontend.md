# Frontend

How the React application in [`frontend/`](../../frontend/) is put together:
the `@modulo/core` API that feature code depends on, the two plugin layers
(boot-time feature packs and user-installable workspace plugins), the lint rules
that hold the boundaries, and where platform differences live. It is for anyone
writing frontend code or a workspace plugin. Plugin authoring itself is covered in
[plugins.md](../features/plugins.md).

## Stack and layout

React 18 and TypeScript, built with Vite 6 and tested with Vitest and
Playwright. Styling is Tailwind with a vendored shadcn/ui library in `src/ui`.
Authentication uses `oidc-client-ts`; the Redux store holds only auth state
(`store/store.ts`). The same build runs in the browser, inside Electron
([`desktop/`](../../desktop/)), and inside the Capacitor Android shell
([`mobile/app/`](../../mobile/app/)).

| Path | Contents |
| --- | --- |
| `src/core/` | `@modulo/core`: the public API for feature code |
| `src/features/workspace/` | The workspace shell, its core views, the shared domain models and stores, the workspace plugin runtime (`plugins/`), the view kit (`viewkit/`), the phone layer (`mobile/`), and end-to-end crypto (`crypto/`) |
| `src/packs/<pack>/` | Domain pack code: one folder per plugin family (views, view-only helpers, plugin entry modules in `plugins/`, tests). See [Domain pack folders](#domain-pack-folders) |
| `src/features/blueprint/` | Blueprint editor and node catalog |
| `src/features/{auth,notes,knowledge,packs,approvals,executions,praxis,settings,...}` | Other feature areas |
| `src/features/noteWorkbench/`, `src/features/helloWorld/` | Boot-time feature packs |
| `src/platform/` | Platform detection and device capabilities (web, Electron, Android) |
| `src/services/` | Low-level clients: REST, STOMP, plugin state, offline caches, device bridges, legacy migration |
| `src/components/` | Shared UI (`common/`, `layout/`, `mobile/`) |
| `src/ui/` | Vendored shadcn/ui primitives (`@/ui`) |

Path aliases (in `vite.config.ts` and `tsconfig.json`): `@` → `src`,
`@components`, `@features`, `@store`, and `@modulo/core` → `src/core/index.ts`.

## Boot sequence and routing

[`appEntry.tsx`](../../frontend/src/appEntry.tsx) starts the Android lifecycle
hooks, registers and mounts the built-in feature packs, registers the service
worker (production web only; dev and Android actively unregister it), and
renders `<App />`.

- `helloWorldPack` always mounts. It is the minimal example of the pack contract.
- `noteWorkbenchPack` mounts unless `VITE_NOTE_WORKBENCH_ENABLED=false`. Without
  it, the app runs headless: auth, Blueprints and public share pages still work,
  and there is no `/app` UI. This is useful for integration and CI runs.
- A pack that fails to mount is logged and skipped; it never blocks rendering.

The note workbench contributes the `/app/:view` route (authenticated). Every
workspace view, including the Blueprint editor, marketplace and dashboard, is a
`:view` inside that shell. Other top-level routes: `/`, `/login`, `/home`,
`/about`, `/settings`, `/shared/:noteId`, `/auth/callback`,
`/auth/silent-callback`, and mobile OAuth callbacks. Legacy paths such as
`/notes`, `/blueprints` and `/dashboard` redirect into `/app/...`.

Runtime configuration comes from `window.__MODULO_CONFIG__`, loaded from
`/runtime-config.js` in container builds and set natively on Android
(`serverOrigin`); see [security-model.md](security-model.md#browser-login-oidc-authorization-code--pkce).

## `@modulo/core`

[`src/core/index.ts`](../../frontend/src/core/index.ts) is the only import path
feature code uses for notes, links, tags and graph data. It deliberately exports
no React, editor or graph-view types.

```ts
import { createCoreAPI, type CoreNote } from '@modulo/core';

const api = createCoreAPI();              // one instance per pack, held for its lifetime
await api.requestCapabilities(['notes:write']);
const notes: CoreNote[] = await api.notes();
const off = api.on('note.saved', (event) => { /* ... */ });
```

| Area | Members |
| --- | --- |
| Notes | `notes()`, `getNote(id)`, `searchNotes(q)`, `createNote(title, content, tags?)`, `updateNote(...)`, `deleteNote(id)` |
| Tags | `tags()`, `addTag(noteId, name)`, `removeTag(noteId, tagId)` |
| Links | `links()`, `outgoingLinks(id)`, `incomingLinks(id)`, `createLink(src, dst, type?)`, `removeLink(id)` |
| Graph | `graph()`, `filterGraphByTags(names)`, `neighbours(id)`, `subgraph(id, depth?)` |
| Events | `on(event, listener)` → unsubscribe; events `note.saved`, `note.deleted`, `link.created`, `link.removed`, `tag.added`, `tag.removed` |
| Blueprints | `listBlueprints()`, `invokeBlueprint(opts)` |
| Capabilities | `requestCapabilities(caps)`, `hasCapability(cap)`; capabilities `notes:write`, `ai:invoke`, `blockchain:anchor`, `code:execute` |
| Pure helpers | `buildGraph`, `filterGraphByTags`, `neighbours`, `subgraph` for data already fetched |
| Types | `CoreNote`, `CoreLink`, `CoreTag`, `GraphQueryResult`, `GraphNodeData`, `GraphEdgeData`, … |

`CoreAPIImpl` implements the interface on top of the workspace REST client and
emits events on the core event bus for mutations. Reads need no capability.
Client-side capability requests record intent for a consent UI; the backend
enforces grants independently.

The core types stay concrete (`note`, `link`, `tag`, `user`) by decision; see
[ADR 0002](decisions.md#adr-0002).

## Two plugin layers

| | Feature packs | Workspace plugins |
| --- | --- | --- |
| Contract | `FeaturePack` in [`core/featurePack.ts`](../../frontend/src/core/featurePack.ts) | `PluginManifest` / `PluginModule` in [`workspace/plugins/types.ts`](../../frontend/src/features/workspace/plugins/types.ts) |
| Granularity | Coarse app experiences, mounted at boot | User-installable views and panels inside the workspace |
| Registry | `FeatureRegistry` (`registerFeature`, `mountFeature`, `unmountFeature`); states `registered` → `mounted` → `unmounted` | `PluginRuntime` (install, uninstall, enable, disable) |
| Contributes | Routes, shell views, editor surfaces, commands | Workspace views, note panels, note fence renderers, editor actions, Blueprint nodes |
| Gets | A `ModuloCoreAPI` in `onMount` | A `PluginContext` with `state()` (plugin-state client) and `add*` registration methods |

### Feature packs

A pack declares an `id` (reverse-domain), `name`, `version`, required
`capabilities` and its contributions. `mountFeature(id)` creates a fresh
`CoreAPIImpl`, requests the declared capabilities, and calls `onMount(api)`.
Registering the same ID twice throws. The note workbench
([`noteWorkbenchPack.ts`](../../frontend/src/features/noteWorkbench/noteWorkbenchPack.ts))
lazy-loads the workspace so the pack file itself imports nothing outside
`@modulo/core` and React.

### Workspace plugins

The workspace plugin runtime
([`runtime.ts`](../../frontend/src/features/workspace/plugins/runtime.ts)) is the
user-facing layer: the marketplace catalog
([`catalog.ts`](../../frontend/src/features/workspace/plugins/catalog.ts)) lists
every bundled plugin with metadata, dependencies and a lazy `load()`.

- **Install** resolves dependencies, persists the installation record, then
  activates: lazy-loads the plugin chunk, runs `activate(ctx)`, and collects its
  contributions. **Uninstall** refuses while another installed plugin depends on
  it, then deactivates and disposes contributions. **Enable/disable** toggles
  activation without touching the install record.
- A plugin that is not installed is never loaded: its code never enters the page.
- Activation and rendering are fault-isolated (`PluginErrorBoundary`); a broken
  plugin cannot take down the host or other plugins.
- Installation records and hub tabs are host-owned plugin state
  (`workspace-settings` namespace, `modulo.workspace.installations` and
  `modulo.workspace.hub-tab` schemas). Plugins cannot grant themselves
  activation or permissions.
- Each plugin's `ctx.state()` client is bound to its manifest ID as namespace.
  This is an API boundary, not isolation: all bundled plugins run in the same
  origin. Untrusted code belongs in the EXTERNAL tier
  ([ADR 0004](decisions.md#adr-0004)).
- Views declare an optional `mode` (a domain such as `productivity`, `audit`,
  `music`); views with a mode are grouped under that domain's hub instead of the
  main sidebar. `parentViewId` folds a route into a parent's secondary sidebar.
- Plugins declare the device capabilities they need (`capabilities`), checked
  against the platform table below.

A contributed view receives `WorkspaceViewProps` (workspace data, selection,
edit mode, search, navigation, and all active contributions) inside an unpadded
`overflow-hidden` box. It draws itself with the **view kit**
([`viewkit/`](../../frontend/src/features/workspace/viewkit/)): `ViewShell`,
`Panel`, `Metric`, `Field`, `Choice`, `ConfirmDelete`, `RecordSheet`,
`StatusBadge`, `EmptyPanel` and the rest. Rules and rationale:
[ADR 0005](decisions.md#adr-0005) and [ADR 0006](decisions.md#adr-0006).
`viewkit/__tests__/houseStyle.test.ts` fails on raw `<select>`, raw palette
colours, `text-[11px]` and re-rolled scaffolds.

### Domain pack folders

The views of each domain pack live in `src/packs/<pack>/`, not in
`features/workspace/`. A pack folder holds the pack's views, helpers that only
that pack uses, its plugin entry modules (`plugins/*Plugin.tsx`, the files the
catalog lazy-loads) and their tests (`__tests__/`).

| Folder | Plugins |
| --- | --- |
| `audit-core` | Audit Core viewer (browser, overview, scope, threats, findings, tests, report, remediation) |
| `business-admin` | Business directory, contracts, reconciliation, obligations, operations, dashboard |
| `domain-collections` | Collection and dashboard plugins of the security, wealth, evidence, career, writing and mobility packs |
| `education` | Education core, curriculum, study planner, assignments, dashboard |
| `electronics` | Electronics projects, parts, lab, dashboard |
| `freelancer` | Rechnung, Zeiterfassung, EÜR, GoBD vault |
| `health-training` | Meal planner, workout planner |
| `hobbies` | Hobby stack, practice, fun, dashboard |
| `homelab` | Homelab assets, operations, dashboard |
| `life-os` | Life OS explorer, relations, review, portability, dashboard |
| `media` | Media library and the per-media-type plugins |
| `music` | Music projects, practice, library, dashboard |
| `paperless` | Paperless records and its write-back queue |
| `para` | Modified PARA (core, capture, tasks, goals, review, dashboard, migration) |
| `personal-life` | Finance subscriptions, health tracker, hobby studio, home inventory and maintenance, journal, personal CRM, places, travel, wishlist |
| `personal-sops` | Personal SOPs |
| `routines` | Routines & habits |
| `ttrpg` | TTRPG campaigns, world, sessions, dashboard |
| `wardrobe` | Wardrobe closet, style studio, dashboard |

What stays in `features/workspace/` is the shell and what several packs or the
shell share: the core views (notes, graph, planner, calendar, canvas, database,
dashboard, marketplace, …), the view kit, the plugin runtime and catalog, and
the domain models and stores (`para.ts`, `hobbies.ts`, `useHobbyStore.ts`, …).
The models stay shared because the planner, calendar, search index and
portable backup read every pack's records. A pack imports them from
`features/workspace/`; the catalog still lazy-loads each pack's entry modules
by path, so every pack remains its own chunk. Packs never import each other;
see [Pack boundary](#pack-boundary).

## Lint rules that hold the architecture

All of these are `error` in [`.eslintrc.cjs`](../../frontend/.eslintrc.cjs), and
`npm run lint` runs with `--max-warnings 0`.

<a id="boundary-lint"></a>
### Core boundary

`no-restricted-imports` blocks feature code from importing workspace internals:

| Blocked | Use instead |
| --- | --- |
| `**/features/workspace/workspaceApi` | `createCoreAPI()` |
| `**/features/workspace/types` | `CoreNote`, `CoreLink`, `CoreTag` |
| `**/features/workspace/useWorkspaceData` | `createCoreAPI()` |

`src/core/**` is exempt because it implements the API. The decision and audit
history are in [decisions.md](decisions.md#core-experience-boundary).

```sh
cd frontend
npm run lint:boundary       # list boundary violations only (always exits 0)
npm run lint:boundary:ci    # boundary rule only, via .eslintrc.boundary.cjs; exits 1 on any violation
```

CI runs `lint:boundary:ci` in the `boundary-lint` job of
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). The separate
boundary config ignores all other rules, so unrelated lint debt cannot mask or
fake a boundary failure.

<a id="pack-boundary"></a>
### Pack boundary

Code in `src/packs/<a>/` must not import from `src/packs/<b>/`. A pack may
import `@modulo/core`, `@/ui`, the view kit, plugin types, the shared modules in
`features/workspace/` and `services/`. Code that two packs need moves to one of
those shared places first.

The rule lives in [`.eslintrc.boundary.cjs`](../../frontend/.eslintrc.boundary.cjs),
and `.eslintrc.cjs` reuses it, so `npm run lint`, `lint:boundary:ci` and the
`boundary-lint` CI job all enforce it. The config reads the directories under
`src/packs/` at lint time and adds one `no-restricted-imports` override per
pack that forbids every other pack, so a new pack is covered without editing
the config. Each override repeats the core boundary patterns, because an
override replaces the rule's options rather than merging them.

`no-restricted-imports` checks `import` and `export … from` statements, including
type-only imports, in every spelling that reaches another pack (`../b/…`,
`../../b/…`, `@/packs/b/…`, `../../packs/b/…`). It does not check dynamic
`import()`; only the plugin catalog in `features/workspace/plugins/` lazy-loads
pack modules.

### No browser Storage

`no-restricted-globals`, `no-restricted-properties` and `no-restricted-syntax`
ban `localStorage`, `sessionStorage` and `Storage` in every form
(`window.localStorage`, `globalThis`, `self`, `document.defaultView`, …). Plugin
records, settings, drafts, recovery data and queues use plugin state or
`services/deviceDocuments` (IndexedDB/SQLite). Exempt: `src/services/legacy/**`
(the one-time legacy importer), `src/features/auth/**` and
`src/components/mobile/OAuthCallback.tsx` (OIDC protocol state), and tests.

### Electron bridge only through `@/platform`

`window.moduloDesktop` may be read only in `src/platform/**`,
`src/services/desktop.ts` and its type declaration.

## Platform layer

[`src/platform/`](../../frontend/src/platform/) detects the platform
(`web`, `electron`, `android`) and exposes one interface per device capability,
with a web and an Android implementation. Plugins never touch Capacitor or
Electron APIs directly.

| Capability | Web | Electron | Android |
| --- | --- | --- | --- |
| `files.pick`, `files.save`, `files.share`, `camera.capture`, `notifications.local`, `links.external` | yes | yes | yes |
| `remote.fetch`, `remote.metadata`, `pdf.tools` | via server `/api/remote` | yes | via server `/api/remote` |
| `reminders.scheduled` | only while the tab is open | yes | yes |
| `credentials.secure` | session only | yes | yes (Keystore) |
| `sync.background` | while the tab is open | yes | yes |
| `device.folders`, `documents.ocr` | no; upload as attachments | yes | no; system picker, attachments |
| `backup.archive` | JSON backup only | yes | JSON backup and share |

When a capability is missing, `CapabilityNotice` shows the documented
alternative. Hiding a view is not acceptable parity
([ADR 0009a](decisions.md#adr-0009a)). The phone layout
(`features/workspace/mobile`) switches on pointer type and viewport, not on
platform, so a tablet in landscape keeps the desktop split view.

## Services layer

| Service | Role |
| --- | --- |
| `api.ts`, `apiClient.ts`, `authenticatedRequest.ts` | Same-origin `/api` REST calls with bearer tokens (Android resolves against the configured server origin) |
| `websocket.ts`, `authenticatedStomp.ts`, `workspaceSocketUrl.ts` | STOMP client; subscribes to the owner's queues |
| `pluginStateClient.ts`, `pluginStateTransport.ts`, `workspaceStateHost.ts`, `stateMerge.ts` | Plugin-state client, IndexedDB persistence, replica locks, three-way merge |
| `offlineNotes.ts`, `offlineNoteCache.ts`, `workspaceOfflineNotes.ts` | Offline note cache and queued note edits |
| `deviceDocuments.ts` | Device-local documents (drafts, theme) |
| `legacy/` | Reads and imports pre-plugin-state `localStorage` data |
| `android*.ts`, `nativeStateCacheBridge.ts`, `secureStore.ts`, `nativeReminders.ts` | Capacitor bridges |
| `desktop.ts` | Electron bridge wrapper |
| `pluginService.ts`, `marketplaceService.ts` | Marketplace (app-shell concern, outside the core boundary) |

State, offline and conflict behavior is described in
[data-and-state.md](data-and-state.md#client-state-offline-and-sync).

## Desktop shell

The Electron app in [`desktop/`](../../desktop/) is a standalone package, not an
npm workspace. [`serve.js`](../../desktop/serve.js) serves the built
`frontend/dist` and proxies `/api` and `/ws` to a backend;
[`main.js`](../../desktop/main.js) is the main process; `native-services.js`
provides desktop-only capabilities (local folders, OCR, PDF tools) behind the
preload bridge. Details: [mobile-and-desktop.md](../features/mobile-and-desktop.md).

## Testing

```sh
cd frontend
npx vitest run                 # all unit tests
npx vitest run src/core/       # core API tests
npm run typecheck              # tsc --noEmit
npm run lint                   # full ESLint, zero warnings
npm run test:e2e               # Playwright
npm run phone:audit            # phone layout overflow audit (default and 2x font)
```

To mock the workspace API in Vitest, declare mocks with `vi.hoisted()` so they
exist before `vi.mock()` runs:

```ts
const { mockNotesApi } = vi.hoisted(() => ({ mockNotesApi: { list: vi.fn() } }));
vi.mock('../../features/workspace/workspaceApi', () => ({ notesApi: mockNotesApi }));
```

Setup and troubleshooting: [local-development.md](../getting-started/local-development.md).
