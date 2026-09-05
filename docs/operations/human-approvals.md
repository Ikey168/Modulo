# Human approval runtime

The request, wait, and result nodes implement the single-reviewer policy in
[ADR 0009](../architecture/adr-0009-human-approval-contract.md).
Import [the sample Blueprint](../blueprint/examples/approval-request.json), replace
reviewer ID `2` with an existing different user, and grant the Blueprint the
`approval:request` capability. Connect business actions to the result node's
approved, rejected, or expired execution output as appropriate.

A request persists its run, attempt, Blueprint digest, private resume nonce,
checkpoint, evidence digest, and reviewer selection. The wait node commits a
durable pause. A decision schedules continuation of that same run; a restarted
worker reconstructs the checkpoint. Decisions do not execute actions directly.

The persisted node selection seeds a reviewer grant only when no grant exists.
An owner can revoke it with `PUT /api/approvals/grants/{blueprint}/{reviewer}` and
`{"enabled":false}`. Execution never silently restores a revoked grant. Reviewer
eligibility, capability, separation of duties, expiry, Blueprint digest, and
owned note evidence are checked again when committing a decision. Note rows are
locked while their evidence is checked. Competing decisions serialize on the
request; exact idempotent replays return the original receipt.

Authenticated clients use `GET /api/approvals` and `GET /api/approvals/{id}`.
Only the owner and currently designated eligible reviewer can read a request.
Reviewers receive a safe summary and authorized decision history, without raw
inputs, note contents, private checkpoint data, or general access to the run.
`POST /api/approvals/{id}/decision` accepts `expectedRevision`, a UUID
`idempotencyKey`, `outcome` (`APPROVE` or `REJECT`), and `comment`. Rejection requires
a comment. Comments are normalized to NFC and limited to 4096 UTF-8 bytes.
Owners cancel with `POST /api/approvals/{id}/cancel`.

Expiry is 60 seconds to seven days, defaulting to 24 hours. Up to three optional
inbox reminders are spaced at least one hour apart. The worker reconciles
cancellation, reviewer revocation, capability revocation, and Blueprint changes.
An expired request follows the expired result output. Invalidated requests do
not authorize continuation. After a run has requested approval, manual retry
must start at checkpoint zero and issue a fresh request.

Decisions are immutable database records and are explicitly **UNSIGNED** at this
stage. Cryptographic signing and portable evidence verification are separate
features; an evidence digest alone is not a signature.

Validation uses PostgreSQL with all Flyway migrations and the real interpreter:
restart/resume, competing decisions, authorization, stale and duplicate requests,
revocation, changed evidence, expiry, cancellation, and fresh approval on retry.
The editor fixture verifies typed request/decision pins and result branches.

## Reviewer inbox

Open **Approvals** in the workspace, or follow an approval notification. Pending
requests show expiry times; the status filter includes resolved history. Details
show only the authorized summary, evidence digest, request events, and decision
history. Workflow state refreshes every ten seconds so reviewers can observe
continuation without receiving access to private execution details.

Choose a decision, enter a reason (required for rejection), and explicitly
confirm it. Changing the choice or reason clears confirmation. The client keeps
the same idempotency key when retrying an unchanged submission after a network
failure. A conflict refreshes server state and requires review before another
submission. Resolved requests have no decision form.

The inbox uses labeled native controls, a focused detail heading, live status
messages, and a single-column mobile layout. Run the browser keyboard and mobile
checks with `cd frontend && npx playwright test --config playwright.approvals.config.ts`.
The browser fixture mocks the service; PostgreSQL integration tests separately
exercise authorization and durable continuation.
