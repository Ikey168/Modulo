# B2 — Boundary Audit: Core / Experience Violations

**Issue:** #295  
**Branch:** `claude/issues-295`  
**Date:** 2026-06-27  
**Status:** Audit complete. ESLint guard active. Fixes tracked in B4–B7.

## How to regenerate

```sh
cd frontend
npm run lint:boundary
```

The `lint:boundary` script runs ESLint with only the `no-restricted-imports` rule
so the output is purely boundary violations, with no noise from other rules.

---

## Violation inventory

Violations are grouped by the four modules named in the issue acceptance criteria.
Each entry records the file, the offending import, which core API method covers it,
and which B0 sub-issue will fix it.

### A. Editor module (`features/notes/editor/`)

| # | Status |
|---|--------|
| Violations | **0** |

The editor module is self-contained. `AttachmentPanel`, `SlashCommandMenu`,
`TemplateManager`, and `ExportButton` each use their own internal APIs
(`templateApi`, `exportApi`, `attachmentApi`). No workspace internals are
imported. ✓ Clean.

---

### B. Link parser / link manager (`features/notes/NoteLinkManager.tsx`)

| # | File | Violating import | Bypasses | CoreAPI coverage | Fix in |
|---|------|-----------------|----------|-----------------|--------|
| V1 | `src/features/notes/NoteLinkManager.tsx:2` | `import { api } from '../../services/api'` | REST client directly (`/note-links/*`) | `api.links()`, `api.createLink()`, `api.removeLink()` | **B5** (#298) |

**Detail:** The component calls `GET /note-links/note/:id/outgoing`, `GET /note-links/note/:id/incoming`, `POST /note-links`, and `DELETE /note-links/:id` through the raw `api` fetch wrapper. It also re-declares `Note` and `NoteLink` interfaces that duplicate `CoreNote` and `CoreLink`.

**Note:** `components/common/NoteLinkManager.tsx` is a separate copy in the shared
component tree — it does _not_ import from `services/api` (it receives data via
props) so it is not a boundary violation.

---

### C. Graph view (`features/notes/NotesGraph.tsx`, `features/workspace/GraphView.tsx`)

| # | File | Violating import | Bypasses | CoreAPI coverage | Fix in |
|---|------|-----------------|----------|-----------------|--------|
| V2 | `src/features/notes/NotesGraph.tsx:5` | `import { api } from '../../services/api'` | REST client directly (`/notes`, `/note-links`) | `api.graph()` | **B6** (#299) |
| V3 | `src/features/workspace/GraphView.tsx:13` | `import { …type NormalizedLink, type WorkspaceNote } from './types'` | Workspace domain types | `CoreNote`, `CoreLink` from `@modulo/core` | **B6** (#299) |

**Detail for V2:** `NotesGraph` fetches `GET /notes` and then per-note
`GET /note-links/note/:id/all` in a loop — an O(n) chattiness pattern that
`CoreAPIImpl.graph()` consolidates into two parallel requests and builds a
`GraphQueryResult` client-side with `buildGraph()`.

**Detail for V3:** `GraphView` (the D3 variant) types its node/link data as
`WorkspaceNote` and `NormalizedLink`. After B6 it will accept `CoreNote` and
`CoreLink` and call the `CoreAPIImpl` for data.

---

### D. Marketplace (`features/plugins/`, `features/workspace/MarketplaceView.tsx`)

| # | Status |
|---|--------|
| Core-data violations | **0** |

`PluginManager`, `PluginInstaller`, `FeaturedPlugins`, `PluginMarketplace`, and
`PluginMarketCard` all import from `../../services/pluginService` and
`../../services/marketplaceService`. These are _marketplace-specific_ services,
not note/graph core internals. They are **app-shell concerns** (B0 non-goal
scope) and are explicitly excluded from the core/experience boundary (see B0
definition, issue #293).

`MarketplaceView.tsx` imports only from `./plugins` (local plugin list) and
`../blueprint/pack/PackMarketplace`. Both are legitimate pack-layer imports.
✓ Clean for the boundary definition used in B2.

---

### E. App-shell / workspace route (`features/workspace/`)

**Status: V4–V7 fixed in B4 (#297).** V8 remains open for B6 (#299).

| # | File | Violating import | CoreAPI coverage | Fix in | Status |
|---|------|-----------------|-----------------|--------|--------|
| V4 | `src/features/workspace/NotesView.tsx:4` | `import { …type WorkspaceNote } from './types'` | `CoreNote` from `@modulo/core` | **B4** (#297) | ✅ Fixed |
| V5 | `src/features/workspace/NotesView.tsx:5` | `import type { WorkspaceData } from './useWorkspaceData'` | `createCoreAPI()` | **B4** (#297) | ✅ Fixed |
| V6 | `src/features/workspace/Workspace.tsx:10` | `import { useWorkspaceData } from './useWorkspaceData'` | `createCoreAPI()` | **B4** (#297) | ✅ Fixed |
| V7 | `src/features/workspace/useWorkspaceData.ts:2` | `import { notesApi, tagsApi, linksApi } from './workspaceApi'` | `CoreAPIImpl` internals | **B4** (#297) | ✅ Fixed |
| V8 | `src/features/workspace/GraphView.tsx:13` _(types only)_ | `import { isAnchored, relativeTime, type WorkspaceNote } from './types'` | `CoreNote`, utilities | **B6** (#299) | ⏳ Open |

**B4 changes:** `useCoreWorkspace.ts` replaces `useWorkspaceData.ts` as the
workspace data hook, delegating all note/tag/link I/O to `createCoreAPI()`.
`NotesView`, `DashboardView`, and `Markdown` now use `CoreNote`/`CoreTag`/`CoreLink`
from `@modulo/core`. Blockchain anchoring calls the REST endpoint directly (not
through workspaceApi) since it is outside the core note-data contract.
`DashboardView.tsx` was also fixed (same pattern as V4).

---

## ESLint guard

`frontend/.eslintrc.cjs` enforces the boundary with `no-restricted-imports`
(currently `warn`; escalated to `error` in B9 #302):

```text
Blocked patterns                          Message
─────────────────────────────────────────────────────────────────────────
**/features/workspace/workspaceApi        Use @modulo/core instead (B1 #294)
**/features/workspace/types               Use CoreNote/CoreLink from @modulo/core
**/features/workspace/useWorkspaceData    Use createCoreAPI() from @modulo/core
```

`src/core/**` is exempted — that directory is the `@modulo/core` implementation
and legitimately imports from `workspaceApi`.

**Why `warn` not `error` now:** Violations V4–V8 are in `workspace/` itself and
are necessary until B4 and B6 land. Setting the rule to `error` immediately would
block `npm run lint`. B9 will flip it to `error` once the violations are gone.

---

## B1 gap analysis

All violations map to existing `ModuloCoreAPI` methods (`#294`). No new API
methods are required:

| Access pattern | CoreAPI method |
|----------------|---------------|
| `GET /notes` | `api.notes()` |
| `GET /note-links` (all) | `api.links()` |
| `GET /note-links/note/:id/outgoing` | `api.links()` + client filter |
| `GET /note-links/note/:id/incoming` | `api.links()` + client filter |
| `POST /note-links` | `api.createLink()` |
| `DELETE /note-links/:id` | `api.removeLink()` |
| Graph (notes + links together) | `api.graph()` |
| `WorkspaceNote` type | `CoreNote` |
| `NormalizedLink` type | `CoreLink` |
| `WorkspaceTag` type | `CoreTag` |

**No gaps filed against B1.** The audit closes with full coverage.

---

## Fix roadmap

| Sub-issue | Covers | Violations |
|-----------|--------|-----------|
| B4 (#297) | Wire workspace route to CoreAPIImpl | V4, V5, V6, V7, V8 (partial) |
| B5 (#298) | Wire link parser to CoreAPIImpl | V1 |
| B6 (#299) | Wire graph views to CoreAPIImpl | V2, V3, V8 |
| B9 (#302) | Flip lint rule to `error`, add CI gate | All (enforcement) |
