# Praxis control plane

Issue: [#525](https://github.com/Ikey168/Modulo/issues/525). Contract: krasforge/praxis
[`docs/host.md`](https://github.com/krasforge/praxis/blob/claude/ecstatic-fermi-8wazc9/docs/host.md)
and `docs/api.md`. Code: `backend/src/main/java/com/modulo/integrations/praxis/`,
`frontend/src/features/praxis/` (the **Praxis Tasks** view under Tools → Automation).

```
Browser / Android ──Modulo session──▶ Modulo backend ──mTLS + bearer token + X-Praxis-On-Behalf-Of──▶ Praxis host
```

Modulo's backend is one **delegating client** in Praxis. The browser never sees a Praxis
credential and never names a user.

## Configure Modulo

In Praxis, add Modulo as a client with `delegate = true`:

```sh
python -m praxis.host token --client modulo   # [[clients]] block on stdout, the token on stderr once
```

Give the client `roles = ["submit", "read", "control", "approve", "publish"]`. Praxis
stores only the token's SHA-256 digest.

In Modulo, mount the secrets and set:

| Variable | Meaning |
| --- | --- |
| `MODULO_PRAXIS_ENABLED` | `true` to turn the integration on (off by default) |
| `MODULO_PRAXIS_URL` | Praxis origin, e.g. `https://praxis.internal:8443`. `https` is required unless the host is loopback |
| `MODULO_PRAXIS_CA_FILE` | PEM of the internal CA that issued the Praxis server certificate. It is the only trust anchor for this connection |
| `MODULO_PRAXIS_CLIENT_CERT_FILE` | Modulo's client certificate (chain), issued by the CA Praxis trusts in `server.tls_client_ca` |
| `MODULO_PRAXIS_CLIENT_KEY_FILE` | Its key as unencrypted PKCS#8 (`BEGIN PRIVATE KEY`). Convert others with `openssl pkcs8 -topk8 -nocrypt -in modulo.key -out modulo.pk8.key` |
| `MODULO_PRAXIS_TOKEN_FILE` | File holding the bearer token. Without it, the token is read from `PRAXIS_MODULO_TOKEN` |

Only paths go in configuration; the certificate, key and token stay in the secret store.
With the integration enabled, a missing or invalid file stops the server at startup
instead of failing on the first user request.

**Rotation.** The token file is re-read when it changes, so Praxis' rotation (list both
digests, `SIGHUP`, switch Modulo, drop the old digest, `SIGHUP`) needs no Modulo
restart. A new client certificate or CA needs a restart.

**Executors.** Modulo's client has no `health` role, so it cannot ask Praxis which
controls an executor supports. The defaults mirror each adapter's `ExecutorFeatures`:
`fake` cancel; `local` cancel, signal and suspend; `codex` cancel; `claude`, `deepseek`
and `remote` none. Override or add with `modulo.praxis.executor-features.<name>=cancel,suspend`.
Only listed executors can be chosen when submitting.

## Identity

`X-Praxis-On-Behalf-Of` is always `user-<Modulo account id>`, taken from the verified
session by `AuthenticatedUserService`. No request body, parameter or header can change
it: Praxis trusts this header from Modulo. Praxis audits actions as `modulo/user-<id>`,
and a user reaches only the processes they submitted. The account id is used instead
of a username or email because Praxis ties process ownership to it, and an account can
be renamed.

## Routes

| UI | Modulo | Praxis |
| --- | --- | --- |
| Start task | `POST /api/praxis/processes` with `Idempotency-Key` | `POST /v1/processes` |
| Task list | `GET /api/praxis/processes` | (none; Modulo records its submissions in `praxis_submissions`) |
| Status and result | `GET /api/praxis/processes/{id}` | `GET /v1/processes/{id}` |
| Subtasks | `GET /api/praxis/processes/{id}/tree` | `GET /v1/processes/{id}/tree` |
| Live progress | `GET /api/praxis/processes/{id}/events` (SSE, `Last-Event-ID` or `after`) | `GET /v1/processes/{id}/events` |
| Cancel / suspend / resume / retry | `POST /api/praxis/processes/{id}/control` with `attemptId` | `POST /v1/processes/{id}/control` |
| Approvals | `GET`/`POST /api/praxis/processes/{id}/approvals` | same path |
| Publish to knowledge base | `POST /api/praxis/processes/{id}/publication` | same path |

- **Submission.** The UI creates one idempotency key per task form. A retry after a lost
  response reuses it and gets the same process back (`duplicate: true`). The browser can
  set objective, executor, inputs, context and the publish flag. It cannot set
  capabilities or environment, which grant authority.
- **Automatic publication.** "Publish the verified result when it finishes" adds
  `metadata.praxis_host.publish = true`. It takes effect only when the host runs
  `noesis.publication = "auto"`.
- **Status.** Responses add a `summary`. It keeps the executor's outcome (`execution`)
  apart from `verification` (approved, failed checks, missing outputs), and the UI shows
  them as two panels: a run can finish and still not be approved.
- **Controls.** Each response also lists `controls`. A control is disabled, with a reason,
  when the executor lacks the feature or the state does not allow it. Retry is offered
  only for failed tasks. Every control sends the current `attempt_id`. A stale attempt
  returns Praxis' `409 stale_process_attempt`, and the UI refreshes.
- **Live progress.** Events keep Praxis' cursor as their SSE id. The UI reads the stream
  with `fetch`, because `EventSource` cannot send the session token. It advances its cursor
  only after an event is handled, and reconnects with `Last-Event-ID` after an interruption.
- **Errors.** Praxis' codes are passed on (`404`, `409`, `422`, `429` with `Retry-After`,
  `503`). A Praxis `401` means Modulo's credentials are wrong, so it becomes `502
  praxis_authentication_failed` and never signs the user out. When publication is turned
  off on the host, the publication route answers `404 route_not_found`.

## Tests

- `PraxisClientTest`, `PraxisCredentialsTest`, `PraxisControllerTest`: the wire contract,
  TLS material, token handling, identity forwarding, controls and error mapping.
- `PraxisHostIntegrationTest` runs against a real Praxis host with the `fake` executor.
  `scripts/praxis-host-it.sh [praxis-checkout]` generates an internal CA, the server and
  client certificates, a certificate from an unrelated CA and Modulo's token. It then
  starts `praxis.host serve` with mutual TLS and runs the test. CI runs it as
  **Praxis host integration** (Praxis pinned by `PRAXIS_REF`).
- `frontend/src/features/praxis/__tests__`: SSE parsing and resume, submission keys,
  and the separate execution and verification panels.
