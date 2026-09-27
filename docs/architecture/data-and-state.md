# Data and state

Where Modulo keeps data, who owns each piece, and how clients stay consistent
with the server, online and offline. It is for contributors adding a table, a
plugin store or a sync path, and for operators reasoning about backups and
restores. Migration procedures, backups and restore drills are in
[database.md](../operations/database.md); plugin-state runbooks are in
[runbooks.md](../operations/runbooks.md).

## Stores at a glance

| Store | Role | Source of truth? | Code |
| --- | --- | --- | --- |
| PostgreSQL | Notes, links, tags, users, plugin state, workflows, approvals, packs, knowledge index, files | Yes | JPA entities in the feature packages ([`note/`](../../backend/src/main/java/com/modulo/note/), [`tag/`](../../backend/src/main/java/com/modulo/tag/), [`link/`](../../backend/src/main/java/com/modulo/link/), [`attachment/`](../../backend/src/main/java/com/modulo/attachment/), [`task/`](../../backend/src/main/java/com/modulo/task/), [`user/`](../../backend/src/main/java/com/modulo/user/), …), JDBC stores in [`state/`](../../backend/src/main/java/com/modulo/state/), [`blueprint/`](../../backend/src/main/java/com/modulo/blueprint/) |
| Azure Blob Storage | Note attachment binaries (metadata in `application.attachments`) | Yes, for blobs | [`AttachmentService`](../../backend/src/main/java/com/modulo/attachment/AttachmentService.java) |
| IPFS | Published or encrypted note payloads | No (public; see [security-model.md](security-model.md#encrypted-note-sharing)) | [`IpfsService`](../../backend/src/main/java/com/modulo/blockchain/IpfsService.java) |
| Client IndexedDB / Android SQLite | Offline queues and caches, device documents | No; the server is authoritative for acknowledged state | [`frontend/src/services/`](../../frontend/src/services/) |

## Ownership and tenancy

Modulo is multi-user with a single owner per record; there is no organization or
shared-workspace tenancy yet.

- Every domain table carries an owner (`user_id` or `owner_id` referencing
  `users.id`). The owner comes from the authenticated principal, resolved by
  `AuthenticatedUserService`, never from request bodies, headers such as
  `X-User-Id`, or display names.
- JPA queries apply the owner through the SpEL expression `:#{tenant.ownerId}`
  ([`TenantQueryExtension`](../../backend/src/main/java/com/modulo/security/TenantQueryExtension.java)).
  `NoteRepository` overrides `findById`, `findAll`, `findAllById`, `count` and
  `existsById` so the inherited methods cannot bypass the owner filter.
- JDBC stores (plugin state, workflows, approvals, files) repeat the owner
  predicate in every read, list, compare-and-set, delete and cursor query.
- Foreign and missing records return the same 404, so identifiers cannot be
  probed.
- The only workspace is `personal`. APIs that take `{workspace}` reject any other
  value with 404. Shared workspaces will need an explicit membership model, not
  relaxed owner predicates.
- Legacy rows without an owner (for example tags from before owner scoping,
  Blueprints with only an author string) are preserved but excluded until an
  operator assigns them in a reviewed migration. Tooling:
  [`OwnershipBackfillTool`](../../backend/src/main/java/com/modulo/migration/OwnershipBackfillTool.java).

## PostgreSQL schema and migrations

### Profiles

| Profile | Database | Schema management |
| --- | --- | --- |
| default (no profile) | H2 in memory (`application.properties`) | Hibernate `ddl-auto: update`; Flyway off |
| `docker`, `dev` | PostgreSQL from `SPRING_DATASOURCE_URL` (`dev` defaults to `localhost:5432/modulodb`) | Flyway on; Hibernate `validate` |

Flyway settings (`application.properties`): locations
`classpath:db/postgresql`, history table `modulo_schema_history`, schemas
`public` and `application`, `baseline-on-migrate=false`, `clean-disabled=true`.
Flyway owns all PostgreSQL DDL; Hibernate only validates.

Two schemas are in use. `application` holds the note domain (notes, links,
tags, attachments, comments, share tokens, note metadata) and the semantic
knowledge tables. `public` holds users, tasks, templates, notifications, audit
events, the plugin registry and most tables added by later migrations.

### Migration history

Migrations live in
[`backend/src/main/resources/db/postgresql/`](../../backend/src/main/resources/db/postgresql/).
Never edit a migration after it has been deployed; add a new one.

| Version | Adds |
| --- | --- |
| V1 | Baseline of the Hibernate schema: notes, links, tags, attachments, comments, share tokens, users and auth providers, tasks, templates, notifications, audit events, plugin registry, permissions and execution logs |
| V2 | Pack fields on the plugin registry, `pack_contributions`, note update index |
| V3 | `plugin_state`, `plugin_state_events` (versioned plugin documents) |
| V4 | Owner-scoped tags (`user_id`, unique `(user_id, name)`); unowned tags quarantined |
| V5 | `plugin_state_grants`, `plugin_state_schemas`, delivery tracking on events |
| V6 | `plugin_state_storage` (storage generation for restore detection) |
| V7 | `workflow_runs`, `workflow_steps`; Blueprint owner and per-owner name |
| V8 | Step `duration_ms` |
| V9 | `workflow_checkpoints`, cancel/retry lineage |
| V10 | `workflow_schedules`, `workflow_schedule_jobs` (durable cron) |
| V11 | `workflow_alerts`, `workflow_ops_policies` |
| V12 | `approval_requests`, `approval_decisions`, `approval_events`, `approval_grants` |
| V13 | `approval_signatures`, `approval_signing_keys` |
| V14 | Transactional workspace packs (`workspace_pack_installations`, `_releases`, `_resources`, `_operations`, `_demo_records`, `_runtime_refresh`) |
| V15 | `workspace_pack_drafts`, `workspace_pack_publications` (Pack Studio) |
| V16 | `note_property_definitions`, `note_property_values` (typed properties) |
| V17 | `saved_property_queries` and embedded-database import tables |
| V18 | Pack knowledge resources, `audit_pack_engagements`, `approval_report_artifacts` |
| V19 | `application.note_embeddings`, `suggested_note_links`, `knowledge_preferences` |
| V20 | Marketplace trust center (publishers, releases, installations, trust evidence and reports) |
| V21 | `application.knowledge_index_queue` and index generations |
| V22 | Marketplace release identity |
| V23 | Gmail newsletter connection and OAuth tables |
| V24 | `workspace_files` (owner-scoped binaries) |
| V25 | `plugin_state_workloads` (outbound external agents) |
| V26 | Blueprint autonomy levels |
| V27 | `remote_service_credentials` (AES-GCM encrypted) |
| V28 | `praxis_submissions` |

Several tables are protected by database triggers, not only by service code: for
example, workflow runs reject terminal-state regressions and invalid attempt
changes even if a caller bypasses the service.

### Workflow data

Workflow runs, steps, checkpoints and schedules are owner-scoped PostgreSQL
tables with bounded, redacted metadata (field and type counts, at most 16 owned
note references, 4 KiB per metadata column; checkpoints up to 1 MiB each and
4 MiB per run). Terminal runs expire after 90 days (cleanup can be disabled with
`modulo.workflow.retention.enabled=false`), with a cap of 10,000 runs per owner.
Checkpoints contain private execution payloads, so backups need the same
protection as notes. Behavior and APIs are in
[workflows-and-approvals.md](../features/workflows-and-approvals.md).

### Files and attachments

| Kind | Storage | Limits |
| --- | --- | --- |
| Workspace files (`/api/workspaces/{workspace}/files`) | `workspace_files.content` (BYTEA), keyed `(owner_id, workspace_id, file_id)` | 25 MiB per file, 1 GiB per owner |
| Note attachments (`/api/attachments`) | Azure Blob Storage (`azure.storage.*`), metadata in `application.attachments` | `azure.storage.max-file-size` (default 10 MiB) and an allowed content-type list |
| Note-local files (`/api/notes/{noteId}/files`) | Local directory `modulo.upload.dir` (default `${java.io.tmpdir}/modulo-uploads`) | Owner-checked through the note |

## Note link graph

Links between notes are rows in `application.note_links`. Backlinks, the
workspace Graph view and unlinked mentions all read them from PostgreSQL; the
graph layout is computed in the client. There is no separate graph store.

Semantic search also uses PostgreSQL: note changes enqueue work in
`application.knowledge_index_queue` in the same transaction, and a scheduled
drainer (`modulo.knowledge.index-interval-ms`, default 2000) processes up to 25
notes per tick. See [knowledge.md](../features/knowledge.md).

<a id="plugin-state"></a>
## Plugin state

Workspace plugins keep their durable data in server-side plugin state: small,
namespaced, versioned JSON documents. The design is
[ADR 0008](decisions.md#adr-0008); this section is the working reference.

### Record model

A record is identified by `(owner, workspace, namespace, key)` and carries
`schemaId`, `schemaVersion`, a monotonic `version`, the JSON `value`, a
`deleted` tombstone flag and timestamps.

- **Namespace** is the installed plugin ID. The browser host binds each plugin's
  client to its manifest ID; plugins cannot pick another namespace. `core`,
  `core.*` and the host's `workspace-settings` are reserved.
- **Segments** (workspace, namespace, key) match
  `[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}`; `.`, `..` and encoded separators are
  rejected. Keys are opaque, not paths.
- **Versions** increase across delete and recreate, so a stale writer can never
  overwrite a recreated record (no ABA).

### Host API

Base path: `/api/workspaces/personal/plugin-state/{namespace}`. All calls need an
authenticated, provisioned user.

| Call | Behavior |
| --- | --- |
| `GET /{key}` | Record plus an ETag carrying its version; absent or deleted → 404 |
| `GET ?cursor=&limit=` | Key-ordered page (default 100, max 200); the cursor is the last key and never grants access by itself |
| `GET ?changesAfter=&limit=` | Change feed including tombstones, ordered by a commit-ordered sequence |
| `GET ?generation` | Current storage generation UUID |
| `PUT /{key}` | Body `{expectedVersion, schemaId, schemaVersion, value}`; `expectedVersion: 0` is create-only |
| `DELETE /{key}?expectedVersion=N` | Creates a tombstone at N+1 |
| `GET /api/workspaces/personal/plugin-state` | Summary of the owner's namespaces |

Example create:

```http
PUT /api/workspaces/personal/plugin-state/canvas/board_123
Content-Type: application/json
X-Modulo-State-Generation: <uuid from GET ?generation>

{"expectedVersion":0,"schemaId":"modulo.canvas.board","schemaVersion":1,
 "value":{"id":"board_123","name":"Plan","cards":[],"connections":[]}}
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | — | Invalid JSON, schema or segment |
| 404 | `STATE_ACCESS_DENIED`, `STATE_NAMESPACE_NOT_AVAILABLE` | Missing, foreign, reserved or non-`personal` workspace |
| 409 | `STATE_VERSION_CONFLICT` | Stale `expectedVersion`; body has `expectedVersion`, `actualVersion` and the current record (write-only grants get the version but not the document) |
| 412 | `STATE_STORAGE_GENERATION_CHANGED` | Storage was restored; reconcile before writing |
| 413 | — | Request too large |
| 428 | `STATE_STORAGE_GENERATION_REQUIRED` | `X-Modulo-State-Generation` missing on PUT/DELETE |
| 429 | `STATE_QUOTA_EXCEEDED`, `STATE_EVENT_QUOTA_EXCEEDED` | Quota reached |

### Limits

| Limit | Default |
| --- | --- |
| Serialized record size | 1 MiB |
| Live records per owner/namespace | 500,000 |
| Bytes per owner/namespace | 1 GiB |
| Bytes per owner (all namespaces) | 4 GiB |
| JSON nesting depth | 64; duplicate fields rejected; strict UTF-8 |
| Change events per owner | 100,000 (`STATE_EVENT_QUOTA_EXCEEDED`) |
| Registered schema definitions | 16 KiB each, 1,000 per owner, nesting 16 |

Quota checks run under a per-owner transaction lock, including the first insert,
so concurrent creates cannot bypass them. Tombstones count against the record
quota. Defaults are in `PluginStateStore.Limits.defaults()`.

### Schemas

Built-in `modulo.*` schemas are namespace-bound and cannot be replaced. They
cover workspace installations and hub tabs, canvas boards and preferences,
embedded databases, saved searches, migration markers, focus sessions, and the
operational records below. Unknown schemas or versions return
`STATE_UNKNOWN_SCHEMA` on write; existing data stays readable and exportable.
Same-schema version downgrades are rejected.

Owners can register an immutable custom schema version with
`PUT /api/workspaces/personal/plugin-state-schemas/{namespace}/{schemaId}/{version}`.
Repeating an identical registration succeeds; changing it returns 409
`STATE_SCHEMA_IMMUTABLE`. The dialect is a bounded structural subset: `type`,
`properties`, `required`, boolean `additionalProperties`, `items`, `enum`,
`minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`. `$ref`,
`pattern`, remote fetches and executable validators are rejected. Schemas check
structure only; consumers still validate business rules (for example canvas
connection endpoints).

<a id="external-access-grants-and-workloads"></a>
### External access: grants and workloads

EXTERNAL plugin workloads never borrow a browser session. They need a registered
workload identity, an active runtime permission (`state.read` / `state.write`)
that matches the registry, and an owner grant.

| Endpoint | Purpose | Limits |
| --- | --- | --- |
| `POST /api/plugin-state/grants` | Owner issues a grant: `{pluginId, permissions, lifetimeSeconds}`; response has a one-time 256-bit `token` | Lifetime ≤ 1 hour; 100 active and 1,000 retained per owner |
| `GET /api/plugin-state/grants` | List grant metadata (no secrets) | |
| `DELETE /api/plugin-state/grants/{id}` | Revoke | Serialized with writes on the owner lock |
| `POST /api/plugin-state/workloads` | Owner provisions an outbound-only agent: `{pluginId, permissions, lifetime}`; one-time workload token | Lifetime 1 hour to 90 days; 10 active per owner and plugin; not for reserved namespaces |
| `GET`, `DELETE /api/plugin-state/workloads[/{id}]` | List or revoke (revocation also revokes its grants) | |
| `/api/plugin-state/callback/workspaces/personal/{namespace}` | Same GET/list/changes/PUT/DELETE contract as the host API | Headers `X-Modulo-Plugin-Token` and `X-Modulo-State-Grant` |
| `POST /api/plugin-state/callback/grants/rotate` | A provisioned workload swaps a valid grant for a fresh one (same scope, ≤ 1 hour), atomically revoking the old one | Cannot widen permissions |

Only SHA-256 hashes of tokens are stored. Deliver tokens through the workload's
secret configuration; never put them in URLs, state values or logs. Unknown,
foreign, expired and revoked grants all return 404 `STATE_ACCESS_DENIED`.
External callers cannot register schemas or issue grants. Runtime permission
removal, token rotation, expiry and plugin deactivation all deny further access.
Arbitrary Blueprint nodes cannot use this data through a browser session.

### Audit, change feed and live delivery

- Every accepted mutation appends a metadata-only event in the same transaction:
  owner, workspace, namespace, key, operation, record and schema versions, actor
  plugin (`host` for the browser API) and a server-generated request UUID. No
  values, no tokens.
- A per-owner lock orders changes before sequence allocation, so the change
  cursor is safe under concurrent commits. Events are retained until an explicit
  retention policy exists; do not purge them underneath client cursors.
- [`PluginStateOutbox`](../../backend/src/main/java/com/modulo/state/PluginStateOutbox.java)
  polls committed events (`FOR UPDATE SKIP LOCKED`) and sends them to the owner's
  `/user/queue/state` STOMP queue, retrying with bounded exponential backoff.
  Delivery is at least once; consumers deduplicate by event ID. Events are never
  broadcast on the global plugin bus. The worker is off in the `test` profile and
  can be disabled with `modulo.state.delivery.enabled=false` without affecting
  writes or polling.

### Restore generation

A restore changes the storage generation. Clients read `GET ?generation` and send
it as `X-Modulo-State-Generation` on every PUT and DELETE (external callbacks
too). A stale generation gets 412, which forces reconciliation instead of letting
an old offline queue overwrite restored data.

### Operational records

Productivity and business plugins store one document per item under
namespace-bound schemas. Configuration is one document per setting.

| Namespace / key | Schema | Contents |
| --- | --- | --- |
| `todo-lists` / `record.<id>` | `modulo.todo` | One personal task (distinct from the relational `/api/tasks` API) |
| `zeiterfassung` / `record.<id>` | `modulo.time-entry` | One time entry |
| `euer-datev` / `record.<id>` | `modulo.expense` | One expense worksheet record |
| `euer-datev` / `categories`, `exported-periods` | `modulo.expense.categories`, `modulo.expense.exported-periods` | Ordered configuration; advisory export history |
| `rechnung` / `seller` | `modulo.invoice.seller` | Invoice issuer profile |
| `gobd-vault` / `classes` | `modulo.retention.classes` | Retention classes |
| `kanban` / `stages` | `modulo.pipeline.stages` | Pipeline stages |

Invoices, income, retained documents and attachments stay in notes, tags and the
attachment API; there is no second invoice database. The expense worksheet is
editable planning data, not an immutable ledger. Regulated posting, legally
enforced retention, atomic invoice numbering and payment reconciliation would
need first-class transactional services; this storage does not certify
compliance. An "exported period" flag is a warning, not proof a recipient
received a file.

### What belongs in plugin state

Use plugin state for bounded workspace documents: boards, database rows, tasks,
entries, saved searches, installation records and preferences. Use first-class
tables for notes, identities, attachments, relationships, signed approvals,
execution traces and anything needing server-side joins, indexes or transactional
domain rules. Plugin state is not an authorization mechanism and not a second
copy of the knowledge graph.

## Client state, offline and sync

### Device stores

| Data | Web / Electron | Android |
| --- | --- | --- |
| Plugin-state queue and cache | IndexedDB `modulo-plugin-state` | SQLite via `ModuloStateCachePlugin` |
| Offline notes cache | IndexedDB `modulo-offline-notes` | SQLite (separate partitions) |
| Device documents (unsaved drafts, theme) | IndexedDB `modulo-device-documents` | SQLite |
| Legacy migration recovery copies | IndexedDB `modulo-legacy-recovery` | none |
| Credentials | Memory | Memory plus Keystore-encrypted refresh token |

Browser `localStorage` and `sessionStorage` are banned by ESLint outside
`src/services/legacy/**`, `src/features/auth/**` and tests. Both device adapters
pass the same contract suite (`statePersistenceContract.test.ts`).

### The offline queue

[`PluginStateClient`](../../frontend/src/services/pluginStateClient.ts) is the
only way plugins touch state; it exposes typed `get` / `list` / `set` /
`delete` / `watch` and a `syncing` / `offline` / `conflict` / `error` status.

- Caches and queues are partitioned by
  `[server origin, OIDC issuer, subject, workspace, namespace, replica]`. The
  replica ID distinguishes simultaneous tabs.
- A mutation is persisted with its base version and base document **before** the
  save is reported, then replayed in order per key with bounded exponential
  backoff and jitter.
- Authentication or permission errors stop replay; schema errors and conflicts
  wait for the user.
- On logout, replay stops, in-flight calls abort and in-memory views clear. A new
  account cannot adopt the old account's queue, and the session generation is
  rechecked before any in-flight response is applied.
- `watch` refreshes on host events (`/user/queue/state`) and reconnects, with a
  bounded polling fallback; an expired change cursor triggers a snapshot refresh.
- Dragging and typing debounce network writes while the local copy keeps the
  latest document.

### Conflicts

A 409 means another client changed the record since this client's base. For
host-owned workspace documents (`modulo.workspace.*` schemas) the client first
tries a record-level three-way merge
([`stateMerge.ts`](../../frontend/src/services/stateMerge.ts)) of base, local and
server values:

- different records in a collection (matched by `id`) and different fields of one
  record are both kept;
- string/number membership lists apply both sides' additions and removals;
- a field changed differently on both sides, or edit-versus-delete, is a conflict
  kept for review.

A clean merge is written with the server's version as `expectedVersion`, so the
server's compare-and-set still guards it. Other schemas never auto-merge. The
client never picks a winner by clock. An uncertain PUT is reconciled by comparing
the fetched document before replay.

Notes use a different mechanism: the `notes.version` column is a JPA optimistic
lock, and `/api/conflicts` (`check`, `update`, `resolve`) supports detecting and
resolving concurrent edits.

### Legacy browser data

Older builds stored plugin data in `localStorage`. Migration is explicit and
safe to retry:

- Each store offers **Import into this account**. Browser-global legacy values are
  never silently adopted by whoever signs in next.
- The whole source is validated first (including duplicate IDs); original IDs are
  kept. Imports are create-only; if the server already has data, the legacy value
  is kept as a recoverable import conflict.
- A synchronized migration marker is written after all records are acknowledged;
  only then are successfully imported legacy keys removed, after checking another
  tab has not changed them.
- Unknown schema versions stay read-only and exportable; a failed migration keeps
  the source bytes. Recovery export contains plaintext legacy data.

The mapping from legacy keys to namespaces is
[`legacyKeyRegistry.ts`](../../frontend/src/services/legacy/legacyKeyRegistry.ts).

The client-side queue above is the only offline path. The backend has no
offline store of its own; the `offline_notes` table left by early migrations is
unused.

## Backups, exports and encryption

- Backups must include plugin state, tombstones, schema IDs and versions,
  workflow checkpoints and approval records. They contain private data in
  plaintext; store database volumes and backups on encrypted storage with keys
  outside the database.
- Restore remaps ownership to the authenticated importing owner through an
  explicit import; owner IDs in an export grant nothing. Imports go through normal
  conditional writes and quotas.
- Uninstalling a plugin or pack removes activation and configuration, not user
  content; deleting data is a separate explicit action. Pack rollback preserves
  user-created records.
- Portable JSON exports contain plaintext user data, and the export UI says so.

Procedures: [database.md](../operations/database.md).
