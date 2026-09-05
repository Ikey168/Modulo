# Plugin state implementation and rollout

Reviewed: 2026-09-05. Contract: [ADR 0008](../architecture/adr-0008-plugin-state.md).
Tracking: [#409](https://github.com/Ikey168/Modulo/issues/409),
[#417](https://github.com/Ikey168/Modulo/issues/417),
[#418](https://github.com/Ikey168/Modulo/issues/418).

## Implemented foundation

`AuthenticatedUserService` resolves verified identities to existing persisted users.
JWTs must have the configured resource-server issuer and a matching Keycloak
subject. OAuth logins use their configured provider's subject field. Local
UserDetails principals resolve by username. Request-supplied owner IDs, emails and
display names never grant state access. Unknown/unprovisioned accounts fail closed;
this service does not automatically adopt existing single-user records.

`PluginStateStore` provides PostgreSQL JSONB CRUD, monotonically increasing
versions (including tombstones), tenant predicates, per-owner write serialization,
record/byte quotas and atomic metadata-only audit rows. V3 adds its tables. Apply
it using the existing PostgreSQL migration workflow before enabling consumers.
The baseline/Flyway integration is committed separately in 098b4d2c and validated
by the migration tests.

The host REST API is:

| Method | Path relative to `/api/workspaces/personal/plugin-state/{namespace}` | Behavior |
|---|---|---|
| GET | `/{key}` | Authorized live record and ETag, or 404 |
| GET | `?cursor={lastKey}&limit=100` | Key-ordered live records with `nextCursor` |
| GET | `?changesAfter=0&limit=100` | Owner/namespace-scoped audit changes including deletes |
| PUT | `/{key}` | Conditional create/update; returns record and ETag |
| DELETE | `/{key}?expectedVersion=1` | Conditional tombstone; returns its new version |

PUT accepts exactly `expectedVersion`, `schemaId`, `schemaVersion`, and `value`.
`expectedVersion: 0` means create-only. Deleting and recreating a key does not reset
its version. JSON null remains distinct from a deleted/absent record. The request
body is bounded before parsing, including chunked requests; malformed UTF-8,
duplicate JSON members, excessive nesting and trailing documents are rejected.
Responses, including errors, are JSON. OpenAPI annotations expose the write model;
response method types expose the record, page and change models.

```json
{"expectedVersion":0,"schemaId":"modulo.canvas.board","schemaVersion":1,
 "value":{"cards":[],"edges":[]}}
```

Stale writes return 409 with `STATE_VERSION_CONFLICT`, expected/actual versions
and the authorized current record. A different owner's record never appears in
that response. Invalid input returns 400, oversized input 413, quota exhaustion
429, and unprovisioned principals 403. Only the personal workspace is currently
available. `core` and `core.*` namespaces are reserved and inaccessible through
this public route.

`PluginStateClient` supplies cached get/list, durable set/delete, watches,
conditional replay, explicit local/remote conflict resolution and bounded retry
backoff. A save is acknowledged locally only after persistence succeeds. Pending
work and conflict bases survive restart. Each replica partitions its cache by
origin, issuer, subject, workspace, namespace and replica ID. A replica ID must be
stable across that replica's recovery and distinct between concurrent tabs.
The workspace host calls `close()` on logout/account change. Transport also checks the
current subject and issuer before sending each request; it cannot replay an old
queue with a new user's token. A pending queue is never silently reassigned.

`BrowserStatePersistence` uses browser storage for the recovery cache, not as the
server record store. Storage exhaustion and corrupt cache data surface as errors.
The host must provide a recovery path for a replica whose tab was abandoned.

## Remaining acceptance work — issues stay open

- #415: wire canonical ownership through all note/tag/link/task/attachment, graph,
  import/export, collaboration and audit paths; migrate legacy ownership and
  replace shared WebSocket broadcasts. The new resolver alone does not establish
  tenant isolation for those existing endpoints.
- #417: bind EXTERNAL workload callbacks to installed-plugin permissions and
  consent; register/validate plugin document schemas; dispatch the durable audit
  outbox to plugin events with retention/expiry behavior. The host API currently
  authorizes user-owned state; it is not an EXTERNAL plugin callback API.
- Host recovery after a database restore and discovery of queues belonging to abandoned
  tabs remain follow-up hardening. Open tabs hold exclusive Web Locks; cloned tabs
  receive a separate replica. Browser session storage retains the replica on reload.
- #419, #421–422: migrate existing consumer stores using explicit legacy-data claiming,
  stable IDs and create-only imports.
- #420: Canvas uses one schema-versioned record per board, shared sync controls and
  explicit legacy import. Unknown schemas retain their raw cache for recovery export.
  Existing note navigation is preserved; full offline browser acceptance remains in #423.
- #423: run the full browser/Electron two-client, offline, backup and tenant suite.

Database, Todos, business records and plugin installations still use their existing stores.

## Validation

Focused verification uses real PostgreSQL via Testcontainers:

```sh
cd backend
mvn -q -Dtest=AuthenticatedUserServiceTest,PluginStateStoreTest,SchemaMigrationTest test
```

The 29 backend tests cover identity isolation, store and HTTP behavior, concurrent
writes/quotas, tombstone versions, malformed input, atomic audit rollback, fresh
migration and existing-schema adoption. The HTTP regression checks ensure errors
remain JSON even when the client sends no Accept header.

```sh
cd frontend
npx vitest run src/services/__tests__/pluginStateClient.test.ts
```

The 17 client tests cover offline restart/replay, concurrent edits, explicit
conflict decisions, lost responses, account partitioning, delayed responses after
close, deletion/recreation, storage failure and changed-session transport denial.
These are focused component tests, not the #423 end-to-end acceptance suite.

The existing eight `NoteControllerTest` cases also pass with the new services
loaded, and the complete frontend `npm run typecheck` passes. The local JDK is
25; JaCoCo 0.8.11 reports unsupported JDK class instrumentation during the
controller regression run, so these results establish assertions, not complete
coverage measurement. Use the project's Java 17 toolchain for coverage gates.

## Frontend host integration

The public plugin context exposes `state()` bound to the installed, enabled plugin's
namespace. `usePluginState` provides React subscriptions and `PluginStateNotice`
provides retry and conflict actions. The host discovers remote records on open,
focus, reconnect and every 30 seconds. Token renewal retains the partition; account
changes close clients and abort requests before exposing the next account.

The focused frontend suite has 62 passing tests covering the client, host, Canvas
migration and existing Canvas/runtime behavior. Canvas import retains the legacy
source until every board and migration marker synchronize. Conflicting server data
is never overwritten by import. Pointer mutations persist locally and debounce
network writes. TypeScript checks pass for the integrated workspace.
