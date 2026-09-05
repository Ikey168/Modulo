# ADR 0008: Namespaced, versioned plugin state

Date: 2026-09-05 · Status: accepted design; implementation tracked separately
Owner: repository maintainers · Issue: [#416](https://github.com/Ikey168/Modulo/issues/416)

## Decision

Use a PostgreSQL JSONB record for small, durable plugin documents. Resolve the
owner from the authenticated server principal, never from JSON, URL parameters,
plugin metadata, or an editor name. A workspace belongs to that owner; initial
personal workspaces use `personal`. Shared workspaces require an explicit future
membership policy rather than relaxing owner predicates.

The primary key is `(owner_id, workspace_id, namespace, state_key)`. Namespaces
are installed plugin IDs and cannot be chosen by an external caller independently
of its authenticated plugin identity. Built-in browser plugins use the signed-in
user's session and the host binds the client to the manifest ID. This binding is
an API boundary, not isolation from malicious JavaScript running in the same
origin. Untrusted third-party code must use the EXTERNAL workload boundary.

Namespace, workspace and key segments accept `[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}`;
`.` and `..` and percent-encoded path separators are rejected. Keys are opaque,
not file paths. Namespace `core` and names beginning `core.` are reserved for
host-controlled installation records, migration markers and preferences.

## Storage schema

```sql
CREATE TABLE plugin_state (
  owner_id BIGINT NOT NULL REFERENCES users(id),
  workspace_id VARCHAR(128) NOT NULL,
  namespace VARCHAR(128) NOT NULL,
  state_key VARCHAR(128) NOT NULL,
  schema_id VARCHAR(256) NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  version BIGINT NOT NULL CHECK (version > 0),
  value JSONB,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_id, workspace_id, namespace, state_key),
  CHECK ((deleted AND value IS NULL) OR
         (NOT deleted AND value IS NOT NULL))
);
CREATE INDEX plugin_state_changes ON plugin_state
  (owner_id, workspace_id, namespace, updated_at, state_key);
```

JSON null is a valid live JSONB value and is distinct from an absent key and a
SQL-null tombstone. Versions are monotonically increasing across delete and
recreate; they must not reset and permit an ABA stale-write overwrite. Physical
purge is an explicit owner/account deletion or retention operation that also
invalidates relevant caches. Ordinary uninstall preserves user-owned documents.

Serialize quota checks with a per-owner transaction lock, including first insert,
so concurrent creates cannot bypass limits. Default limits: 1 MiB UTF-8 serialized
JSON per record, 10,000 live records and 50 MiB per owner/namespace, and 250 MiB per
owner across namespaces. Bound request bytes before parsing; reject JSON nesting
above 64 and duplicate object fields. Tombstones count toward a separate bounded
retention budget and cannot grow unbounded through create/delete loops. Operators
may lower limits; built-ins get the same defaults as external plugins.

## HTTP and plugin APIs

Base: `/api/workspaces/{workspace}/plugin-state/{namespace}`. Every operation
requires authentication, workspace ownership and a matching capability. External
plugin callbacks additionally require the registered workload identity, active
installation, and consent for `state.read` or `state.write` in that namespace.
Built-in status does not bypass tenant checks. Never accept an arbitrary namespace
from a plugin callback when constructing an authenticated host request.

- `GET /{key}` returns a record and ETag containing its numeric version; absent or
  deleted returns 404. A conflict response may include an authorized tombstone.
- `GET ?cursor=...&limit=100` returns a stable key-ordered page, maximum 200;
  cursors are opaque and bound to owner, workspace, namespace and filters.
- `PUT /{key}` includes `expectedVersion`, schema metadata, and `value`.
  `expectedVersion: 0` is create-only; updates require the last observed version.
- `DELETE /{key}?expectedVersion=7` creates a tombstone at version 8. Repeated
  requests with the old version conflict; callers reconcile a lost response by
  reading changes rather than blindly deleting a subsequently recreated record.
- `GET /changes?cursor=...` includes tombstones for incremental refresh. The
  implementation must use a commit-ordered change sequence or snapshot protocol;
  wall-clock timestamps alone are not safe cursors under concurrent transactions.
- The public plugin client exposes typed `get/list/set/delete/watch`, exposes
  `syncing/offline/conflict/error` status and never makes callers access storage.

Example create:

```http
PUT /api/workspaces/personal/plugin-state/canvas/board_123
Content-Type: application/json

{"expectedVersion":0,"schemaId":"modulo.canvas.board","schemaVersion":1,
 "value":{"cards":[],"edges":[]}}
```

```json
{"key":"board_123","schemaId":"modulo.canvas.board","schemaVersion":1,
 "version":1,"value":{"cards":[],"edges":[]},"deleted":false,
 "createdAt":"2026-09-05T10:00:00Z","updatedAt":"2026-09-05T10:00:00Z"}
```

A stale write returns HTTP 409 with
`{"code":"STATE_VERSION_CONFLICT","expectedVersion":1,"actualVersion":2}`
and the authorized current record. Invalid schema/JSON returns 400, oversized
requests 413, quota exhaustion 429 with a stable `STATE_QUOTA_EXCEEDED` code,
and denied resource access 404. Authentication failures return 401. No error
reveals another owner's existence, state, quota or version.

Successful mutations append an audit/change record atomically. Events include
actor, plugin identity, workspace, namespace, key, operation, schema/version and
request ID, never stored values or bearer credentials. Publish after commit using
an outbox; delivery failure must not roll back an already acknowledged mutation.
OpenAPI request/response classes must expose these fields and error codes.

## Offline and conflict semantics

Partition persistent cache and queue by server origin, issuer, subject, workspace
and namespace. Render cached data immediately. Each queued mutation retains its
base server version and base document; persist it before reporting a local save.
On logout stop replay, abort outstanding calls and clear in-memory views. A new
account cannot adopt the old account's queue. Retained encrypted/local caches
must remain inaccessible through the new session's client. Recheck the session
generation before applying any in-flight response.

Replay in order per key, with bounded exponential backoff and jitter for transient
failures. Authentication/permission errors stop replay; schema errors and conflicts
require user action. A 409 preserves base, local and remote versions. Never choose
a winner by client clock. Different keys converge independently. Same-key edits
remain visibly conflicted until the user chooses remote, retries a reviewed local
replacement against the current version, or explicitly merges. Delete-vs-update
uses the same rule. An uncertain PUT response is reconciled by comparing the
fetched document and schema before replay; an identical accepted result clears
the queued mutation, while unrelated server changes remain a conflict.

`watch` refreshes on host events and reconnect, with bounded polling fallback.
Interrupted pagination/reconnect performs a snapshot refresh if the change cursor
expired. Dragging and typing debounce network writes while local persistence
retains the latest document; do not issue one request per pointer movement.

Legacy migration is create-only per key. If server data exists, retain it and
present the legacy value as a recoverable import/conflict; do not overwrite newer
server data. Write an account-scoped migration marker after all records are
acknowledged, then remove only successfully imported legacy keys. A marker plus
stable legacy-to-record IDs makes retries idempotent. Browser-global legacy data
must be claimed explicitly by the signed-in user, never silently reassigned on
account switches. Unknown schema versions are read-only and exportable; migration
failure preserves source bytes.

## Backup, encryption and lifecycle

Include state, tombstones, schema identifiers and versions in owner-scoped export
and the PostgreSQL backup. Restore validates all input and remaps ownership to the
authenticated importing owner through an explicit import operation; exported
owner IDs do not grant access. Import uses normal conditional writes and quotas.
Store operational backups and database volumes on encrypted storage with keys
outside the database; TLS protects transport. JSONB is not end-to-end encrypted.
A deployment without encrypted storage must not claim encryption at rest. Plugins
must store secrets in the secret service, not state. Export and recovery UI must
explain that portable JSON exports contain plaintext user data.

Uninstall removes activation/configuration only after a reviewed install plan;
user content is retained by default, with separate explicit data deletion. Pack
rollback restores prior configuration while preserving user-created records.
Backup restore invalidates sync cursors so old queues cannot silently overwrite a
restored version space; use a server storage-generation identifier in the client
cache/handshake and require reconciliation when it changes.

## Threat model

| Threat | Required control and acceptance evidence |
|---|---|
| Namespace escape / impersonation | Strict segment validation; authenticated external identity binds namespace; reserved core namespace; tests for slash, dot traversal, encoded separators and another plugin's namespace. |
| Cross-user read/write | Resolve actor once server-side; owner predicate in every read/list/CAS/delete and cursor; two-user tests including guessed IDs, namespace enumeration and events. |
| Oversized or malicious JSON | Byte/depth/duplicate-key/schema validation before mutation, locked aggregate quota accounting; concurrent quota and malformed-input tests. |
| Stored XSS / prompt injection | Values are untrusted data; render escaped, sanitize supported rich formats, never evaluate as code or instructions, never expand plugin permissions from document fields. |
| Lost updates / stale delete | Atomic expected-version comparison, monotonic tombstones, offline three-way conflict preservation; simultaneous writers and delete/recreate tests. |
| Logout / account-switch leak | Partition by immutable principal and origin, session-generation checks, abort replay; delayed-response and account-switch tests. |
| Audit or backup leakage | Metadata-only event payloads, authorized export, encrypted backup storage and log inspection tests. |

## Review against existing consumers

| Consumer | Record boundary and migration | Reasoning |
|---|---|---|
| Canvas | One named board per key; cards/edges together with stable IDs | Structural edits are atomic; two-client layout conflicts remain recoverable. Debounce pan/drag; linked notes use the existing authorized offline note cache. |
| Database | Schema/config key plus per-row keys | Avoid replacing a whole table for a cell edit; validate row/schema references and plan schema migrations. Page large tables; row versions isolate conflicts. |
| Todos | One task per key, ordered by explicit rank | Independent tasks merge naturally; same-task conflict is explicit. Cross-feature first-class task relations should use the task API, not duplicate records. |
| Time tracking / business records | One entry per key with schema IDs | Avoid aggregate-document quota and overwrite problems; use first-class domain tables for regulated ledger constraints or relational transactions. |
| Saved searches | One query configuration per stable ID | Store filters/sort/view, not duplicate result notes; validate property references before execution. |
| Plugin installations / hub preferences | Host-owned `core.plugins` installation record per plugin and `core.preferences` keys | External plugins cannot self-grant activation or permissions. Dependency checks and consent belong to the host lifecycle service, not mutable plugin JSON. |

Use first-class entities for notes, identities, attachments, relationships, signed
approvals, execution traces and financial invariants requiring server-side joins,
indexes or transactional domain rules. Plugin state is appropriate for bounded
workspace documents; it must not become an authorization escape hatch or a second
copy of the knowledge graph.

## Delivery and verification

This ADR completes the contract/design scope only. Persistence/API is [#417](https://github.com/Ikey168/Modulo/issues/417),
the offline client is [#418](https://github.com/Ikey168/Modulo/issues/418), consumer
migrations are #419–422, and cross-client/backup/tenant acceptance is #423. These
issues remain open until the controls described here are implemented and tested.
