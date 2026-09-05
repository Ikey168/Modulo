# Structured workflow runs

Issue #424. V7 adds `workflow_runs` and `workflow_steps`. Each registered trigger
receives a stable UUID run ID, owner, Blueprint version and canonical IR digest,
trigger identity, state and timestamps. Note/link event IDs deduplicate repeated
delivery to the same trigger; scheduled firings and individual webhook requests
have distinct trigger keys. Webhook request retry policy is tracked separately
with execution recovery; two separate requests are two triggers.

Steps have an explicit sequence, node ID/type and attempt. The trigger itself is
step 1. Subsequent node invocations are persisted before execution and finish with
success, failure or capability-denied skip. Run history reads node IDs from these
rows. Historical `plugin_execution_logs` remain available through the owner-scoped
history adapter; new runs no longer depend on parsing log messages.

## Authority and legacy data

Blueprints have a persisted owner and a per-owner public name. Internal registry
names are unique generated identifiers, allowing two owners to choose the same
name. CRUD, permission lookup and execution history resolve the authenticated
owner. Runtime registrations use registry IDs, so identical display names do not
replace each other's listeners. Note/link events must belong to the registered
owner before a run is created. Scheduled execution establishes the persisted
user's identity for existing note/tag APIs; node capability grants still apply.

V7 does not infer ownership from historical author strings. Unowned Blueprints
are preserved and excluded from activation. To adopt one, review its IR, history,
owner identity and capabilities; assign `owner_id` and `blueprint_name` in a
transaction with an `owner_id IS NULL` predicate. Revoke old capability grants and
rotate webhook secrets before setting it ACTIVE and re-registering it. Perform
this as a reviewed operator migration, not a browser import. The original logs
and configuration history are preserved by V7.

## Transitions, retries and retention

Runs transition QUEUED → RUNNING → SUCCEEDED/FAILED/CANCELLED, with WAITING and
RETRY_WAIT as non-terminal states. WAITING can resume RUNNING; RETRY_WAIT resumes
RUNNING with an incremented attempt. PostgreSQL triggers reject terminal
regressions and invalid attempt changes even if a caller bypasses the service.
Steps use the same non-terminal states plus SKIPPED; `(run, sequence, attempt)`
is unique. Durable scheduling/retry workers and user-facing recovery are tracked
by the later Execution issues; this change supplies their persistence model.

An owner can retain up to 10,000 runs. Terminal runs expire after 90 days and an
hourly cleanup cascades their steps. Waiting/active runs are never silently purged.
Operators can disable cleanup with `modulo.workflow.retention.enabled=false` or
change a reviewed run's `retain_until`. Deleting a Blueprint retains its run
provenance while clearing the foreign key; deleting the owner cascades run data.
Legacy logs retain their existing lifecycle.

Input/output metadata contains bounded field counts and type counts, plus at most
16 references to notes owned by the run owner. Raw strings, property names,
credentials, note contents and exception messages are excluded. JSONB metadata is
limited to 4 KiB per input/output column. The nullable `payload_ref` column reserves
an opaque reference for later artifact storage; it never triggers URL fetching.
Tracing and capability-aware diagnostic expansion are tracked in #425.

## Verification

PostgreSQL tests cover concurrent trigger deduplication, owner isolation and name
collisions, ordered real-interpreter steps, metadata bounds, impossible
transitions, retry attempts, retention/cascades and unchanged legacy-log access.
Existing interpreter tests verify normal actions, capability denial and loop
bounds against structured run completion. Flyway tests cover fresh migration and
adoption of an existing baseline.

## Node diagnostics (#425)

Each executed node, including the trigger, has a generated step UUID, monotonic
`duration_ms`, and terminal state. Capability denial records `SKIPPED`; rejected
WASM modules, script errors, and failed AI/blockchain calls fail the step and run.
Execution stops at that failure. An unselected branch has no executed step.

`TracePolicy` persists field counts and bounded type counts, never arbitrary
input/output keys, values, note contents, or exception messages. It inspects at
most 256 values and emits at most 16 owned note references when the current
execution context permits references. Default identifier redaction recognizes
credential markers and email addresses. Operators can add semicolon-separated
literal markers with `modulo.workflow.trace.redact-patterns` (16 markers, 128
characters each, 2048 total); these are literal case-insensitive matches, not
regular expressions. Matching identifiers become stable SHA-256-derived labels.

`ExecutionTraceContext` scopes generated run/step IDs and restores MDC on exit.
The backward-compatible gRPC Execute fields `correlation_id` and `step_id` carry
these IDs to external plugins. The script sandbox echoes valid UUIDs in response
metadata. Calls outside a workflow omit correlation fields. Runtime diagnostics
exclude raw script/transport exception messages; authorized script error responses
are separate from persisted traces and application logs.

The focused suite includes real PostgreSQL migrations, failed WASM execution,
owned reference redaction, nested context cleanup, and real localhost gRPC
correlation. A bounded summary benchmark reports time per operation for a
10,000-field input with only 256 inspected fields; database and network latency
are additional costs.

## Execution Center (#426)

`/app/executions` lists the signed-in owner's retained runs. Server-side filters
cover text, state, Blueprint ID, trigger type, inclusive start date, exclusive end
date, and minimum duration. Run pages are capped at 100 rows; step timeline pages
are capped at 100 rows. The owner predicate applies to list, aggregate counts,
detail, and every step/path query. Missing, deleted and foreign runs return the
same unavailable response.

Dashboard workflow counts and activity use these run records. Blueprint edits
are no longer presented as workflow executions. Deep links include the run UUID
and optional node ID; the editor loads the run's authoritative Blueprint identity
and highlights the recorded path. This opens the current graph and explicitly
warns that historical nodes may have changed. Deleted Blueprints retain their
run evidence but cannot open an editor link. The UI only renders recognized
summary counts and labels values as redacted.

## Recovery controls (#427)

The authenticated owner can request cancellation from the Execution Center or
`POST /api/workflow-runs/{id}/cancel`. The request records the owner and timestamp.
Queued/waiting runs cancel immediately; an in-flight action may finish. The next
step boundary stops execution, and a final success transition atomically honors
an already-persisted cancellation request. Cancellation never claims to undo an
external effect or interrupts an action midway through a write.

`POST /api/workflow-runs/{id}/retry` accepts a UUID `requestId`, a listed
`checkpoint` sequence, and `confirmSideEffects`. A retry creates a new run linked
to the original with an incremented attempt and recorded requester/confirmation.
The same request UUID returns the same retry. Original traces remain unchanged.
Checkpoint zero replays from the start of the action path; later checkpoints
resume at a recorded boundary using the pinned graph and prior pin values.
Current capability grants still apply. Note references must still exist, belong
to the owner, and have the captured version; changed inputs reject replay.

The conservative action policy treats every non-logic/non-trigger operation as
potentially non-idempotent. Replaying a completed or uncertain failed operation
requires explicit confirmation. This includes note writes, remote calls and
blockchain actions. It is not an exactly-once guarantee for an external system:
a remote timeout can occur after an effect. The external Execute RPC has no
automatic retry. Resuming after a completed action avoids replaying that action.

Webhook senders can supply `Idempotency-Key` (1–128 printable characters). The
same key at the same owner's Blueprint trigger resolves to the same protected
run. Without a key, each request is a distinct delivery. Event deliveries retain
their event IDs; retry requests have their own keys and lineage.

Checkpoints are private execution payloads in `workflow_checkpoints`, never
trace API data. They contain the pinned graph, scalar payloads and versioned
owned note references. Each is limited to 1 MiB and each run to 4 MiB. Unsupported,
oversized, or unavailable snapshots disable that replay boundary; historical runs
without checkpoints remain inspectable. They cascade-delete with retained runs.
Backups therefore include private workflow payloads and need the same protection
as notes. Recovery after a crashed worker is addressed by the durable scheduler.
