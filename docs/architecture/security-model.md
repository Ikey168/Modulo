# Security model

How Modulo authenticates users, decides what they may touch, protects secrets,
and shares notes. It is written for contributors changing auth, data access or
sharing code, and for operators who need to know which guarantees hold in a
deployment. Security testing and incident handling are covered in
[security-testing.md](../operations/security-testing.md) and
[incident-response.md](../security/incident-response.md).

## Trust boundaries at a glance

| Zone | Trusted for | Not trusted for |
| --- | --- | --- |
| Keycloak (realm `modulo`) | Issuing identities and realm roles | Anything about Modulo data |
| Backend + PostgreSQL | Authorization, ownership, audit, durable state | Confidentiality of end-to-end encrypted shared notes |
| Browser / Electron / Android client | Holding the user's session and decrypted content while open | Authorization decisions (the server re-checks everything) |
| Browser workspace plugins | Running first-party code in the page origin | Isolation from each other: they share the page's authority |
| EXTERNAL plugin workloads | Nothing by default; each call is gated by registration, runtime grant and owner consent | Sharing the core JVM (forbidden, [ADR 0004](decisions.md#adr-0004)) |
| IPFS and the blockchain | Integrity and provenance | Confidentiality: both are public and permanent |

## Authentication

### Identity provider

Keycloak hosts the `modulo` realm, imported from
[`keycloak/realm-modulo.json`](../../keycloak/realm-modulo.json) with the
`modulo` login theme. The realm defines:

| Item | Value |
| --- | --- |
| Client | `modulo-frontend`: public client, standard (authorization code) flow only, implicit flow and direct access grants disabled, PKCE method `S256` |
| Redirect URIs | Local web origins (`localhost`, ports 80, 3000, 3001, 5173) plus `com.modulo:/oauth2redirect` and `com.modulo:/logout` for Android |
| Access token lifespan | 900 s |
| Realm roles | `admin`, `editor`, `viewer`, `plugin-developer`, `plugin-reviewer` |
| Seed user | `demo`, with realm role `admin` (development only) |

Production deployments render their own realm file with exact redirect URIs;
see [deployment.md](../operations/deployment.md).

### Browser login (OIDC authorization code + PKCE)

The web client uses `oidc-client-ts`, configured in
[`oidcConfig.ts`](../../frontend/src/features/auth/oidcConfig.ts):

- `response_type: 'code'` with PKCE, scopes `openid profile email roles`,
  redirect to `/auth/callback`, silent renewal via `/auth/silent-callback`.
- The user store is **in memory** (`InMemoryWebStorage`). Access tokens are
  never written to `localStorage`; ESLint bans browser Storage everywhere except
  `src/features/auth/**` (protocol state) and the legacy migration module.
- `loadUserInfo: false`. Keycloak already puts `sub`, email, name and roles in
  the ID token, and the UserInfo call caused subject-mismatch failures.
- The issuer and client ID come from `window.__MODULO_CONFIG__`, which the
  frontend container writes to `/runtime-config.js` at start from
  `MODULO_OIDC_ISSUER` and `MODULO_OIDC_CLIENT_ID`
  ([`40-runtime-config.sh`](../../frontend/docker/40-runtime-config.sh)). The
  script rejects values with characters outside a URL/client-ID allowlist, because
  they are embedded in JavaScript. Without runtime config, the build falls back to
  `VITE_KEYCLOAK_URL` / `VITE_KEYCLOAK_CLIENT_ID`, then to
  `http://localhost:8180/realms/modulo` and `modulo-frontend`.
- API calls attach `Authorization: Bearer <access token>`
  ([`authenticatedRequest.ts`](../../frontend/src/services/authenticatedRequest.ts)).

### Android login

Android uses the same public client with PKCE, but opens Keycloak in the system
browser (Custom Tabs), never in an embedded WebView, and returns through the
private-use scheme `com.modulo:/oauth2redirect`. Access tokens stay in memory;
the refresh token is AES-GCM encrypted with an Android Keystore key by
`ModuloSecureStorePlugin` and excluded from backup. Silent renewal is off on
Android. The rationale is recorded in [ADR 0009a](decisions.md#adr-0009a).

### How the backend authenticates a request

The backend has more than one Spring Security filter chain:

| Chain | Active when | Handles | Behavior |
| --- | --- | --- | --- |
| [`ResourceServerSecurityConfig`](../../backend/src/main/java/com/modulo/config/ResourceServerSecurityConfig.java) | `modulo.security.keycloak.jwk-set-uri` is set | Requests with an `Authorization: Bearer` header (order 1) | Validates the JWT against the JWK set (fetched lazily, so boot does not need Keycloak), optionally checks `iss` against `modulo.security.keycloak.issuer-uri`, stateless, CSRF off. Realm roles become `ROLE_<role>` authorities. |
| [`config/SecurityConfig`](../../backend/src/main/java/com/modulo/config/SecurityConfig.java) | Always | Everything else | Session-based; `oauth2Login` with the Google and Azure client registrations; public paths listed below; everything else authenticated. CSRF is currently disabled. |
| [`backend/config/SecurityConfig`](../../backend/src/main/java/com/modulo/backend/config/SecurityConfig.java) | Profile `oidc` | All requests | JWT resource server using `spring.security.oauth2.resourceserver.jwt.*`; enables method security. |
| [`CloudSecurityConfig`](../../backend/src/main/java/com/modulo/security/CloudSecurityConfig.java) | Profile `cloud` | All requests | Stateless, cookie CSRF, `ADMIN`-only `/api/admin/**` and actuator. |

Compose and OCI deployments run the `docker` profile with
`MODULO_SECURITY_KEYCLOAK_JWK_SET_URI` (internal Keycloak URL) and
`MODULO_SECURITY_KEYCLOAK_ISSUER_URI` (browser-facing issuer) set, so the first
two chains are active.

Paths that the default chain lets through without authentication:

| Path | Why it is public | Where the check happens instead |
| --- | --- | --- |
| `/ws`, `/ws/**` | STOMP handshake | `OwnedSocketInterceptor` authenticates `CONNECT` |
| `/api/s/**` | Public share links | The stored share token (expiry, revocation, password) |
| `/api/plugin-state/callback/**` | External plugin callbacks | Dual-token check (workload token + owner grant) |
| `/api/public/**` | Webhooks and OAuth callbacks (Blueprint webhooks, Gmail callback) | Endpoint-specific secrets and state |
| `/api/health/**`, `/api/simple-health/**`, `/actuator/**` | Probes | None; keep actuator off public ingress |
| Static assets, `/login`, `/oauth2/**`, `/error` | Login flow and SPA shell | None |

### From token to owner

Every data access resolves the caller to a row in `users` through
[`AuthenticatedUserService`](../../backend/src/main/java/com/modulo/security/AuthenticatedUserService.java).
Display names and emails are never identities.

- **Bearer JWT**: the token's `iss` must equal the trusted issuer, which is
  `modulo.security.keycloak.issuer-uri` (the property the bearer chain validates
  against) or, when that is empty, `spring.security.oauth2.resourceserver.jwt.issuer-uri`.
  `sub` is looked up in `users.keycloak_subject`. With no issuer configured, no
  bearer token resolves to an account.
- **OAuth2 login session**: `sub` is looked up by registration (`google`,
  `azure` or `keycloak` subject column).
- **Local `UserDetails`**: looked up by username.

**Just-in-time provisioning.** The first request with a valid token from the
trusted issuer and an unknown `sub` creates the account through
`AuthMigrationService.provisionFromBearerToken`, the same rules the OAuth login
path uses: username from `preferred_username` (or `keycloak:<sub>` when taken),
email and names from the token. An existing account is linked by email only when
the token carries `email_verified: true`, and then only through the migration
rules below; an unverified email is never used to adopt an account (the new
account is created without it). Provisioning runs in its own transaction and is
serialized per JVM so concurrent first requests create one row.

An anonymous request gets 401. A token from any other issuer, or any other
authenticated identity with no matching user, gets 403 `Authenticated account is
not provisioned`.

### Provider migration (dual auth)

Accounts that predate Keycloak can hold Google or Azure subjects.
`AuthMigrationService` links a new provider to an existing user on login
(matched by provider subject, then by email; for bearer tokens only a verified
email) and tracks a migration status.
Settings: `modulo.auth.dual-auth-enabled` (default `true`),
`modulo.auth.default-provider` (`KEYCLOAK`),
`modulo.auth.migration-grace-period-days` (30). Admin endpoints live under
`/auth/migration` (`status`, `statistics`, `manual-review`, `dual-auth`,
`resolve-conflict`, `force-migrate`, `users-by-provider`, `settings`).

### WebSocket authentication

STOMP over `/ws` (SockJS) is authenticated by
[`OwnedSocketInterceptor`](../../backend/src/main/java/com/modulo/security/OwnedSocketInterceptor.java):

- `CONNECT` accepts the session principal or an `Authorization: Bearer` native
  header, resolves the owner, and records the session's expiry (the JWT's `exp`,
  or 5 minutes for session logins).
- `SUBSCRIBE` is allowed only for the caller's own queues
  (`/user/queue/state`, `/user/queue/notes`, `/user/queue/notifications`), their
  own notification topic, or note topics for notes they own.
- `SEND` is allowed only to `/app/...` note destinations the caller owns, never to
  comment destinations.
- Outbound messages are filtered again, so an expired or foreign session never
  receives another user's frames.

## Authorization

### Ownership is the primary rule

Modulo is single-tenant per user: every domain row carries an owner, and every
query filters on the authenticated owner.

- JPA repositories filter with the SpEL extension `tenant.ownerId`
  ([`TenantQueryExtension`](../../backend/src/main/java/com/modulo/security/TenantQueryExtension.java)),
  including overridden `findById`, `findAll`, `count` and `existsById` on
  [`NoteRepository`](../../backend/src/main/java/com/modulo/repository/NoteRepository.java).
  Background and cached callers resolve the owner at execution time.
- Services that take a client-supplied owner call `requireOwner()`, which answers
  404 on mismatch.
- **Foreign and missing resources look the same.** Plugin state, workflow runs,
  approvals and shares return the same 404 / "unavailable" response for "does
  not exist" and "not yours", so IDs cannot be probed.
- Tags are owner-scoped (unique on `(user_id, name)`); legacy unowned rows stay
  quarantined until an operator assigns them
  ([database.md](../operations/database.md)).

### Roles

Keycloak realm roles arrive as upper-cased `ROLE_<NAME>` authorities (realm role
`admin` becomes `ROLE_ADMIN`). The backend checks `ADMIN` with
`@PreAuthorize("hasRole('ADMIN')")` on plugin administration
([`PluginController`](../../backend/src/main/java/com/modulo/controller/PluginController.java)),
auth migration, chaos testing, and marketplace trust operations (publisher
verification and revocation, deployment records). Most other controllers only
require `isAuthenticated()` and rely on ownership.

Method security is enabled in every profile by
[`MethodSecurityConfig`](../../backend/src/main/java/com/modulo/config/MethodSecurityConfig.java),
so a signed-in user without the `admin` realm role gets 403 on those endpoints.
`MethodSecurityDefaultProfileTest` and `MethodSecurityDockerProfileTest` check
this under the default and `docker` profiles.

The frontend reads realm and client roles from the ID token for UI gating
(`hasRole` / `hasAnyRole` in `useAuth`). That is presentation only; the server is
the authority.

### Capabilities for Blueprints and feature packs

- **Blueprint nodes** declare capabilities (for example `code:execute`,
  `wasm:execute`). [`BlueprintCapabilityService`](../../backend/src/main/java/com/modulo/blueprint/BlueprintCapabilityService.java)
  derives the required set from the IR and stores per-Blueprint grants; the
  interpreter skips a node whose capability is not granted and records the step as
  `SKIPPED`. See [blueprints.md](../features/blueprints.md).
- **Feature packs** call `requestCapabilities()` on `@modulo/core`. On the client
  this records intent for a consent UI; enforcement is on the server.
- **Pack manifests** declare capabilities as requests for consent, never as
  grants ([packs.md](../features/packs.md)).

### External plugin state access

An EXTERNAL workload reaches owner data only through
`/api/plugin-state/callback/workspaces/personal/{namespace}` with two headers:
`X-Modulo-Plugin-Token` (the registered workload) and `X-Modulo-State-Grant`
(an owner-issued grant). The namespace must equal the plugin ID, reserved
namespaces (`core`, `core.*`, `workspace-settings`) cannot be delegated, and
reads and writes need `state.read` / `state.write`. Grant and workload tokens are
256-bit random values shown once; only their SHA-256 is stored. Limits and
endpoints are in [data-and-state.md](data-and-state.md#external-access-grants-and-workloads).

### Human approvals

Approvals are bound to one request in one run attempt, enforce separation of
duty at request and decision time, and re-check eligibility inside the decision
transaction. Being an approver never bypasses note ownership. See
[ADR 0009b](decisions.md#adr-0009b).

### Edge policy with Envoy and OPA (optional)

Rego policies exist for an optional edge-authorization layer. They are not
called by the backend.

| File | Purpose |
| --- | --- |
| [`policy/authorization.rego`](../../policy/authorization.rego) | Resource/action rules (`note`, `tag`, `plugin`; owner, `shared_with`, `admin`/`editor` roles), default deny |
| [`policy/audit_enhanced_authorization.rego`](../../policy/audit_enhanced_authorization.rego) | Same decisions with audit metadata |
| [`infra/opa/policy.rego`](../../infra/opa/policy.rego) | Envoy `ext_authz` policy (package `envoy.authz`): health paths open, JWT extraction, path/role rules, RFC 7807 deny bodies |

[`docker-compose.envoy-opa.yml`](../../docker-compose.envoy-opa.yml) puts Envoy
(port 8080) in front of the backend with OPA as the `ext_authz` service; the main
Compose file also runs OPA with decision logging. Policy tests run in the
`policy-ci` workflow (`opa fmt`, `opa test policy/`, `opa test infra/opa/`).
The authoritative checks remain the backend's ownership rules; the edge policy is
defense in depth.

### Rate limiting

[`RateLimitingFilter`](../../backend/src/main/java/com/modulo/security/RateLimitingFilter.java)
applies per-client-IP limits (honoring `X-Forwarded-For`):
`modulo.security.rate-limit.enabled` (default
`true`), `requests-per-minute` (100), `burst-capacity` (20).

## Secrets and encryption at rest

| Data | Protection | Key source |
| --- | --- | --- |
| Remote service credentials (`remote_service_credentials`) | AES-256-GCM, random IV per value | `modulo.remote.credential-key` (`MODULO_REMOTE_CREDENTIAL_KEY`), 32 bytes base64. Empty disables credential storage (`REMOTE_CREDENTIALS_UNCONFIGURED`). |
| Gmail OAuth tokens | AES-GCM with a key derived from the app encryption key | `modulo.security.encryption-key` (at least 32 characters, otherwise Gmail is disabled) |
| Share-link passwords | bcrypt | n/a |
| Plugin-state grant and workload tokens | Stored as SHA-256 only | n/a |
| Plugin state, notes, workflow checkpoints | **Plaintext** in PostgreSQL | Use encrypted volumes and backups; do not claim encryption at rest otherwise |
| Android refresh token | AES-GCM, Android Keystore key | Device |

The default values of `modulo.security.jwt-secret`, `api-key` and
`encryption-key` in `application.properties` and `docker-compose.yml` are
development placeholders. The OCI deployment refuses to start without real values
(`${VAR:?}`). Plugins must keep secrets in the secret service, never in plugin
state.

## Sharing

### Public share links

Owners create unauthenticated read links for a note
([`ShareController`](../../backend/src/main/java/com/modulo/sharing/ShareController.java)):

| Endpoint | Purpose |
| --- | --- |
| `POST /api/notes/{noteId}/shares` | Create a link; optional `expiresInHours` and `password` |
| `GET /api/notes/{noteId}/shares` | List the note's links |
| `DELETE /api/shares/{tokenId}` | Revoke a link |
| `GET /api/s/{token}` | Public HTML view (password via `?password=`) |
| `GET /api/s/{token}/meta` | Public metadata: revoked, expired, password required |

Tokens are 32-hex-character random UUIDs. Passwords are bcrypt-hashed. Expired
or revoked links render an error page instead of content. Creation is recorded in
the audit log (`SHARE_CREATED`). A share link discloses the note body to anyone
holding the URL; it is not encrypted.

<a id="encrypted-note-sharing"></a>
### End-to-end encrypted note sharing

Status: the cryptographic building blocks, IPFS relay and contract bindings
exist and are tested, but the sharing UI (`EncryptedSharePanel`) is not mounted
in the app, and the review checklist below is open. **Do not describe shared or
anchored notes as confidential.** The accurate description is
"integrity/provenance plus experimental encryption".

**Scheme.**

1. The client generates a per-note AES-256-GCM key and encrypts the note
   ([`noteCrypto.ts`](../../frontend/src/features/workspace/crypto/noteCrypto.ts)).
2. The ciphertext envelope is uploaded to IPFS through the backend relay
   (`IpfsService.uploadEncryptedContent`), which never decrypts it.
3. The note key is wrapped for each recipient's X25519 public key
   (`x25519-xsalsa20-poly1305` sealed box). Recipients' keys are derived from a
   wallet signature ([ADR 0001](decisions.md#adr-0001)).
4. The CID and per-recipient wrapped keys are written on chain
   (`setNoteCid`, `grantAccess`) via
   [`sharingContract.ts`](../../frontend/src/features/workspace/crypto/sharingContract.ts).

**Trust assumptions.** IPFS and the chain are public and permanent: only
ciphertext and wrapped keys may go there. The backend and database are untrusted
for the confidentiality of encrypted shared notes. The wallet is trusted to keep
its signing key. The client device is trusted while a note is open.

| Attacker | Can read shared-note plaintext? |
| --- | --- |
| Compromised backend or stolen PostgreSQL dump | Not from the encrypted share (but see the database gap below) |
| Anyone fetching the CID from IPFS | No, ciphertext only |
| Anyone reading the chain | No, wrapped keys need a recipient secret |
| A revoked recipient, for versions after revocation | No, the key is rotated |
| A revoked recipient, for content already fetched | **Yes**, cannot be un-disclosed |
| Someone who compromises a recipient's wallet | **Yes**, for notes shared with that recipient |

**Revocation is cryptographic, not an ACL change.**
`reEncryptAndRewrap` generates a new note key, re-encrypts (new CID), re-wraps for
the remaining recipients, then calls `setNoteCid`, `grantAccess` for each
remaining recipient, and `revokeAccess` for the revoked one. Future versions are
protected; anything the revoked party already downloaded stays readable. The UI
must say so. `keyRotation.test.ts` covers this.

**Known gaps before confidentiality can be claimed.**

- Metadata is visible: on chain, the note ID, owner and collaborator addresses,
  CID, timestamps and (in `NoteRegistry`) the title and content hash. Decide
  whether to stop writing titles on chain for encrypted notes and whether CIDs need
  hiding; treat the collaborator graph as disclosed.
- The owner's server copy of the note is plaintext in PostgreSQL. Either store only
  ciphertext for encrypted notes, or scope the feature explicitly as "encrypted on
  IPFS, plaintext on the owner's server".
- No forward secrecy within a version: a recipient who keeps a key reads every
  version under it until rotation.
- Non-deterministic wallets break key re-derivation ([ADR 0001](decisions.md#adr-0001)).

**Review checklist (all required before advertising confidentiality).**

- [ ] Client-side encryption wired into note create/update and upload.
- [ ] Recipient key derivation and wrapping wired to the wallet in the UI.
- [ ] Contract deployed; the app reads and writes CIDs and wrapped keys.
- [ ] Revocation performs key rotation as above.
- [ ] Metadata decisions made and implemented.
- [ ] Database handling decision made and implemented.
- [ ] Independent review of the cryptography and flows signed off.

## Related pages

- [data-and-state.md](data-and-state.md): ownership in the schema, plugin-state API.
- [backend.md](backend.md): packages and API surface.
- [decisions.md](decisions.md): ADRs 0001, 0004, 0008, 0009a, 0009b.
- [configuration.md](../reference/configuration.md): every configuration key.
