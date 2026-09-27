# Runbooks

Step-by-step procedures for operating a running Modulo instance: checking a
deployment, managing Keycloak users, migrating identity providers, handling
workflow alerts and dead letters, restoring plugin state, and verifying the WASM
script sandbox. Each section says when to use it. Deployment, backups and
security findings have their own pages:
[Deployment](deployment.md), [Database operations](database.md),
[Security testing](security-testing.md). A suspected breach goes to
[Incident response](../security/incident-response.md).

## Post-deploy smoke test

Use after every release, restore, or identity change.

### Automated gate (OCI)

```sh
cd /srv/modulo/deploy/oci
MODULO_URL=https://modulo.example.com ./status.sh
python3 verify-deployment.py --url https://modulo.example.com --token-file /secure/token
```

`verify-deployment.py` fails closed unless all of these hold: frontend `/health`
and backend `/api/health` return 200; `/runtime-config.js` names
`<URL>/auth/realms/modulo` as issuer; OIDC discovery answers; anonymous
`GET /api/notes` is rejected (401/403); with the token, a uniquely named note is
created, read back byte-for-byte, deleted, and then returns 404. The token must
come from a normal browser login of a dedicated test user: the `modulo-frontend`
client is public, uses PKCE (S256), and has direct password grants disabled.

### Manual checks

Run these when the identity setup changed (new realm, new issuer URL, new client)
or when the automated gate is not available.

| Area | Check | Expected |
|------|-------|----------|
| Keycloak | `curl -s <issuer>/.well-known/openid-configuration` | JSON whose `issuer` equals the configured issuer exactly |
| Keycloak | Admin console at `<URL>/auth/admin/` (OCI, Pi) or `:8180/admin` (local) | Loads; `modulo` realm present |
| Login | Browser login as a normal user | Returns to the app, no redirect loop |
| Token | Decode the access token | `iss` is the browser-facing issuer, `aud`/`azp` is `modulo-frontend`, realm roles present, `exp` about 15 minutes out (`accessTokenLifespan` 900 s) |
| Backend | `GET /api/notes` without token | 401 or 403 |
| Backend | `GET /api/notes` with token | 200 |
| Isolation | Two accounts, same tag name, private notes | Neither sees the other's notes, tags, files or graph |
| WebSocket | Open a note in two tabs, edit in one | Update arrives in the other; a signed-out tab stops receiving |
| Logout | Sign out, press Back | App requires login again |
| Headers | `curl -sI <URL>` | `X-Content-Type-Options: nosniff`, no `Server` header (OCI) |
| Rate limit | Burst requests from one IP | 429 after the configured limit |

Record the date, release digests, who ran it, and any failures with the change
record.

## Keycloak user and role operations

Use for day-to-day account administration. The realm is `modulo`; its roles are
`admin`, `editor`, `viewer`, `plugin-developer` and `plugin-reviewer`.

[`scripts/admin-utils.sh`](../../scripts/admin-utils.sh) calls the Keycloak admin
REST API. It needs `KEYCLOAK_ADMIN_PASSWORD` and defaults to
`KEYCLOAK_URL=http://localhost:8080`; set `KEYCLOAK_URL` to the real base URL
(`http://localhost:8180` locally, `https://<host>/auth` on OCI and the Pi).

| Command | Purpose |
|---------|---------|
| `create-user <username> <email> <first> <last> [temporary=true] [password]` | Create a user, temporary password by default |
| `bulk-create-users <csv> [default_role]` | CSV `username,email,first_name,last_name,password` |
| `disable-user <username> [reason]` | Disable an account |
| `reset-password <username> <new_password> [temporary] [notify]` | Reset a password |
| `assign-role <username> <role> [justification]` | Grant a realm role |
| `bulk-assign-roles <csv>` | CSV `username,role_name,justification` |
| `audit-user-permissions <username> [detailed]` | Roles and effective permissions |
| `export-audit-trail [period] [file]` | Admin events to CSV |
| `test-auth-flow <username> [client_id]` | Exercise login for a user |
| `validate-oidc-config [client_id]` | Check discovery and client settings |
| `health-check`, `quick-status` | Keycloak and realm status |

Example:

```sh
KEYCLOAK_URL=http://localhost:8180 KEYCLOAK_ADMIN_PASSWORD=admin \
  ./scripts/admin-utils.sh create-user jane jane@example.com Jane Doe
```

Removing access immediately (departing user, suspected compromise):

1. `admin-utils.sh disable-user <username> "<reason>"`.
2. In the admin console, Users → the user → Sessions → **Sign out** all sessions.
   Access tokens already issued stay valid until they expire (15 minutes).
3. If the account owned plugins or workflows that act on schedules, review them
   in the Execution Center.

Rules:

- Grant the least role that works. `admin` is for operators only.
- Record the reason for every role grant (the `justification` argument).
- Rotate the Keycloak admin password after anyone with access leaves, and keep it
  out of shell history (export it from a secret file).

Login problems:

| Symptom | Check |
|---------|-------|
| Redirect loop or "invalid redirect_uri" | The app's origin must be in the client's redirect URIs. Locally allowed: `localhost:3000`, `:3001`, `:5173`, `:80`, and the Android `com.modulo:/oauth2redirect`. |
| Login works, API returns 401 | Issuer mismatch between the token and `MODULO_SECURITY_KEYCLOAK_ISSUER_URI`, or the backend cannot reach `MODULO_SECURITY_KEYCLOAK_JWK_SET_URI`. |
| API returns 403 for a known user | The account is not provisioned in Modulo (unknown subjects fail closed), or the role is missing. |
| Changed the public URL, login broke | The imported realm still has the old URLs. Update the client's redirect URIs and web origins; imports do not overwrite an existing realm. |
| Events needed | Enable login events on the realm, then read them under Events in the admin console. |

Realm backup: on OCI, Keycloak's data lives in the `keycloak` PostgreSQL database
and is included in the nightly `pg_dumpall`. For a portable copy of realm
settings, use Realm settings → Action → **Partial export** in the admin console
and store it with the deployment secrets.

For local extra demo users, roles, a confidential backend client, or Google and
GitHub identity providers, see
[`scripts/bootstrap-dev.sh`](../../scripts/bootstrap-dev.sh) in
[Local development](../getting-started/local-development.md#keycloak-only).

## Identity provider migration (legacy OAuth to Keycloak)

Use when users who signed in with the older Google or Azure OAuth login move to
Keycloak. [`AuthMigrationService`](../../backend/src/main/java/com/modulo/user/AuthMigrationService.java)
links provider subjects to existing users on login.

Settings: `modulo.auth.dual-auth-enabled` (true in `application.properties`),
`modulo.auth.default-provider` (`KEYCLOAK`), `modulo.auth.migration-grace-period-days` (30).

What happens on a user's first authenticated request (the backend provisions
accounts just in time from the Keycloak bearer token; a known user is found by
Keycloak subject):

| Case | Result | Status |
|------|--------|--------|
| New user | Created with this provider as primary | `MIGRATED` |
| Known user, same provider | Last-login updated | unchanged |
| Known user matched by a verified email, new provider, dual-auth on | Provider added; if it is Keycloak it becomes primary | `DUAL_AUTH` |
| Known user matched by a verified email, new provider, dual-auth off | Providers replaced by the new one | `MIGRATED` |
| Several users share the email | Canonical user chosen, data merged, duplicates removed | `CONFLICT_RESOLVED` or `MANUAL_REVIEW` |

Admin endpoints ([`AuthMigrationController`](../../backend/src/main/java/com/modulo/user/AuthMigrationController.java),
`ADMIN` role). The controller maps `/auth/migration`, so the full path is
`/api/auth/migration/...` under the default `/api` context path and
`/auth/migration/...` where the context path is `/` (the Compose deployments,
where the edge proxy does not route it; call the backend directly).

| Method and path | Purpose |
|-----------------|---------|
| `GET /auth/migration/status?email=&userId=` | One user's status |
| `GET /auth/migration/statistics` | Counts by status and provider |
| `GET /auth/migration/manual-review` | Users needing review |
| `GET /auth/migration/dual-auth` | Users in the dual-auth period |
| `POST /auth/migration/resolve-conflict` | Merge a conflict onto a chosen canonical user |
| `POST /auth/migration/force-migrate` | Force a user to a provider |
| `GET /auth/migration/users-by-provider` | Users grouped by provider |
| `POST /auth/migration/settings` | Change migration settings at runtime |

Procedure:

1. Deploy with dual-auth on and Keycloak configured. Test every case above in
   staging.
2. Tell users the timeline. Watch `statistics` and work through `manual-review`.
3. After the grace period, keep Keycloak as default. The backend no longer
   offers server-side Google or Azure login, so legacy subjects only matter for
   accounts that have not yet signed in through Keycloak.

A token's email links to an existing account only when Keycloak marks it
verified (`email_verified`); an unverified email creates a separate account.
An email match links a login identity; it is not evidence of ownership of legacy
notes. Assign legacy notes with the reviewed backfill in
[Database operations](database.md#assigning-legacy-notes-to-owners).

Debug logging: `LOGGING_LEVEL_COM_MODULO_SERVICE_AUTHMIGRATIONSERVICE=DEBUG`.

## Workflow operations

Use when a workflow alert fires, a schedule is late, or runs pile up in dead
letter. Background on the workflow engine is in
[Workflows and approvals](../features/workflows-and-approvals.md).

### Owner-level alerts and retention

Each Blueprint owner sets, in the Execution Center under **Alerts and
retention** (API `GET|PUT /api/workflow-ops/policies/{blueprint}`):

| Setting | Range | Default |
|---------|-------|---------|
| Failure threshold (failed or dead-letter runs) | 1–1000 | 3 |
| Window | 1–1440 minutes | 15 |
| Routing | off, Execution Center, notification inbox | off |
| History retention after completion | 7–365 days | 90 days |
| Replay payload retention | 1 hour up to the history limit | 2160 hours (90 days) |

Alerts are deduplicated per workflow and time bucket; creating the alert and the
inbox item commit together. Payloads carry counts and workflow IDs only, never
node inputs, secrets or exception text. `GET /api/workflow-ops/alerts` lists them
and `POST /api/workflow-ops/alerts/{id}/read` clears one. Alerts older than 90
days are deleted.

Hourly retention (`WorkflowRetention`) deletes eligible terminal checkpoints and
strips note references from step summaries while keeping timing, state and type
counts. Active and waiting runs keep their checkpoints. A retried run keeps an
immutable parent ID, so lineage survives the parent's expiry (following it shows
a retention-gap message). A run whose checkpoints have expired cannot be replayed.

`GET /api/workflow-ops/schedules` lists the signed-in owner's recurring schedules,
including disabled ones: Blueprint, trigger node, cron, time zone, next fire time,
retry policy and last delivery state.

### Metrics

Gauges refresh every 30 s. Every replica reports the same database-wide values,
so dashboards use `max`, not `sum`. The rates are already rolling gauges; do not
wrap them in `rate()`.

| Metric | Meaning |
|--------|---------|
| `modulo_workflow_runs{state}` | Retained runs per state (eight states) |
| `modulo_workflow_run_rate{state}` | Runs per second over the last five minutes (completion time for completed runs) |
| `modulo_workflow_run_latency_seconds{quantile}` | Completed-run p50/p95/p99 over five minutes, including intentional waits |
| `modulo_workflow_retries` | Retained attempts with a parent |
| `modulo_workflow_queue_depth` | Pending or running schedule deliveries |
| `modulo_workflow_schedule_lag_seconds` | Worst lateness of an enabled, active schedule |
| `modulo_workflow_alerts_unread` | Unread workflow alerts |

That is 23 series per instance, with no owner, Blueprint, run, step, node or
error labels. Keep it that way: high-cardinality labels here would be a
regression. Import `monitoring/grafana/dashboards-available/workflow-executions.json`
for a dashboard.

### Responding to alerts

| Alert | Condition | Do this |
|-------|-----------|---------|
| `WorkflowFailureBurst` | Failed or dead-letter rate > 0.01/s (about 3 per 5 min) for 1 min | Filter the Execution Center by failures and read the recorded error class. Look for a shared cause (credential expired, external API down, a recent Blueprint edit). Fix the cause before retrying. |
| `WorkflowDeadLetters` | Any run in `DEAD_LETTER` for 1 min | Manual recovery (below). |
| `WorkflowScheduleLag` | Lag > 60 s for 2 min | Check dispatcher health in the logs, database connectivity and long-running actions. Only one replica dispatches at a time (PostgreSQL advisory lock), so a stuck leader stalls schedules for all. |
| `WorkflowQueueBacklog` | Queue depth > 100 for 5 min | Look for hot schedules (too-frequent cron) and slow actions before adding capacity. |

### Recovering dead-letter runs

Runs reach `DEAD_LETTER` when retries are exhausted (`RETRY_EXHAUSTED`), the
error is non-retryable (`NON_RETRYABLE`), or the dispatcher that owned them was
lost (`WORKER_LOST`). The scheduler never silently replays uncertain work.

1. Open the run in the Execution Center (`GET /api/workflow-runs/{id}`) and read
   the error class and the last completed step.
2. Check side effects the failed step may already have caused (email sent, note
   written, external call made). For `WORKER_LOST` assume the step might have run.
3. Fix the cause.
4. Retry with `POST /api/workflow-runs/{id}/retry` (the new run references the
   original as parent), or cancel with `POST /api/workflow-runs/{id}/cancel`.
5. If the replay payload has expired, rerun the Blueprint from its trigger
   instead.

### Load gate

With Java 17, Maven and Docker:

```sh
scripts/workflow-load-test.sh
```

It uses a disposable PostgreSQL 16 container with synthetic data: 10,000 runs
with high-cardinality step IDs, 100 simultaneously due schedules enqueued twice,
then a full metric refresh. It requires exactly 100 delivery records, 23 series,
no unbounded tag keys, correct counts, and under 30 s for enqueue plus refresh.
It measures dispatch bookkeeping and metric aggregation only, not external
service latency or peak throughput. The same test runs in the normal backend
suite.

## Plugin state: backup, restore and acceptance

Use when restoring a database that holds plugin state, or before releasing
changes to the state API or clients. The state API itself is described in
[Data and state](../architecture/data-and-state.md).

### Why restores need a generation rotation

Every state-aware client caches records and may hold pending offline writes.
Migration V6 added a storage generation UUID. Writes must send the current
generation in `X-Modulo-State-Generation` (obtained from
`GET /api/workspaces/personal/plugin-state/{namespace}?generation`); a missing
generation gets 428, a stale one 412. After a restore the generation changes, so
clients notice, refresh their reads, and turn every pending mutation into an
explicit conflict against the restored value instead of silently overwriting it.
Offline clients keep their queue until that handshake succeeds.

### Procedure

Database exports contain plaintext. Keep archives on access-controlled, encrypted
storage. Use standard libpq variables (`PGHOST`, `PGUSER`, `PGPASSWORD`) for the
connection.

```sh
PGDATABASE=modulodb ./scripts/state-backup.sh backup /secure/backup.dump

# stop API writers; restore into a NEW empty database, never over live traffic
createdb restored_modulo
PGDATABASE=restored_modulo ./scripts/state-backup.sh restore /secure/backup.dump
```

The restore is transactional and stops on any SQL error. Before it returns it
rotates the storage generation, revokes restored owner grants, and marks
historical outbox rows as delivered. Point the application at the restored
database only after the script succeeds. Records and schemas keep their original
versions and owners.

- An archive from before V6 needs the normal schema migrations, then the same
  generation rotation and grant revocation, before traffic resumes. The script
  refuses to run without the V6 table rather than report an unfenced restore as
  successful.
- A restore that bypasses the rotation (for example a raw `pg_restore`) loses the
  conflict guarantee. Use this procedure for every restore that includes plugin
  state, including full-database restores from
  [Database operations](database.md#restoring-for-real).
- Deploy the V6 migration and the updated clients together.

### State API error codes to expect

| Code | Meaning |
|------|---------|
| 409 `STATE_VERSION_CONFLICT` | Stale `expectedVersion`; body has expected and actual versions and the caller's current record |
| 400 | Malformed body (bad UTF-8, duplicate members, deep nesting, trailing data) |
| 413 | Body over the limit |
| 428 `STATE_STORAGE_GENERATION_REQUIRED` | Missing generation header |
| 412 `STATE_STORAGE_GENERATION_CHANGED` | Stale generation (after a restore) |
| 429 | Owner quota exhausted |
| 403 | Unprovisioned principal |
| 404 `STATE_NAMESPACE_NOT_AVAILABLE` | Workspace other than `personal`, or a reserved `core`/`core.*` namespace |

### Acceptance suite

[`state-acceptance.yml`](../../.github/workflows/state-acceptance.yml) runs on PRs
and pushes to `main` without any identity provider, cloud storage or public API:
PostgreSQL runs in Testcontainers and fixture tokens are signed with a test-only
key. Diagnostics are uploaded as `state-acceptance-diagnostics` for 7 days. It
covers two authenticated owners over HTTP, invalid and expired auth, conditional
writes and conflicts, custom-format backup and restore into an empty database
with restart, owner-partitioned offline queues with ordered replay, quota
failures, delayed acknowledgements, explicit conflict decisions, and recovery
exports across account switches.

Run it locally:

```sh
mvn -f backend/pom.xml -Dtest=StateAcceptanceTest,PluginStateStoreTest,PluginStateContractTest,SchemaMigrationTest test
npm ci --workspace frontend --include-workspace-root
npm run test:run --workspace frontend -- \
  src/services/__tests__/stateAcceptance.test.ts \
  src/services/__tests__/pluginStateClient.test.ts \
  src/features/workspace/__tests__/operationalState.test.ts \
  src/features/workspace/__tests__/useOperationalCollection.test.tsx
npm run typecheck --workspace frontend
```

It proves the shared web/desktop client against the real HTTP and storage
boundary. It is not a packaged Electron smoke test and does not certify a
deployment's encryption, RPO or RTO. It never touches a production account.

## WASM script sandbox

Use when changing the sandbox, upgrading QuickJS or the WASM runtime, or
validating a new deployment target.

`action.code.execute` runs only in QuickJS compiled to WebAssembly
([`WasmScriptSandbox`](../../backend/src/main/java/com/modulo/blueprint/sandbox/WasmScriptSandbox.java)).
The Rhino engine and its dependency are gone; `modulo.blueprint.sandbox` accepts
only `wasm`, and any other value stops startup. Limits: 32 MiB guest memory
(512 pages), 2 s wall clock, a fresh engine per run, capped output. When a
healthy external `script-sandbox` plugin is attached, scripts run there instead,
and only transport failures fall back to the in-process engine; script errors are
returned as results and never retried locally. User-visible behaviour
differences from Rhino are in [WASM node ABI](../reference/wasm-node-abi.md).

Release check:

```sh
cd backend
mvn -Dtest=ScriptSandboxConfigTest,ScriptSandboxContractTest,BlueprintInterpreterServiceTest test
grep -Rn "org.mozilla" src/main/java pom.xml     # must print nothing
mise run check-wasm                              # from the repo root: WASM example fixtures
```

The stack is pure Java (no JNI), so the same image runs on arm64 (Pi, OCI A1).

Two checks cannot be reproduced from a checkout and must be recorded from the
real environment, never substituted with local test runs:

- a staging (or production canary) deployment carrying real
  `action.code.execute` traffic for one release cycle without sandbox-attributed
  regressions;
- a run on actual arm64 hardware for the Pi/minimal path.
