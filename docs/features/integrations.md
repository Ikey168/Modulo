# Integrations

This page covers Modulo's connections to external systems: the Noesis
Information Intake bridge and record links, the Praxis control plane, the
Gmail newsletter connector, blockchain anchoring and IPFS, Azure Blob Storage
for attachments, and the gRPC plugin service. Each section says what the
integration does, how an administrator configures it, and what it deliberately
does not do.

Configuration keys are collected in [Configuration](../reference/configuration.md);
secrets handling and identity are described in the
[security model](../architecture/security-model.md). Server-side service
adapters used by Android and the browser (`/api/remote`) are covered in
[Mobile and desktop](mobile-and-desktop.md#server-side-service-adapters).

## Noesis Information Intake

The **Information Intake** plugin (`information-intake`) runs the ten
information-intake modes against a Noesis Knowledge Engine. The browser calls
Modulo's facade `/api/integrations/noesis/intake` (`GET /preflight`,
`POST /call`); the backend opens a new authenticated Noesis Streamable HTTP MCP
session per request. **The browser and the phone never receive a Noesis
token.** Code:
[`NoesisIntakeBridge`](../../backend/src/main/java/com/modulo/integrations/noesis/NoesisIntakeBridge.java),
[`noesisIntakeApi.ts`](../../frontend/src/features/workspace/plugins/builtins/noesisIntakeApi.ts),
and the `Noesis*View.tsx` views in
[`plugins/builtins/`](../../frontend/src/features/workspace/plugins/builtins/).
The separate Noesis Daily Brief Blueprint plugin is an unrelated, read-only
input.

### Configure the bridge

| Setting | Meaning |
| --- | --- |
| `NOESIS_INTAKE_MCP_URL` (`noesis.intake.mcp-url`) | The Noesis `/mcp` endpoint. HTTPS is required except for loopback HTTP |
| `NOESIS_INTAKE_CREDENTIALS_FILE` (`noesis.intake.credentials-file`) | Server-only JSON file mapping Modulo user IDs to Noesis bearer tokens |

```json
{"1":{"token":"the-per-user-noesis-bearer-token"}}
```

- Keys are Modulo's authenticated numeric user IDs. Give the file owner-only
  permissions (`chmod 600`); a file readable by others is refused
  (`NOESIS_CREDENTIALS_INSECURE`). It is limited to 256 KiB.
- Modulo picks the token only from the authenticated user ID, never from a
  request argument.
- The bridge does not follow redirects or use environment proxies. Responses
  are capped at 8 MiB. Only an allowlisted set of intake and decision tools can
  be called (`NoesisIntakeBridge.TOOLS`); anything else is
  `NOESIS_TOOL_UNSUPPORTED`.
- Errors are explicit: `NOESIS_NOT_CONFIGURED`, `NOESIS_CONFIG_INVALID`,
  `NOESIS_CREDENTIALS_UNAVAILABLE`, `NOESIS_USER_NOT_MAPPED`.

On the Noesis side, configure `NOESIS_MCP_AUTH_TOKENS_FILE` with the same
token mapped to one unique `client_id` and these scopes:

| Capability | Scopes |
| --- | --- |
| All intake use | `knowledge:intake:*`, `namespace:<name>:*` |
| Feed refresh and live Exploration page capture | `knowledge:intake:fetch` |
| Deep Research topic start | `knowledge:projects:write` (and `knowledge:projects:read` to inspect) |
| Decision Support | `knowledge:decisions:read`, `knowledge:decisions:write` |

The Noesis `client_id` owns the intake sessions, feed items and decisions.
Modulo authenticates the user; Noesis authorizes every object and namespace
on every call.

### Preflight

Preflight calls Noesis `preflight_intake_mode` for the selected namespace. A
missing user mapping or namespace scope reports the connector unavailable. A
successful call returns a caller-scoped readiness matrix (missing mutation
scopes, known start blockers, unverified live-source/model/execution state)
that the plugin shows on demand. "Available" means the authenticated
transport and namespace read worked; it is not a claim that a mode is complete.

### Who owns what

| Modulo | Noesis | Authority |
| --- | --- | --- |
| Signed-in user and plugin installation | Per-user MCP token, intake owner | Modulo authenticates; Noesis authorizes |
| Plugin preferences `namespace`, `lastSessionId` | Session namespace and ID | Modulo stores navigation; Noesis stores run state |
| Pending request payloads and keys | The created session, project, decision, playbook, pack | Noesis |
| Plugin-state `item.<feed-hash>` link records | Feed item ID/version, `workspace_links` | Modulo owns the link; Noesis owns source and history |
| User notes, tasks, calendar blocks | Optional versioned `workspace_links` | Modulo edits; Noesis stores references only |
| Acquired source text, corrections, citations | Versioned feed or Exploration source | Noesis |

Modulo does not cache Noesis source content in plugin state.

### What each mode does in Modulo

| Mode | In the plugin |
| --- | --- |
| Awareness | Up to 50 feed items, RSS/Atom and newsletter-feed subscriptions, explicit refresh, read state, daily triage, keyword signal-rule previews, promotion to Exploration |
| Exploration | Time-boxed sessions (60/90/120 min) with or without a feed item; capture public page URLs and readable text, visited trail, source-version notes, related-source suggestions |
| Deep Research | From a saved trail source: question, reviewable Definition of Done and request/token/spend budgets; `start_intake_research_topic` atomically creates the Noesis project and session. Shows the project revision, budget and recorded spend |
| Decision Support | Standalone decision (question, alternatives, stakes, confidence, stop condition, choice, rationale) stored in Noesis as `noesis-decision-v2`; **Compare options** with author-supplied weights and a version-pinned sensitivity receipt |
| Problem-Solving | Session from symptom, environment, urgency and success check; hypotheses, fixes, reported attempts and checks. **Resolve verified problem** is enabled only after Noesis reports the checks met |
| Playbooks | Promote a verified problem to a versioned **draft** playbook; **Start guided run** pins a revision; each step records a reported pass/fail |
| Retrieval practice | Author one-card retrieval packs from versioned sources; reviews hide the answer until you record yours and whether you used help |
| Creation | Project with audience, purpose, artifact type and acceptance criteria; attach an existing Noesis report revision, review every criterion, export accepted Markdown and a digest |
| Maintenance | Scan the namespace for overdue practice, old drafts, outdated reports and health; record dispositions (it does not execute them) |
| Iteration | Measure a playbook revision against an expected outcome and propose a new revision with a receipt |

Throughout, Modulo does not run fixes, execute playbook actions, infer
utilities, or verify outcomes on its own; reported results are labelled as
reported. Export digests check integrity but do not authenticate the exporter.
Direct email newsletter ingestion into Noesis is not supported; use the
[Gmail connector](#gmail-newsletter-connection) for Modulo's own Newsletter
Inbox.

### Retries and failures

Every mutating call follows the same rule: the request key **and the exact
payload** are saved in durable plugin state before Noesis is called, and a
retry after a lost response reuses both, so a successful remote write is never
duplicated or changed. Commands carry the expected session revision; after an
error the view reloads Noesis state to detect a committed result or conflict.

- A pending request that Noesis rejected can be abandoned after checking its
  outcome. Abandoning a request whose outcome is uncertain may leave an
  unlinked Noesis record.
- Offline preference edits use the normal plugin-state queue. Noesis
  mutations need a live connection and are not queued.

### Migrating old browser intake records

The retired local research surfaces stored records in the browser key
`modulo-information-intake-v1`. Open **Knowledge · Research Workflow data** in
the Information Intake plugin, in the same browser profile and origin:

1. **Preview local intake** counts all twelve version-1 collections, compares
   per-record IDs and content hashes with plugin state, flags duplicate URLs
   and dangling references, and blocks unknown collections, malformed IDs,
   oversized records or conflicting remote versions. Budget: 20 MB and 5,000
   records.
2. **Import into plugin state** writes one record per original ID
   (`legacy.<collection>.<id-hash>`) plus a `migration.<source-hash>` report.
   Repeating it skips matching records; a changed record needs conflict
   resolution and a fresh preview. **The browser store is never deleted.**
3. **Undo unchanged import** re-hashes every imported record and refuses if
   any was edited since. **Load saved records** shows the imported inventory
   on another device.

Noesis objects are not created from these records just because they share a
URL; linking them needs the native workflows and an explicit decision.

## Noesis record links

Record plugins can start a Noesis mode from one of their own records, without
going through an intake item. Code:
[`noesisRecordLinks.ts`](../../frontend/src/features/workspace/noesisRecordLinks.ts),
[`NoesisRecordPanel.tsx`](../../frontend/src/features/workspace/NoesisRecordPanel.tsx).

A link is stored per record and mode in the account's `noesis-links`
namespace (schema `modulo.noesis.record-link`, version 1):

| Part | Fields | Authority |
| --- | --- | --- |
| Modulo record | issuer, subject, workspace, plugin ID, collection, record ID | The plugin record stays authoritative for its content |
| Noesis object | kind (`intake-session`), ID, revision | Noesis |
| Link | mode, request key, status, timestamps | Modulo |

The request key is written before Noesis is called and reused on every retry,
so an interrupted start never creates a second session. Opening a record
refreshes each linked session's status. The panel lists the modes assigned to
the plugin (the `MODE_PLUGINS` map in `noesisRecordLinks.ts`) and offers **Start**
only for modes Noesis preflight reports as startable. When Noesis is not
configured or unreachable, the reason is shown and existing links stay
visible.

The panel appears on the shared record page, so plugins with their own
editors (for example Universal Inbox, Notes, Canvas, Todo, Executable
Runbooks, Living Documents, Personal SOPs) do not show it yet. Noesis does not
yet accept a back-reference to the Modulo record in `start_intake_mode`, so
the link is kept on the Modulo side only.

## Praxis

Praxis is a process control plane that runs tasks on executors. The **Praxis
Tasks** view (`praxis-tasks` plugin, Tools → Automation) submits and monitors
tasks. Contract: the Praxis repository's `docs/host.md` and `docs/api.md`.
Code: [`integrations/praxis/`](../../backend/src/main/java/com/modulo/integrations/praxis/),
[`features/praxis/`](../../frontend/src/features/praxis/).

```
Browser / Android --Modulo session--> Modulo backend --mTLS + bearer token + X-Praxis-On-Behalf-Of--> Praxis host
```

Modulo's backend is one **delegating client** in Praxis. The browser never
sees a Praxis credential and never names a user.

### Configure Praxis

In Praxis, add Modulo as a client with `delegate = true`:

```sh
python -m praxis.host token --client modulo   # [[clients]] block on stdout, the token once on stderr
```

Give the client `roles = ["submit", "read", "control", "approve", "publish"]`.
Praxis stores only the token's SHA-256 digest.

In Modulo, mount the secrets and set:

| Variable | Meaning |
| --- | --- |
| `MODULO_PRAXIS_ENABLED` | `true` to turn the integration on (off by default) |
| `MODULO_PRAXIS_URL` | Praxis origin, e.g. `https://praxis.internal:8443`. `https` is required unless the host is loopback |
| `MODULO_PRAXIS_CA_FILE` | PEM of the internal CA that issued the Praxis server certificate; the only trust anchor for this connection |
| `MODULO_PRAXIS_CLIENT_CERT_FILE` | Modulo's client certificate chain, issued by the CA Praxis trusts in `server.tls_client_ca` |
| `MODULO_PRAXIS_CLIENT_KEY_FILE` | Its key as unencrypted PKCS#8 (`BEGIN PRIVATE KEY`). Convert with `openssl pkcs8 -topk8 -nocrypt -in modulo.key -out modulo.pk8.key` |
| `MODULO_PRAXIS_TOKEN_FILE` | File holding the bearer token. Without it, the token is read from `PRAXIS_MODULO_TOKEN` |

Only paths go into configuration; the certificate, key and token stay in the
secret store. With the integration enabled, a missing or invalid file stops
the server at startup instead of failing on the first user request.
`GET /api/praxis/status` tells the UI whether Praxis is configured.

**Rotation.** The token file is re-read when it changes, so Praxis token
rotation (list both digests, `SIGHUP`, switch Modulo's file, drop the old
digest, `SIGHUP`) needs no Modulo restart. A new client certificate or CA
does need a restart.

**Executors.** Modulo's client has no `health` role, so it cannot ask Praxis
which features an executor supports. Defaults mirror each adapter's
`ExecutorFeatures`
([`PraxisProperties`](../../backend/src/main/java/com/modulo/integrations/praxis/PraxisProperties.java)):

| Executor | Features |
| --- | --- |
| `fake` | cancel |
| `local` | cancel, signal, suspend |
| `codex` | cancel, streaming |
| `claude`, `deepseek` | none |
| `remote` | streaming |

Override or add with `modulo.praxis.executor-features.<name>=cancel,suspend`.
Only listed executors can be chosen when submitting.

### Identity

`X-Praxis-On-Behalf-Of` is always `user-<Modulo account id>`, taken from the
verified session by `AuthenticatedUserService`. No body, parameter or header
can change it, because Praxis trusts this header from Modulo. Praxis audits
actions as `modulo/user-<id>`, and a user reaches only the processes they
submitted. The account ID is used rather than a username or email because
Praxis ties process ownership to it and accounts can be renamed.

### Routes

| UI | Modulo | Praxis |
| --- | --- | --- |
| Start task | `POST /api/praxis/processes` with `Idempotency-Key` | `POST /v1/processes` |
| Task list | `GET /api/praxis/processes` | none; Modulo records its submissions in `praxis_submissions` |
| Status and result | `GET /api/praxis/processes/{id}` | `GET /v1/processes/{id}` |
| Subtasks | `GET /api/praxis/processes/{id}/tree` | `GET /v1/processes/{id}/tree` |
| Live progress | `GET /api/praxis/processes/{id}/events` (SSE, `Last-Event-ID` or `after`) | `GET /v1/processes/{id}/events` |
| Cancel / suspend / resume / retry | `POST /api/praxis/processes/{id}/control` with `attemptId` | `POST /v1/processes/{id}/control` |
| Approvals | `GET`/`POST /api/praxis/processes/{id}/approvals` | same path |
| Pending approvals for the inbox | `GET /api/praxis/approvals` | `GET /v1/processes/{id}/approvals` for each process in `praxis_submissions` |
| Publish to knowledge base | `POST /api/praxis/processes/{id}/publication` | same path |

- **Submission.** One idempotency key per task form; a retry after a lost
  response returns the same process (`duplicate: true`). The browser can set
  objective, executor, inputs, context and the publish flag, but not
  capabilities or environment, which grant authority.
- **Automatic publication.** "Publish the verified result when it finishes"
  sets `metadata.praxis_host.publish = true`; it takes effect only when the
  host runs `noesis.publication = "auto"`.
- **Status.** Responses add a `summary` that keeps the executor outcome
  (`execution`) apart from `verification` (approved, failed checks, missing
  outputs). The UI shows them as two panels: a run can finish and still not be
  approved.
- **Controls.** Each response lists `controls`; a control is disabled with a
  reason when the executor lacks the feature or the state does not allow it.
  Retry is offered only for failed tasks. Every control sends the current
  `attempt_id`; a stale one returns `409 stale_process_attempt` and the UI
  refreshes.
- **Live progress.** Events keep Praxis' cursor as the SSE id. The UI reads the
  stream with `fetch` (because `EventSource` cannot send the session token),
  advances its cursor only after handling an event, and reconnects with
  `Last-Event-ID`.
- **Pending approvals.** `GET /api/praxis/approvals` asks Praxis for the
  pending approvals of each process the user submitted through Modulo (the
  newest 200 in `praxis_submissions`), with the user's delegated identity, and
  returns `{configured, complete, approvals}`. Each approval carries `source:
  "praxis"`, `processId` (the submitted process, used for the decision),
  `effectProcessId`, `effectId`, `version`, `attemptId`, `kind`, `target`,
  `reversible`, `title`, `summary` (the task objective), `requestedAt` (when
  Praxis reports it, otherwise `null`) and `submittedAt`. Processes Praxis
  answers `403`/`404` for are skipped; other failures set `complete: false`
  and keep the approvals that did load. With Praxis not configured the route
  answers `200` with `configured: false` and an empty list.
- **Errors.** Praxis codes pass through (`404`, `409`, `422`, `429` with
  `Retry-After`, `503`). A Praxis `401` means Modulo's own credentials are
  wrong, so it becomes `502 praxis_authentication_failed` and never signs the
  user out. With publication disabled on the host, the publication route
  answers `404 route_not_found`.

### Testing Praxis

- `PraxisClientTest`, `PraxisCredentialsTest`, `PraxisControllerTest` cover the
  wire contract, TLS material, token handling, identity forwarding, controls
  and error mapping.
- `PraxisHostIntegrationTest` runs against a real Praxis host with the `fake`
  executor. [`scripts/praxis-host-it.sh`](../../scripts/praxis-host-it.sh)
  `[praxis-checkout]` generates an internal CA, server and client
  certificates, a certificate from an unrelated CA and Modulo's token, starts
  `praxis.host serve` with mutual TLS and runs the test. CI runs it as
  **Praxis host integration**, with Praxis pinned by `PRAXIS_REF`.
- `frontend/src/features/praxis/__tests__` covers SSE parsing and resume,
  submission keys and the separate execution and verification panels.

## Gmail newsletter connection

Each user can connect one Gmail or Google Workspace mailbox, read-only, to
feed the Newsletter Inbox (see [Knowledge](knowledge.md#awareness-plugins)).
This is separate from signing in to Modulo. Code:
[`state/Gmail*.java`](../../backend/src/main/java/com/modulo/state/GmailMailboxService.java).

### Google Cloud setup

1. Enable the Gmail API in the OAuth client's Google Cloud project.
2. Add the scope `https://www.googleapis.com/auth/gmail.readonly` to the
   consent configuration. While the app is in testing, add the connecting
   account as a test user; Workspace administrators may need to allow the app.
3. Add the authorized redirect URI `<MODULO_URL>/api/public/gmail/callback` to a
   **Web application** OAuth client.
4. Set `MODULO_GMAIL_CLIENT_ID` and `MODULO_GMAIL_CLIENT_SECRET`
   (`modulo.gmail.client-id`/`client-secret`). The OCI compose file sets
   `MODULO_GMAIL_REDIRECT_URI` from `MODULO_URL`. Stored refresh tokens are
   protected by `MODULO_SECURITY_ENCRYPTION_KEY`.
5. Recreate the backend after changing these values.

Google may limit or expire authorizations for apps in testing; the UI reports
when reconnection is needed. Gmail read access is a restricted scope, so
public distribution may require Google's verification.

### Use it

In the web app, open **Knowledge → Awareness → Newsletter Inbox → Connect
Google account**, complete consent in the popup, then enter a Gmail search and
choose **Save search and sync**, for example `label:newsletters newer_than:30d`,
`category:promotions newer_than:7d` or `from:newsletter@example.com newer_than:30d`.

- A new or reconnected account starts paused; saving the search enables sync.
- The server checks roughly every 15 minutes (sooner while paging through a
  large result set) and imports readable text as separate Newsletter Inbox
  records, which sync to phones too. Initial consent is done on the website.
- Saving or archiving in Modulo does not change Gmail. Imported Gmail IDs are
  stable per mailbox and existing records are preserved.
- Pausing stops polling. Disconnecting deletes the stored credentials and
  tries to revoke Google's grant; imported newsletters remain.

| Endpoint | Purpose |
| --- | --- |
| `GET`/`PUT`/`DELETE /api/newsletters/gmail` | Status, save search, disconnect |
| `POST /api/newsletters/gmail/connect` | Start consent |
| `POST /api/newsletters/gmail/sync` | Sync now |
| `GET /api/public/gmail/callback` | OAuth redirect target |

Security: OAuth state is single-use, expires after ten minutes, and is bound
to an HttpOnly cookie and the initiating owner. Authorization uses PKCE.
Refresh tokens are encrypted with AES-GCM using owner-bound authenticated
data and never reach plugin state or the frontend. Requests use fixed Google
endpoints with bounded response sizes and timeouts.

## Blockchain anchoring and IPFS

Modulo can register a note's content hash in the `NoteRegistry` smart contract
and store note content on IPFS. This anchors single note contents; it is not a
per-revision history.

| Piece | Location |
| --- | --- |
| Contracts (`NoteRegistry`, `NoteRegistryWithAccessControl`, `ModuloToken`, `NoteMonetization`, optimized variants) | [`smart-contracts/contracts/`](../../smart-contracts/contracts/) |
| Backend | [`BlockchainService`](../../backend/src/main/java/com/modulo/service/BlockchainService.java) (web3j), [`BlockchainConfig`](../../backend/src/main/java/com/modulo/config/BlockchainConfig.java), [`IpfsService`](../../backend/src/main/java/com/modulo/service/IpfsService.java) |
| Frontend | the **On-Chain** section of a note, the `timestamp-proofs` and `ipfs-attach` note panels, the `web3-id` view (MetaMask) |

| Endpoint | Purpose |
| --- | --- |
| `POST /api/blockchain/notes/register` | Register a note hash |
| `POST /api/blockchain/notes/verify`, `/verify-integrity` | Verify a hash or a note's current content |
| `GET /api/blockchain/notes/{id}`, `/my-notes`, `/count`; `PUT /api/blockchain/notes/{id}` | Read and update registrations |
| `POST /api/blockchain/hash`, `GET /api/blockchain/status` | Hash helper, network status |
| `POST /api/ipfs/notes/{noteId}/upload`, `POST /api/ipfs/notes/{noteId}/verify` | Store and verify a note on IPFS |
| `GET /api/ipfs/content/{cid}`, `POST`/`GET /api/ipfs/encrypted[/{cid}]` | Plain and encrypted content |
| `GET /api/ipfs/status`, `GET /api/ipfs/notes` | Node status, stored notes |

Configuration:

| Property | Default |
| --- | --- |
| `blockchain.network.rpc-url` | `http://localhost:8545` (`application.properties`) |
| `blockchain.contract.note-registry-address`, `.modulo-token-address`, `.note-monetization-address` | Hardhat local deployment addresses |
| `blockchain.private-key` / `BLOCKCHAIN_PRIVATE_KEY` | Hardhat's well-known development key |
| `modulo.integrations.ipfs.node-url` / `.gateway-url` / `.enabled` | `http://localhost:5001`, `http://localhost:8080`, `true` |

The default private key is the public Hardhat test account key. **Always set
`BLOCKCHAIN_PRIVATE_KEY` and the contract addresses for any non-local
network.** The OCI deployment disables IPFS
(`MODULO_INTEGRATIONS_IPFS_ENABLED=false`); `docker-compose.yml` runs an IPFS
node.

For a local chain, from `smart-contracts/`: `npm run node` starts Hardhat,
`npm run deploy:local` deploys, and `npm run config:backend` /
`npm run config:frontend` write the deployed addresses into the app
configuration. `npm test` runs the contract tests. Deployment scripts exist
for Sepolia, Mumbai and Polygon (`deploy:*`), reading `PRIVATE_KEY` and the
network URL from the environment.

## Azure Blob Storage for attachments

Note attachments are stored in Azure Blob Storage, with metadata in the
`attachments` table and optional CDN URLs. Code:
[`AttachmentService`](../../backend/src/main/java/com/modulo/service/AttachmentService.java),
[`AzureBlobStorageConfig`](../../backend/src/main/java/com/modulo/config/AzureBlobStorageConfig.java),
[`AttachmentController`](../../backend/src/main/java/com/modulo/controller/AttachmentController.java).

| Endpoint | Purpose |
| --- | --- |
| `POST /api/attachments/upload` | Multipart `file` + `noteId` |
| `GET /api/attachments/note/{noteId}` | A note's attachments |
| `GET /api/attachments/{id}`, `GET /api/attachments/{id}/download-url` | Details, download URL (CDN URL when configured) |
| `DELETE /api/attachments/{id}` | Soft delete (marks inactive) |
| `DELETE /api/attachments/{id}/hard` | Delete the blob and the record |
| `POST /api/attachments/container/ensure` | Create the container if missing |

| Env | Property | Default |
| --- | --- | --- |
| `AZURE_STORAGE_ACCOUNT_NAME` | `azure.storage.account-name` | `modulostorage` |
| `AZURE_STORAGE_CONNECTION_STRING` | `azure.storage.connection-string` | empty |
| `AZURE_STORAGE_ACCOUNT_KEY` | `azure.storage.account-key` | empty |
| `AZURE_STORAGE_USE_MANAGED_IDENTITY` | `azure.storage.use-managed-identity` | `true` |
| `AZURE_STORAGE_CONTAINER_NAME` | `azure.storage.container-name` | `attachments` |
| `AZURE_CDN_ENDPOINT` | `azure.storage.cdn-endpoint` | empty |
| `AZURE_STORAGE_MAX_FILE_SIZE` | `azure.storage.max-file-size` | `10485760` (10 MB) |
| `AZURE_STORAGE_ALLOWED_CONTENT_TYPES` | `azure.storage.allowed-content-types` | JPEG, PNG, GIF, PDF, plain text, Word |

Authenticate with a connection string, an account key, or (recommended in
production) a managed identity with the **Storage Blob Data Contributor**
role on the account. The `application.properties` default content-type list
is narrower than the capture tools produce (Markdown, `.eml`, WebP and audio
are not in it); set `AZURE_STORAGE_ALLOWED_CONTENT_TYPES` if users capture
those formats.

Provisioning outline:

```bash
az storage account create --name modulostorage --resource-group modulo-rg --sku Standard_LRS
az storage container create --name attachments --account-name modulostorage
az identity create --name modulo-storage-identity --resource-group modulo-rg
az role assignment create --assignee <principal-id> --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<sub>/resourceGroups/modulo-rg/providers/Microsoft.Storage/storageAccounts/modulostorage
```

For a CDN, create an Azure CDN endpoint with the blob host as origin and set
`AZURE_CDN_ENDPOINT`; download URLs become `<cdn>/<container>/<blob>`.

Troubleshooting: authentication failures point at the managed identity or
connection string; "container not found" means the container is missing or
not accessible (use `container/ensure`); "file too large" and "invalid file
type" come from `max-file-size` and `allowed-content-types`. Enable soft delete
on the storage account itself for recovery of deleted blobs.

Workspace files that are not note attachments (for example web-archive
captures made through `/api/remote`) use the separate
`/api/workspaces/{workspace}/files` store.

## gRPC plugin service

The backend runs a gRPC server for plugins on port 9090 with reflection
enabled (`grpc.server.port`). Services are registered only when
`modulo.features.enable-grpc=true`, which `application.properties` sets. Protos are in [`backend/src/main/proto/`](../../backend/src/main/proto/)
(package `com.modulo.plugin.grpc`); generated classes are excluded from
coverage.

| Service | Implemented by | Purpose |
| --- | --- | --- |
| `PluginService` | [`PluginServiceImpl`](../../backend/src/main/java/com/modulo/grpc/service/PluginServiceImpl.java) | Operator lifecycle: initialize, start, stop, shutdown, status, health, info, capabilities, configure, execute (and `ExecuteStream`) |
| `PluginHostService` | [`PluginHostServiceImpl`](../../backend/src/main/java/com/modulo/grpc/service/PluginHostServiceImpl.java) | Callbacks for external plugins: get/save/delete/search notes, add metadata, publish and subscribe to events |
| `NotePluginService`, `UserPluginService` | none (proto definitions only) | |

`PluginHostService` calls must carry `plugin-id` and `plugin-token` metadata
(the token is issued by `PluginSecurityManager` at registration);
[`PluginAuthInterceptor`](../../backend/src/main/java/com/modulo/grpc/PluginAuthInterceptor.java)
rejects missing or invalid credentials with `UNAUTHENTICATED`. Each method then
checks a permission: `notes.read`, `notes.write`, `notes.delete`,
`system.events.publish` or `system.events.subscribe`. `PluginService` is not
guarded by the interceptor; treat port 9090 as an internal, operator-only
port. External plugin deployment is described in [Plugins](plugins.md).
