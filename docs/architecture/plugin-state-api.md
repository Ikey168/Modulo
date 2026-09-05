# Plugin state API and external delegation

Implements the server contract from ADR 0008 (#417). The personal host API remains
`/api/workspaces/personal/plugin-state/{namespace}`. It resolves the provisioned
user through the authenticated principal. Browser plugin contexts bind namespaces
to manifest IDs. Browser code shares its origin's authority; external workloads
use the separate delegation API below.

## Schema registration

Before writing a custom schema, the authenticated owner registers an immutable
version with `PUT /api/workspaces/personal/plugin-state-schemas/{namespace}/{schemaId}/{version}`.
The body is a JSON schema definition, limited to 16 KiB. Repeating an identical
registration succeeds; changing a registered version returns 409
`STATE_SCHEMA_IMMUTABLE`. Definitions are private to that owner and namespace.
There is a 1,000-definition budget per owner.

The bounded structural dialect supports `type`, `properties`, `required`, boolean
`additionalProperties`, `items`, `enum`, `minItems`, `maxItems`, `minLength`,
`maxLength`, `minimum` and `maximum`. Types are object, array, string, number,
integer, boolean and null. Unsupported keywords, including `$ref`, `pattern` and
custom executable validators, are rejected. No schema can fetch remote content.
Schema nesting is limited to 16; document parsing retains the 64-level bound,
duplicate-field rejection, strict UTF-8 validation and pre-parsing byte limit.

Built-in v1 schemas cover Canvas boards/preferences, embedded databases, saved
searches, workspace installations/hub tabs and migration markers. Built-in
`modulo.*` schema definitions cannot be replaced by owners or external workloads.
These validate structural storage constraints; consumer validators still enforce
business relationships such as Canvas connection endpoints and database columns.
Unknown schemas/versions return `STATE_UNKNOWN_SCHEMA`; existing data stays
readable and exportable. Same-schema version downgrades are rejected. Migration
must explicitly write a supported version against the current record version.

## Explicit external owner grants

An installed EXTERNAL workload declares `state.read` and/or `state.write` in its
required permissions. The backend registry and active runtime grant must agree.
A workload token identifies the registered plugin; it does not identify a user.

The authenticated owner consents with `POST /api/plugin-state/grants`:

```json
{"pluginId":"example-plugin","permissions":["state.read","state.write"],"lifetimeSeconds":300}
```

The response contains grant metadata and a one-time 256-bit random `token`. Only
its SHA-256 hash is stored. Deliver the token to the intended workload through its
secret configuration channel. Never put either token in URLs, state values or
logs. Grants expire within one hour and are limited to 100 active grants and 1,000
total retained grants per owner. Operators can archive and remove expired/revoked
grant rows when the retained budget is reached; doing so cannot reactivate them.

`GET /api/plugin-state/grants` lists metadata for the authenticated owner without
secrets. `DELETE /api/plugin-state/grants/{id}` revokes an owned grant. The opaque
ID is not an authority token. Revocation serializes with state writes on the
owner lock. Runtime permission removal, workload token rotation, expiry and
plugin deactivation also deny subsequent access.

External callbacks use
`/api/plugin-state/callback/workspaces/personal/{namespace}` with both headers:

```http
X-Modulo-Plugin-Token: <registered workload token>
X-Modulo-State-Grant: <owner-issued grant token>
```

They expose the same GET/list/changes/PUT/DELETE contract and bounded bodies as
the host API. The namespace must equal the authenticated plugin ID. Reserved
`core`, `core.*` and host `workspace-settings` namespaces cannot be delegated.
Reads require `state.read`; writes/deletes require `state.write`. A write-only
version conflict returns the actual version but excludes the existing document.
External callers cannot register schemas or issue their own owner grants.

Unknown, foreign, expired and revoked grants return 404 `STATE_ACCESS_DENIED`.
The callback route permits the HTTP request to reach this dual-token check; it
does not bypass the check when a browser happens to be signed in.

## Atomic audit and private delivery

Each accepted mutation appends a metadata event in the same PostgreSQL
transaction: owner, workspace, namespace, key, operation, record/schema versions,
actor plugin (`host` for the browser API), and a server-generated request UUID.
The event table stores no document values or bearer tokens. A 100,000-event
budget per owner stops unbounded update churn with `STATE_EVENT_QUOTA_EXCEEDED`;
rows are retained until an explicit retention/cursor-reconciliation policy is
installed. Do not silently purge history underneath existing client cursors. Per-owner locking
orders changes before sequence allocation, preserving the authorized change
cursor across concurrent commits.

The outbox polls committed rows with `FOR UPDATE SKIP LOCKED` and sends metadata
to the owner's `/user/queue/state`. It records successful attempts and retries
transport failures with bounded exponential backoff. Delivery is at least once;
consumers deduplicate by event ID. It never broadcasts these events on the global
plugin bus, whose listeners do not have owner-specific authority. External
plugins receive durable events through their grant-authorized changes endpoint.

A disconnected browser recovers through the existing owner-scoped snapshot polling; a
successful broker send is not proof that an offline browser received an alert.
Historical events remain in the change feed and are not re-announced as socket
alerts during V5 migration. The worker is disabled in the `test` profile and can
be disabled operationally with `modulo.state.delivery.enabled=false` without
stopping durable writes or polling. No production migration or credential
provisioning is performed by compiling or testing this change.

## Restore generation handshake

Before mutations, read `GET ?generation` on the namespace endpoint and include its
UUID as `X-Modulo-State-Generation` on PUT and DELETE. The authenticated external
callback supports the same handshake, including write-only grants. Missing headers
receive 428 `STATE_STORAGE_GENERATION_REQUIRED`; stale generations receive 412
`STATE_STORAGE_GENERATION_CHANGED`. See the [restore procedure](../operations/state-acceptance.md).
