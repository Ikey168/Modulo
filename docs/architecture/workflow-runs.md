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
