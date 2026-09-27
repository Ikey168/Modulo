# Architecture decisions

This is Modulo's decision log. Each entry condenses one architecture decision
record (ADR): the context, the decision, its consequences, and where it lives in
the code. Read it before proposing a change that touches one of these areas.
Accepted decisions are binding until a new entry supersedes them.

**Numbering.** Entries keep their original ADR numbers. Two ADRs were
originally both numbered 0009; they are recorded here as **0009a** (Android
shared frontend) and **0009b** (run-bound human approval). The core/experience
boundary outcome of the B2 audit is recorded as its own entry,
[B2](#core-experience-boundary). Every entry has a stable anchor
(`#adr-0001` … `#adr-0009b`, `#core-experience-boundary`) that code comments
may link to.

**Adding a decision.** Append a new entry with the next free number, an
explicit anchor, and the same five parts. To reverse a decision, add a new entry
that names the one it supersedes and change the old entry's status to
"Superseded by …". Do not rewrite an accepted entry's decision in place.

| ID | Decision | Status |
| --- | --- | --- |
| [0001](#adr-0001) | Signature-derived X25519 keys for encrypted sharing | Accepted |
| [0002](#adr-0002) | The core keeps first-class `note`/`link`/`tag`/`user` types | Accepted |
| [B2](#core-experience-boundary) | Feature packs reach core data only through `@modulo/core` | Accepted, enforced in CI |
| [0003](#adr-0003) | `action.wasm.execute` module contract, ABI and trust model | Accepted |
| [0004](#adr-0004) | External plugin tier: third-party code runs as separate workloads | Accepted |
| [0005](#adr-0005) | A workspace view kit between `@/ui` and plugin screens | Accepted |
| [0006](#adr-0006) | Shared workspace behavior (dates, editing, fields) | Accepted; persistence section superseded |
| [0007](#adr-0007) | Workspace saving, recovery and navigation | Implemented; recovery journal retired |
| [0008](#adr-0008) | Namespaced, versioned plugin state in PostgreSQL | Accepted; implemented with revised limits |
| [0009a](#adr-0009a) | One shared frontend packaged for Android with Capacitor | Accepted |
| [0009b](#adr-0009b) | Run-bound human approval contract | Accepted, implemented |

---

<a id="adr-0001"></a>
## 0001 — Signature-derived X25519 keys for encrypted sharing

**Status:** Accepted.

**Context.** Sharing an encrypted note means wrapping its per-note AES-256-GCM
key so that only the recipient can unwrap it. That needs an asymmetric
*encryption* keypair per user. Ethereum wallet keys are secp256k1 *signing*
keys. Two options were considered:

- MetaMask's `eth_getEncryptionPublicKey` / `eth_decrypt`. The private key never
  leaves the wallet, but both RPCs are deprecated by MetaMask and are effectively
  MetaMask-only (no hardware wallets, WalletConnect or most other wallets).
- Derive an X25519 keypair from a wallet signature over a fixed, versioned
  message. Works with any wallet that supports `personal_sign`, uses no
  deprecated RPC, and keeps the wrapped blob format-compatible with MetaMask's
  `x25519-xsalsa20-poly1305` sealed box. The cost is that the X25519 secret
  exists in app memory during a session.

**Decision.** Derive the keypair from a signature. The user signs
`ENCRYPTION_KEY_MESSAGE`; the signature is hashed with SHA-512 and truncated to
32 bytes to form the X25519 secret scalar. The public key is publishable; the
secret is re-derived on demand and never stored server-side.

**Consequences.**

- The signing message is versioned (`v1`). Changing it rotates every user's
  derived keypair, so a change must be deliberate and come with a migration.
- Re-derivation depends on the wallet producing the **same signature** for the
  same message. This holds for MetaMask and other RFC 6979 deterministic-ECDSA
  wallets. A wallet with non-deterministic nonces would derive a different key
  each session and could not open previously shared notes. If such a wallet must
  be supported, derive once and persist the keypair locally (for example in
  IndexedDB) instead of re-deriving.
- Revocation is cryptographic (re-encrypt under a new key, re-wrap for the
  remaining recipients); see [security-model.md](security-model.md#encrypted-note-sharing).

**Code.** [`recipientKeys.ts`](../../frontend/src/features/workspace/crypto/recipientKeys.ts)
(`deriveEncryptionKeyPair`, `deriveEncryptionKeyPairFromWallet`,
`wrapKeyForRecipient`, `unwrapKey`, on `tweetnacl`);
[`keyRotation.ts`](../../frontend/src/features/workspace/crypto/keyRotation.ts)
(`reEncryptAndRewrap`).

---

<a id="adr-0002"></a>
## 0002 — The core keeps first-class `note`/`link`/`tag`/`user` types

**Status:** Accepted. Non-goal guard for the core/experience boundary work.

**Context.** Once the note experience was routed through a public core API as a
feature pack, the obvious next temptation is to "finish the job": turn the core
into a typeless property graph where `note`, `link`, `tag` and `user` are
plugin-registered entity types, and move the node catalog's type system into
plugins. That looks cleaner but removes load-bearing concreteness:

- The seed Blueprint nodes (`trigger.note.saved`, `action.note.create`,
  `action.tag.add`) mean something only because `note` and `tag` are types the
  interpreter and the capability model understand.
- The graph store, event bus and capability enforcement reason about concrete
  entities. A domainless `(node, edge, property)` graph pushes that semantics into
  plugins, where it cannot be enforced consistently.
- "PKM" in Modulo is concretely the note-workbench feature pack plus the seed
  node pack. Dissolving the entity types dissolves that definition.

The boundary work is about *where the note experience lives* (pack or core), not
about making the core domain-agnostic.

**Decision.**

1. `note`, `link`, `tag` and `user` stay defined in the core, not registered by
   plugins.
2. The node catalog's built-in type system stays in the engine.
3. The core is not generalized into a typeless property graph.

Adding new node descriptors or capabilities through the documented extension
points is unaffected and encouraged.

**Consequences.**

- The public types feature packs consume (`CoreNote`, `CoreLink`, `CoreTag`,
  `GraphQueryResult`) are deliberately concrete.
- A PR that moves these types into plugins, or collapses the catalog into a
  generic property graph, is rejected and pointed here. Reopening requires a new
  superseding entry **and** a second concrete consumer that genuinely needs the
  generalization.
- Physically extracting the note experience into its own npm package is a
  separate non-goal: plugin-*ready*, not plugin-*ized*, until a second consumer
  exists.

**Code.** [`frontend/src/core/types.ts`](../../frontend/src/core/types.ts),
[`ModuloCoreAPI.ts`](../../frontend/src/core/ModuloCoreAPI.ts),
[`nodeCatalog.ts`](../../frontend/src/features/blueprint/nodeCatalog.ts),
[`BlueprintCapabilityService.java`](../../backend/src/main/java/com/modulo/blueprint/BlueprintCapabilityService.java).

---

<a id="core-experience-boundary"></a>
## B2 — Feature packs reach core data only through `@modulo/core`

**Status:** Accepted. All recorded violations fixed; enforced as an ESLint
`error` and a dedicated CI job.

**Context.** Feature code (the notes editor, link manager, graph views, the
workspace route) imported workspace internals directly: the REST client in
`services/api`, `features/workspace/workspaceApi`, the workspace domain types,
and the `useWorkspaceData` hook. That made it impossible to tell the core data
contract apart from one experience's implementation details. The B2 audit
inventoried every such import in four areas (editor, link manager, graph views,
marketplace/app shell) and mapped each to an existing `ModuloCoreAPI` method.

Audit findings that shaped the rule:

- Every violating access pattern already had a core API equivalent (`notes()`,
  `links()`, `createLink()`, `removeLink()`, `graph()`, and the `CoreNote` /
  `CoreLink` / `CoreTag` types), so no new core methods were needed.
- The editor module was already clean.
- Marketplace and plugin-install code talks to marketplace-specific services
  (`pluginService`, `marketplaceService`). Those are app-shell concerns, outside
  the note/graph core, and are deliberately not covered by the rule.

**Decision.** Feature-pack code imports note, link, tag and graph data only via
`@modulo/core` (`createCoreAPI()` and the exported types). It must not import:

| Blocked module | Use instead |
| --- | --- |
| `**/features/workspace/workspaceApi` | `createCoreAPI()` from `@modulo/core` |
| `**/features/workspace/types` | `CoreNote` / `CoreLink` / `CoreTag` from `@modulo/core` |
| `**/features/workspace/useWorkspaceData` | `createCoreAPI()` (the workspace hook is now `useCoreWorkspace`) |

`src/core/**` is exempt because it is the implementation of `@modulo/core`.

**Consequences.**

- The workspace route, link manager and graph views were rewired onto the core
  API. A side effect in the graph view: the per-note serial link fetch was replaced
  by two parallel calls (`notes()` + `links()`).
- `createLink()` / `removeLink()` emit `link.created` / `link.removed` on the core
  event bus, so consumers no longer wire events by hand.
- The rule is `error` in the main ESLint config, and a boundary-only config lets CI
  check it independently of unrelated lint debt. See
  [frontend.md](frontend.md#boundary-lint) for commands.
- [0002](#adr-0002) is the rationale: the boundary protects a concrete, typed
  core behind a public API. It is not a step toward a generic graph.

**Code.** [`frontend/.eslintrc.cjs`](../../frontend/.eslintrc.cjs),
[`frontend/.eslintrc.boundary.cjs`](../../frontend/.eslintrc.boundary.cjs),
the `boundary-lint` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml),
[`frontend/src/core/index.ts`](../../frontend/src/core/index.ts).

---

<a id="adr-0003"></a>
## 0003 — `action.wasm.execute` module contract, ABI and trust model

**Status:** Accepted.

**Context.** `action.code.execute` runs user JavaScript in a QuickJS-on-WASM
sandbox. A second node, `action.wasm.execute`, accepts a compiled WebAssembly
module directly, so nodes can be written in Rust, AssemblyScript, Go/TinyGo or
anything else that emits core WASM. The contract had to be something every
mainstream toolchain can target today, mechanically validatable, no more
privileged than `action.code.execute`, and independent of the external plugin
tier ([0004](#adr-0004)).

**Decision.**

- **ABI: raw core WASM, no component model.** A module exports exactly
  `memory`, `alloc(i32 size) -> i32 ptr`, and
  `execute(i32 in_ptr, i32 in_len) -> i64`. The `i64` packs the result as
  `(ptr << 32) | len`. The host copies the result out and discards the instance,
  so modules never need `dealloc`.
- **Envelope.** Input is UTF-8 JSON `{"v": 1, "note": {"title", "content"}}`,
  evolved additively; a breaking change arrives as a new export (`execute_v2`),
  never a mutation. Output is raw UTF-8 text on the node's `output` pin,
  truncated at 64 KiB.
- **Imports: none.** A module declaring any import, WASI included, is rejected at
  validation with an error naming the import. (AssemblyScript needs
  `--use abort=` to drop `env.abort`; Rust `wasm32-unknown-unknown` with
  `panic = "abort"` is import-free.)
- **Limits.** Declared memory maximum ≤ 512 pages (32 MiB); modules with no
  maximum are rejected. Each run uses a fresh instance, a 2 s wall-clock budget
  and a 64 KiB output cap. User modules run in the Chicory interpreter (not AOT)
  so execution stays abortable.
- **Delivery.** The module is stored base64 in the node's `config.module`
  (display name in `config.moduleName`), capped at 512 KiB binary. The backend
  records the module's SHA-256, and the editor shows it.
- **Trust.** Modules are untrusted by construction. Authorization is the
  `wasm:execute` capability, granted and checked like `code:execute`. No
  signature or provenance checks in v1: the module has zero privileges.

Rejected: the component model/WIT (toolchain maturity), WASI with a virtualized
world (a permanent extra attack surface), a stdout marker channel (pointless
when the ABI is ours), artifact upload storage in v1 (no need yet), and reusing
the Endive runtime (the canonical `com.dylibso.chicory` artifacts were chosen).

**Consequences.**

- Validation is fully mechanical: magic bytes → parse → imports empty → exports
  present → memory max ≤ 512 pages → size ≤ 512 KiB.
- The 512 KiB inline cap is the first limit a real Go/TinyGo module will hit. The
  designated relief is content-addressed artifact storage (upload once, reference
  by digest), which changes `config`, not the ABI. Do not "temporarily" raise the
  cap instead.
- CPU metering slotted into the same seam without touching the ABI: the executor
  also enforces an instruction budget of 200,000,000 interpreted instructions
  (`WasmNodeExecutor.MAX_FUEL`) alongside the 2 s wall clock.

**Code.** [`WasmModuleValidator.java`](../../backend/src/main/java/com/modulo/blueprint/wasm/WasmModuleValidator.java),
[`WasmNodeExecutor.java`](../../backend/src/main/java/com/modulo/blueprint/wasm/WasmNodeExecutor.java),
capability entry in [`BlueprintNodeRegistry.java`](../../backend/src/main/java/com/modulo/blueprint/BlueprintNodeRegistry.java),
reference modules in [`examples/wasm-nodes/`](../../examples/wasm-nodes/).
Full ABI reference: [wasm-node-abi.md](../reference/wasm-node-abi.md).

---

<a id="adr-0004"></a>
## 0004 — External plugin tier: third-party code runs as separate workloads

**Status:** Accepted.

**Context.** `PluginType.EXTERNAL` existed but did nothing. `PluginManager` and
`PluginLoader` loaded JARs into the core JVM; `RemotePluginLoader` downloaded
JARs but still ran them in-process. The core already ran a gRPC server, but
nothing dialled out, and `PluginEventBus` was JVM-only. The submission pipeline
and `PluginSecurityManager` assumed third-party JARs would run in-process, which
is exactly what this decision forbids. Constraints: third-party code must never
share the core JVM, the Raspberry Pi/minimal path must work with zero extra
services, and existing pieces (gRPC contract, the registry's `endpoint` column,
the per-service Helm/ArgoCD pattern) should be reused.

**Decision.**

1. **Three tiers.** *Core* (notes, tags, graph, auth, Blueprint interpreter; one
   deployable). *INTERNAL plugins*: first-party, trusted, in-process, unchanged.
   *EXTERNAL plugins*: separate workloads with their own image, Deployment,
   ServiceAccount, NetworkPolicy and resource limits, speaking the versioned gRPC
   contract. Third-party and marketplace code goes here by policy, never
   in-process.
2. **Trust boundary is the pod**, not JAR scanning: dedicated ServiceAccount,
   deny-by-default NetworkPolicy (ingress from core only; egress to core gRPC and
   the broker only), CPU/memory limits, read-only root filesystem, non-root user.
   The posture is baked into the reusable chart, not opted into per plugin.
3. **Wire contract.** The existing protos are the v1 contract, published as the
   standalone `plugin-contract` Maven module and evolved additively only. Added
   pieces: event delivery (server-streaming subscribe + publish), a core→plugin
   lifecycle client, and per-call permission gating on the host callback surface
   backed by persisted `plugin_permissions`. REST was rejected for the control
   plane (verb-rich, streaming-shaped, and gRPC already existed). mTLS is delegated
   to the mesh/NetworkPolicy layer in v1.
4. **Eventing: NATS bridge, off by default.** NATS was chosen over Kafka and
   RabbitMQ on footprint (a single small binary with an arm64 image) and fit
   (pub/sub fan-out of small JSON events). Delivery is at-most-once, like the
   in-JVM bus. The bridge republishes in-JVM events to `modulo.events.<type>`
   subjects and injects broker messages back, tagging origin so bridged events
   never re-bridge. NATS JetStream is the recorded path if durable delivery is
   ever required.
5. **Degradation.** With the broker flag off, the core behaves as if the tier
   did not exist. With it on and NATS unreachable, the core logs and degrades;
   the in-JVM publish path never blocks. A down external plugin is marked
   unhealthy by health polling; the core never blocks on it. Components with an
   in-process fallback route back automatically.
6. **Pilot.** Sandboxed script execution was extracted first: it runs untrusted
   code, sits behind the one-method `ScriptSandbox` seam, and gains most from pod
   isolation. The core routes to it when healthy and falls back in-process
   otherwise.

Non-goals: rewriting INTERNAL plugins, changing the browser-side workspace
plugin runtime, automated deploy-on-approve for marketplace submissions, durable
delivery, mTLS management, and SDKs beyond the published stubs.

Rejected: hardening the in-JVM sandbox (the SecurityManager is deprecated, JAR
scanning is heuristic, and one escape owns the core), a REST control plane, Kafka
or RabbitMQ, and sidecar-per-plugin (couples plugin lifecycle to core rollouts).

**Consequences.** The backend has its first outbound gRPC client and an
optional broker dependency. Plugin authors depend on `plugin-contract` without
the core. JAR submission is a policy violation for third-party code; submissions
are image references. `argocd/apps/plugins/` and the `helm/plugin` chart are the
standing pattern for plugin workloads.

**Code.** [`plugin-contract/`](../../plugin-contract/) (generates from
[`backend/src/main/proto/`](../../backend/src/main/proto/)),
[`PluginEventBridge.java`](../../backend/src/main/java/com/modulo/plugin/event/PluginEventBridge.java)
(`modulo.plugins.broker.enabled`, default `false`),
[`ExternalPluginHealthMonitor.java`](../../backend/src/main/java/com/modulo/plugin/manager/ExternalPluginHealthMonitor.java),
[`RemoteScriptSandbox.java`](../../backend/src/main/java/com/modulo/blueprint/sandbox/RemoteScriptSandbox.java),
[`services/script-sandbox-plugin/`](../../services/script-sandbox-plugin/),
[`helm/plugin/`](../../helm/plugin/). Operating guide: [plugins.md](../features/plugins.md).

---

<a id="adr-0005"></a>
## 0005 — A workspace view kit between `@/ui` and plugin screens

**Status:** Accepted.

**Context.** `src/ui` is a vendored shadcn/ui library. The workspace host gives a
contributed view an unpadded `overflow-hidden` box; page chrome (scroll
container, header, toolbar, padding, loading and empty states) was each view's
job, and no primitive composed it. An audit of `src/features/workspace/` found
the same components re-rolled many times (`Metric` 14×, `Panel` 12×, `Field` and
`Empty` 11× each, `Health` 10×, `Choice` 9×, `Shell` 8×) with drifting props and
styles, and a `SELECT` class string re-declared in sixteen files. Missing
primitives also meant missing behavior: deletes (including cascading ones) fired
on one click; tabular data was drawn with flex rows; most collections had no edit
path; editing, where it existed, was an always-live form; status colours used raw
palette classes, and one regex rendered "Invalid" green.

**Decision.** Add `src/features/workspace/viewkit`, one layer between `@/ui` and
the screens, owning page chrome, record presentation and the shared interaction
patterns: `ViewShell`, `ViewColumns`, `Panel`, `Metric`/`MetricRow`,
`Field`, `Choice`/`ChoiceInline`, `ConfirmDelete`,
`Toolbar`/`SearchInput`/`FilterChips`, `StatusBadge`/`statusVariant`, `LinkOut`,
`EmptyPanel`, `ListRow`/`ListRows`, `RecordCard`/`CardGrid`,
`RecordSheet`/`Fact`/`FactGrid`, `HealthLine`/`HealthList`. Three encode rules:

- `ConfirmDelete` requires `itemName` and takes a `consequence`, so a cascading
  delete says what it removes and the trigger has an accessible name.
- `Field` requires a visible `label` and wires `htmlFor`.
- `RecordSheet` separates read from edit: facts by default, an editor behind an
  explicit Edit button, working on a draft that is saved only on Save.

`statusVariant` matches whole statuses against explicit sets, never substrings or
regexes.

**Consequences.**

- Screens compose the kit. A local `Card` shadowing `@/ui`'s is always a bug.
- `viewkit/__tests__/houseStyle.test.ts` enforces the conventions: no raw
  `<select>`, no re-declared `SELECT` constant, no raw palette classes, no
  `text-[11px]`, no re-rolled scaffold. Its exemption list may only shrink.
- Categorical palettes stay legitimate where colour encodes a category rather
  than status (the six day-block tints in the planner and calendar).
- The plugin contract (`WorkspaceViewProps`, view registration, error isolation)
  is unchanged; the kit is only how a view draws itself.

**Code.** [`viewkit/index.ts`](../../frontend/src/features/workspace/viewkit/index.ts),
[`viewkit/MIGRATION.md`](../../frontend/src/features/workspace/viewkit/MIGRATION.md),
[`houseStyle.test.ts`](../../frontend/src/features/workspace/viewkit/__tests__/houseStyle.test.ts).

---

<a id="adr-0006"></a>
## 0006 — Shared workspace behavior

**Status:** Accepted. The "local persistence" part is superseded by
[0008](#adr-0008) and the storage rule in [0009a](#adr-0009a): workspace
stores are now server-backed plugin state, and browser `localStorage` is banned
outside the legacy migration module.

**Context.** Workspace screens disagreed on date handling, editing flow, form
labelling and keyboard behavior.

**Decision.**

- **Dates.** `dayKey(date)` (in `noteDates`) is the user's local calendar day;
  planner and PARA helpers delegate to it. Instants (creation, sync, audit) stay
  full UTC ISO timestamps. Date-only arithmetic stays in `addDays`/`weekOf`, which
  use UTC internally so daylight-saving changes cannot add or lose a day.
- **Failed saves are not edits.** A failed save leaves the editor open with the
  draft intact and shows a failed-save notice until the store saves.
- **Editing.** Record sheets and collections show a read view first, with explicit
  Edit, Save changes and Cancel. New records are drafts until saved; Cancel does
  not persist. Async saves are awaited and duplicate submission is disabled;
  callbacks report failure by returning `false` or rejecting.
- **Keyboard.** Ctrl/Cmd+Enter submits the active record editor; Enter in a
  multiline input still inserts a newline. Global canvas and review shortcuts
  ignore form controls, dialogs, handled events, key repeats and IME composition.
- **Fields and empty states.** `Field` links its label to an existing or generated
  control ID and keeps existing descriptions when adding a hint. `SearchInput`
  has a clear button and Escape-to-clear. `EmptyPanel.onReset` is the one "Clear
  filters" action: empty collections offer creation, filtered-empty lists offer
  reset.

**Consequences.** `workspaceConsistency.test.tsx` exercises these contracts,
including local-day boundaries; run its calendar tests in both positive and
negative UTC offsets.

**Code.** [`noteDates.ts`](../../frontend/src/features/workspace/noteDates.ts),
[`viewkit/Field.tsx`](../../frontend/src/features/workspace/viewkit/Field.tsx),
[`workspaceConsistency.test.tsx`](../../frontend/src/features/workspace/__tests__/workspaceConsistency.test.tsx).

---

<a id="adr-0007"></a>
## 0007 — Workspace saving, recovery and navigation

**Status:** Implemented. The device-local recovery journal described in the
original record is retired: every store is server-backed, nothing writes the
journal, and its old entries are readable only for export.

**Context.** Note edits could be lost on navigation, failed requests or
concurrent edits, and there was no way back from an accidental change.

**Decision.**

- **Note saving.** The editor keeps a local draft and debounces remote saves by
  900 ms. One queue per note survives navigation. A completed request
  acknowledges only the text it submitted; edits made during the request are sent
  afterwards. The editor shows Saved / Unsaved / Saving / Save failed with Retry.
  Reconnecting retries outstanding drafts, and leaving with unconfirmed changes
  triggers the browser's unsaved-work prompt.
- **Revisions and Trash.** Up to 100 previous versions per note are kept and can
  be restored through the normal update path. Moving a note to Trash hides it
  without deleting the server note or its links; Restore brings both back.
  Revisions and Trash now live in server-backed plugin state.
- **Navigation.** Ctrl/Cmd+K opens a command palette over notes, indexed records
  and installed views, with quick capture (its text survives failures and
  reloads). Notes are addressable as `?note=<id>`, specialist records as
  `?record=<encoded entity UID>`. These URLs work only where the destination
  workspace holds the data; they do not make private records public.
- **Portable restore.** Schema v1 exports stay readable. New exports include
  original note IDs, tags, explicit links, Trash state and hierarchy; unsaved
  drafts take precedence over server text. Restore validates shapes and
  references before creating anything, reuses matching notes, and remaps imported
  IDs in structured fields, relationship UIDs, links and hierarchy (never in
  prose). Old exports without original IDs are rejected when they contain
  references that would need remapping, instead of linking to an unrelated note.

**Consequences.** Remote note, tag and link creation during restore is not a
server transaction: a failure can leave partially imported objects, and a retry
reuses them. Restore defaults to filling in missing stores; replacement is an
explicit choice.

**Code.** [`noteDrafts.ts`](../../frontend/src/features/workspace/noteDrafts.ts),
[`noteRevisionsStore.ts`](../../frontend/src/features/workspace/noteRevisionsStore.ts),
[`WorkspaceRecoveryView.tsx`](../../frontend/src/features/workspace/WorkspaceRecoveryView.tsx),
[`WorkspaceCommandPalette.tsx`](../../frontend/src/features/workspace/WorkspaceCommandPalette.tsx),
[`workspaceRecovery.ts`](../../frontend/src/features/workspace/workspaceRecovery.ts).

---

<a id="adr-0008"></a>
## 0008 — Namespaced, versioned plugin state in PostgreSQL

**Status:** Accepted and implemented. The per-namespace and per-owner quota
defaults were raised during implementation (see Consequences).

**Context.** Workspace plugins kept their data in browser storage: one device,
no backup, no sharing across clients, and no server-side authorization.
Plugins needed a small, durable document store that is safe to expose to both
browser plugins and external workloads.

**Decision.**

- **Storage.** One PostgreSQL JSONB record per
  `(owner_id, workspace_id, namespace, state_key)`, with `schema_id`,
  `schema_version`, a monotonically increasing `version`, and a tombstone flag.
  Versions never reset across delete and recreate, which prevents ABA overwrites.
  JSON `null` is a valid live value, distinct from an absent key or a tombstone.
- **Identity.** The owner comes from the authenticated principal, never from
  JSON, URL parameters, plugin metadata or display names. The namespace is the
  installed plugin ID and cannot be chosen independently of the caller's
  authenticated plugin identity. Segments match
  `[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}`; `.`, `..` and encoded separators are
  rejected. `core` and `core.*` are reserved for the host.
- **Browser binding is an API boundary, not isolation.** Built-in browser plugins
  share the page's origin. Untrusted third-party code must use the EXTERNAL
  workload boundary ([0004](#adr-0004)).
- **Concurrency.** Every write carries `expectedVersion` (`0` = create-only).
  A stale write returns 409 `STATE_VERSION_CONFLICT` with the current record.
  Clients never pick a winner by clock; same-key conflicts stay visible until the
  user resolves them.
- **Quotas** are checked under a per-owner transaction lock (including first
  insert). Request size is bounded before parsing; nesting above 64 and duplicate
  fields are rejected.
- **Audit.** Each mutation appends a metadata-only change event (no values, no
  credentials) in the same transaction; delivery is by outbox after commit.
- **Errors never leak existence**: denied access returns 404, and no error reveals
  another owner's data, quota or versions.
- **Lifecycle.** Uninstall preserves user documents. Backups and exports include
  state, tombstones and versions; restore remaps ownership to the importing user.
  JSONB is not end-to-end encrypted; a deployment without encrypted storage must
  not claim encryption at rest, and plugins store secrets in the secret service,
  not in state. Restores change a storage generation so old offline queues cannot
  silently overwrite restored data.
- **Scope.** Plugin state is for bounded workspace documents. Notes, identities,
  attachments, relationships, signed approvals, execution traces and financial
  invariants stay first-class entities. Plugin state must not become an
  authorization escape hatch or a second copy of the knowledge graph.

**Consequences.**

- Implemented defaults (`PluginStateStore.Limits.defaults()`): 1 MiB per record,
  500,000 records and 1 GiB per owner/namespace, 4 GiB per owner. The ADR's
  original 10,000-record / 50 MiB / 250 MiB figures were too small for
  one-record-per-item collections such as a media library.
- Only the `personal` workspace exists; any other workspace name returns 404.
  Shared workspaces need an explicit membership policy rather than relaxed owner
  predicates.
- Every consumer (canvas, databases, todos, time entries, saved searches,
  installations) uses one record per item or per configuration document, so
  unrelated edits never conflict.

**Code.** [`V3__Versioned_plugin_state.sql`](../../backend/src/main/resources/db/postgresql/V3__Versioned_plugin_state.sql),
[`PluginStateStore.java`](../../backend/src/main/java/com/modulo/state/PluginStateStore.java),
[`PluginStateController.java`](../../backend/src/main/java/com/modulo/state/PluginStateController.java),
[`pluginStateClient.ts`](../../frontend/src/services/pluginStateClient.ts).
API and operating details: [data-and-state.md](data-and-state.md#plugin-state).

---

<a id="adr-0009a"></a>
## 0009a — One shared frontend packaged for Android with Capacitor

**Status:** Accepted. (Originally numbered 0009.)

**Context.** The Android app was a Notes-only Kotlin/Room scaffold that
duplicated the UI, lacked most workflows, and was not buildable as checked in.
Loading the web deployment inside a WebView would give no offline launch and let
the server control the app's origin.

**Decision.**

- Package the existing React frontend and the complete plugin catalog as a
  Capacitor Android app (`mobile/app`, app ID `com.modulo`). Plugin IDs,
  registration, schemas, domain logic, API clients and the state protocol stay
  shared with web and Electron. Platform differences are chosen at runtime
  (`Capacitor.getPlatform()`), never by forking components.
- The configured Modulo server is authoritative for acknowledged state. Each
  client keeps a partitioned, transactional offline queue: IndexedDB on web and
  Electron, SQLite on Android. An edit is reported saved only after the queue
  write commits.
- Browser `localStorage` is read only by the isolated legacy migration module
  (`frontend/src/services/legacy`). Plugin data, settings, drafts, recovery and
  queues never use browser Storage; ESLint enforces this.
- The APK serves the frontend from its own assets. On first launch the user
  enters an HTTPS server origin; mixed content is refused. Switching servers
  closes state clients, discards credentials and quarantines the old server's
  queues in their own partitions.
- **Login** is OIDC authorization code + PKCE as a public client, in the system
  browser (Custom Tabs), never an embedded WebView (RFC 8252). The redirect uses
  the private-use scheme `com.modulo:/oauth2redirect`, because a claimed HTTPS
  app link would require every self-hosted server to publish `assetlinks.json`.
  Access tokens stay in memory; the refresh token is AES-GCM encrypted with an
  Android Keystore key and excluded from backup.
- Plugins reach device features only through `frontend/src/platform`, which has
  a web and an Android implementation per capability. A plugin whose workflow
  needs a missing capability must offer a documented alternative route; hiding
  the view is not parity.
- **Trust.** The APK's own assets are trusted code; everything from the server is
  untrusted data rendered through the sanitising Markdown pipeline. The WebView
  loads only the packaged origin. The native bridge exposes only Modulo's
  plugins and Capacitor's core plugins, and each native method validates its
  arguments.

**Consequences.**

- Toolchain moves together: Capacitor 8.5.x (pinned exactly), `minSdk` 26 /
  `compileSdk` and `targetSdk` 36, Android Gradle Plugin 8.13.x, Gradle 8.14.3,
  JDK 21 for the Android build (the backend stays on Java 17), WebView/Chrome 120+
  at runtime. Upgrade them in one dedicated change with the Android smoke run.
- The server must allow the packaged origin in CORS, accept bearer tokens without
  cookies, keep the `X-Modulo-State-Generation` contract, and register
  `com.modulo:/oauth2redirect` and `com.modulo:/logout` on the public Keycloak
  client. Nothing else in the backend is Android-specific.
- Android system backup is disabled for the private database: a restored queue
  would carry another installation's replica identity.
- `mobile/android` is kept only as a reference for migrating installs of the old
  app and is deleted once the signed release pipeline proves upgrade continuity.

**Code.** [`mobile/app/capacitor.config.ts`](../../mobile/app/capacitor.config.ts),
[`mobile/app/android/app/src/main/java/com/modulo/`](../../mobile/app/android/app/src/main/java/com/modulo/),
[`frontend/src/platform/`](../../frontend/src/platform/),
[`oidcConfig.ts`](../../frontend/src/features/auth/oidcConfig.ts).
Feature guide: [mobile-and-desktop.md](../features/mobile-and-desktop.md).

---

<a id="adr-0009b"></a>
## 0009b — Run-bound human approval contract

**Status:** Accepted and implemented. (Originally numbered 0009.)

**Context.** Workflows need a human decision before a sensitive step. A naive
"approved" flag can be replayed into another run, approved by the requester,
decided by someone whose role was revoked, or applied to a Blueprint that changed
after review.

**Decision.**

- An approval is an accountable decision about **one immutable request in one
  run attempt**. It grants no general access. A receipt from another request,
  attempt, Blueprint revision or checkpoint never satisfies the current wait.
- The interpreter creates requests from an approval node. Requester and owner
  come from the stored run, not from trigger values or request JSON. V1
  designates one explicit reviewer and needs one decision. Unsupported selectors
  or quorum values are rejected rather than broadening authorization.
- **Separation of duty.** The reviewer must differ from the requester, checked at
  request time and again at decision time; node configuration cannot disable it.
  JWT role strings, stale UI eligibility and knowledge of a request UUID are not
  approval authority.
- **State machine.** REQUESTED → PENDING → APPROVED / REJECTED / EXPIRED /
  CANCELLED / SUPERSEDED. Resolved states are terminal. Expiry is its own outcome,
  never implied approval; downstream nodes must branch on recognized outcomes.
- **Commit-time checks.** The decision transaction locks the request, checks its
  expected revision and pending state, and re-validates reviewer eligibility, run
  binding (owner, attempt, checkpoint, resume nonce), Blueprint and evidence
  digests, and expiry against the database clock. Only then is the decision
  appended. The resume worker re-checks the binding.
- **Idempotency.** An exact replay with the same idempotency key returns the
  original receipt. A different body under the same key, a stale revision or an
  already resolved request is a 409. Unauthorized and unknown request IDs get the
  same "unavailable" response.
- **Policy limits.** Expiry is 1 minute to 7 days (default 24 hours) and is
  immutable after activation; extending it creates a superseding request.
  Rejection requires a non-blank comment; comments are NFC-normalized and capped
  at 4096 UTF-8 bytes. Delegation is off in v1.
- **Retries** get a new run, attempt and request. An approval from an earlier run
  or checkpoint is never reused. A Blueprint or evidence change supersedes a
  pending approval.
- **Signing.** The signed statement covers a versioned domain separator, all
  request/run identifiers, digests, actor, outcome, comment digest, timestamp,
  key ID and algorithm. A server signature attests what the server accepted, not
  that the user holds the key. Unsigned, server-signed, wallet-signed, anchored
  and unverifiable are distinct states; placeholders are never shown as verified.

**Consequences.** Decisions are append-only; corrections are new requests with
lineage. Reviewers see only the approval projection: being an approver does not
bypass note ownership or run-detail authorization, and restricted artifacts are
shown as omitted with their digest.

**Code.** [`ApprovalService.java`](../../backend/src/main/java/com/modulo/blueprint/approval/ApprovalService.java),
[`ApprovalController.java`](../../backend/src/main/java/com/modulo/blueprint/approval/ApprovalController.java)
(`/api/approvals`),
[`ApprovalSigningService.java`](../../backend/src/main/java/com/modulo/blueprint/approval/ApprovalSigningService.java),
[`V12__Human_approval_runtime.sql`](../../backend/src/main/resources/db/postgresql/V12__Human_approval_runtime.sql),
[`V13__Approval_decision_signatures.sql`](../../backend/src/main/resources/db/postgresql/V13__Approval_decision_signatures.sql).
Feature guide: [workflows-and-approvals.md](../features/workflows-and-approvals.md).
