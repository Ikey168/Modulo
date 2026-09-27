# Configuration reference

This page lists the configuration the Modulo backend and frontend actually read,
grouped by area, with defaults and the environment variable that sets each key.
It is for operators writing a deployment's environment and for developers adding
a setting. Deployment-specific variables (Compose `.env`, OCI host files) are in
[Deployment](../operations/deployment.md).

Everything here was checked against the code: a key is listed only if a
`@Value`, `@ConfigurationProperties` or `@ConditionalOnProperty` binding reads
it, or if it is a standard Spring Boot key the shipped profiles rely on. The
property files also contain keys that nothing binds; those are listed at the end
so nobody spends time tuning them.

## How configuration is resolved

- Sources, lowest to highest precedence: `application.yml`, then
  `application.properties` (both in
  [`backend/src/main/resources`](../../backend/src/main/resources)), then the
  active profile files, then environment variables and JVM system properties.
  When the same key is in both base files, the `.properties` value wins.
- Any key can be set from the environment with Spring's relaxed binding:
  upper-case it and replace `.` and `-` with `_`. `modulo.security.jwt-secret`
  becomes `MODULO_SECURITY_JWT_SECRET`. This is how every deployment in the repo
  configures the backend.
- Some profile files also expose shorter placeholders such as
  `${MODULO_JWT_SECRET}` or `${DATABASE_URL}`. Those only work under that profile;
  the relaxed-binding name always works.
- `ModuloProperties`, `DatabaseProperties`, `ServerProperties`, `GrpcProperties`
  and `ManagementProperties` (in
  [`config/properties`](../../backend/src/main/java/com/modulo/config/properties))
  are `@Validated`. An invalid value stops startup with the constraint message.

## Profiles

Select with `SPRING_PROFILES_ACTIVE` (comma-separated).

| Profile | File(s) | Purpose |
|---------|---------|---------|
| (none) | `application.yml`, `application.properties` | In-memory H2, Hibernate `ddl-auto=update`, Flyway off. Local and test use. |
| `docker` | `application.yml` (`docker` document), `application-docker.properties` | PostgreSQL from `SPRING_DATASOURCE_*`, Flyway on, `ddl-auto=validate`. Used by every Compose deployment. |
| `staging` | `application.yml` (`staging` document), `application-staging.properties` | PostgreSQL defaulting to `modulodb_staging`, Flyway on. |
| `production` | `application-production.properties` | PostgreSQL from required `SPRING_DATASOURCE_*`, Flyway on. |
| `kubernetes` | `application-kubernetes.properties` | PostgreSQL, Flyway on, OTel endpoint and Kubernetes resource attributes from env. |
| `azure` | `application-azure.properties` | Azure App Service/AKS: `DATABASE_URL`, OAuth client secrets from env, secure cookies, management on 8080. Flyway is not enabled by this profile. |
| `dev` | `application-dev.properties` | Port 8081, debug logging, graph projection off. Its `modulo.security.*` placeholders fail validation; override them. |
| `oidc` | `application.yml` (`oidc` document) | Resource-server issuer for the Envoy/OPA overlay. |
| `security` | `application-security.properties` | Hardened preset: TLS on, actuator reduced to `health,info`, rate limiting, audit logging flags. Combine with a data profile. |
| `performance` | `application-performance.properties` | Hikari, Hibernate batching, response compression, async pool tuning. |
| `cloud` | none | Activates `CloudSecurityConfig` (security headers, CORS from `modulo.security.allowed-origins`). |
| `test` | test resources | Disables schedulers such as workflow retention and the plugin-state outbox. |

The `kubernetes` and `azure` profiles were written for the cluster and Azure
deployments that were retired in #540. No kept deployment activates them; the
manifests and scripts that did are preserved in commit `86644da` (see
[Deployment](../operations/deployment.md#archived-cloud-deployments)).

## Server and management

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `server.port` | `SERVER_PORT` | `8080` (`8081` under `dev`) | Validated 1024–65535. |
| `server.servlet.context-path` | `SERVER_SERVLET_CONTEXT_PATH` | `/api` | Controllers already map `/api/...`, so every Compose deployment sets `/`. Must not be blank. |
| `server.forward-headers-strategy` | | `framework` | Honour `X-Forwarded-*` behind a proxy. |
| `server.servlet.session.cookie.secure` | | `false` (`true` under `azure`) | |
| `server.servlet.session.timeout` | | `30m` | |
| `spring.servlet.multipart.max-file-size` | | `25MB` | Per file. PDF tools accept 25 MB; attachments are further capped at 10 MB. |
| `spring.servlet.multipart.max-request-size` | | `100MB` | |
| `spring.task.scheduling.pool.size` | | `4` | Keeps metrics and retention responsive while the workflow dispatcher is busy. |
| `management.server.port` | `MANAGEMENT_SERVER_PORT` | `8081` (`8080` under `azure`) | Actuator runs on its own port unless you set it to the server port. |
| `management.endpoints.web.base-path` | | `/actuator` | |
| `management.endpoints.web.exposure.include` | `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE` | `*` | `health,info` under `security`. |
| `management.endpoint.health.show-details` | | `always` | `when-authorized` under `azure` and `security`. |
| `management.endpoint.health.probes.enabled` | | `true` | Enables `/actuator/health/liveness` and `/readiness`. |
| `grpc.server.port` | `GRPC_SERVER_PORT` | `9090` | gRPC services load only when `modulo.features.enable-grpc=true`. |
| `grpc.server.enable-reflection` | | `true` | |

## Database and schema

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `spring.datasource.url` | `SPRING_DATASOURCE_URL` | `jdbc:h2:mem:modulodb` | Must be `jdbc:h2:` or `jdbc:postgresql:`. |
| `spring.datasource.username` | `SPRING_DATASOURCE_USERNAME` | `sa` | |
| `spring.datasource.password` | `SPRING_DATASOURCE_PASSWORD` | `password` | |
| `spring.datasource.driver-class-name` | | `org.h2.Driver` | `org.postgresql.Driver` in PostgreSQL profiles. |
| `spring.datasource.hikari.*` | | Hikari defaults | Tuned in `azure`, `security`, `performance`. |
| `spring.jpa.hibernate.ddl-auto` | | `update` (H2) / `validate` (PostgreSQL profiles) | Never `update` against PostgreSQL. |
| `spring.flyway.enabled` | `SPRING_FLYWAY_ENABLED` | `false`; `true` in `docker`, `staging`, `production`, `kubernetes` | |
| `spring.flyway.locations` | | `classpath:db/postgresql` | |
| `spring.flyway.table` | | `modulo_schema_history` | |
| `spring.flyway.schemas` | | `public,application` | |
| `spring.flyway.baseline-on-migrate` | | `false` | Existing databases are adopted explicitly. |
| `spring.flyway.clean-disabled` | | `true` | |

See [Database operations](../operations/database.md).

## Knowledge graph (Neo4j)

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `spring.neo4j.uri` | `SPRING_NEO4J_URI` | `bolt://localhost:7687` | |
| `spring.neo4j.authentication.username` | `SPRING_NEO4J_AUTHENTICATION_USERNAME` | `neo4j` | |
| `spring.neo4j.authentication.password` | `SPRING_NEO4J_AUTHENTICATION_PASSWORD` | `test` | |
| `modulo.graph.enabled` | `MODULO_GRAPH_ENABLED` | `true` | `false` under `dev`. When off or Neo4j is unreachable, graph panels show empty states. |
| `modulo.graph.backfill-on-startup` | `MODULO_GRAPH_BACKFILL_ON_STARTUP` | `false` | Projects all notes and links from PostgreSQL at startup. On demand: `POST /api/graph/backfill`. |
| `modulo.knowledge.index-interval-ms` | | `2000` | Embedding indexer poll interval. |
| `modulo.knowledge.index-initial-delay-ms` | | `10000` | |

## Security and authentication

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `modulo.security.jwt-secret` | `MODULO_SECURITY_JWT_SECRET` | dev placeholder | Required. Base64, at least 32 characters. |
| `modulo.security.jwt-expiration-seconds` | | `3600` | 300–86400. |
| `modulo.security.api-key` | `MODULO_SECURITY_API_KEY` | dev placeholder | Required. `mod_` followed by 16+ alphanumerics. |
| `modulo.security.encryption-key` | `MODULO_SECURITY_ENCRYPTION_KEY` | dev placeholder | Required. Also keys the Gmail refresh-token cipher. |
| `modulo.security.enable-csrf` / `enable-cors` | | `true` | |
| `modulo.security.max-login-attempts` | | `3` | 1–10. |
| `modulo.security.account-lockout-duration-seconds` | | `900` | At least 60. |
| `modulo.security.keycloak.jwk-set-uri` | `MODULO_SECURITY_KEYCLOAK_JWK_SET_URI` | unset | When set, `ResourceServerSecurityConfig` validates Keycloak bearer tokens with this JWKS. Use an address reachable from the backend. |
| `modulo.security.keycloak.issuer-uri` | `MODULO_SECURITY_KEYCLOAK_ISSUER_URI` | unset | Expected `iss`. Must be the browser-facing issuer URL. |
| `spring.security.oauth2.resourceserver.jwt.issuer-uri` | | unset (`oidc` profile sets it) | Read by `AuthenticatedUserService`. |
| `spring.security.oauth2.client.registration.{google,azure}.*` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (under `azure`) | `test` | Legacy OAuth2 login clients. |
| `modulo.security.allowed-origins` | `MODULO_SECURITY_ALLOWED_ORIGINS` | empty (WebSocket); `http://localhost:3000,https://modulo-app.com` (`cloud`) | Allowed origins for `/ws` and, under `cloud`, CORS. |
| `modulo.security.rate-limit.enabled` | | `true` | `RateLimitingFilter`, per client IP. Returns 429. |
| `modulo.security.rate-limit.requests-per-minute` | | `100` | |
| `modulo.security.rate-limit.burst-capacity` | | `20` | |
| `modulo.security.rate-limiting.enabled` | | `true` | Separate flag read by `CloudSecurityConfig` (`cloud` profile). |
| `modulo.security.jwt.secret` | | unset | Read by `CloudSecurityConfig` only. |
| `modulo.security.testing.enabled` | | `false` | Enables `/api/security/testing/*` probes. Never in production. |
| `modulo.security.testing.api-key` | | empty | Key those probes require. |
| `modulo.auth.dual-auth-enabled` | | `true` in `application.properties` (code default `false`) | Accept legacy and Keycloak sessions during migration. |
| `modulo.auth.default-provider` | | `KEYCLOAK` | |
| `modulo.auth.migration-grace-period-days` | | `30` | |

## Application features and limits (`ModuloProperties`)

| Key | Default | Range / notes |
|-----|---------|---------------|
| `modulo.features.enable-blockchain` | `true` | |
| `modulo.features.enable-websockets` | `true` | |
| `modulo.features.enable-grpc` | `true` | Gates the gRPC plugin services. |
| `modulo.features.enable-offline-mode` | `true` | |
| `modulo.features.enable-plugin-system` | `true` | |
| `modulo.features.enable-file-upload` | `true` | |
| `modulo.features.enable-search` | `true` | |
| `modulo.features.enable-notifications` | `true` | |
| `modulo.performance.max-file-size-mb` | `10` | 1–100 |
| `modulo.performance.thread-pool-size` | `10` | 1–100 |
| `modulo.performance.request-timeout-ms` | `30000` | 1000–300000 |
| `modulo.performance.cache-size` | `1000` | 100–10000 |
| `modulo.performance.cache-ttl-seconds` | `3600` | 60–86400 |
| `modulo.integrations.external.api-timeout-ms` | `10000` | 1000–60000 |
| `modulo.integrations.external.max-retries` | `3` | 1–5 |
| `modulo.integrations.external.retry-delay-ms` | `2000` | 1000–10000 |

## Blueprints, workflows and approvals

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `modulo.blueprint.sandbox` | `MODULO_BLUEPRINT_SANDBOX` | `wasm` | The only accepted value. Any other value fails startup. See [Blueprints](../features/blueprints.md). |
| `modulo.workflow.scheduler.poll-ms` | | `1000` | Durable dispatcher poll. |
| `modulo.workflow.operations.poll-ms` | | `30000` | Refreshes workflow metrics and evaluates workflow alerts. |
| `modulo.workflow.retention.enabled` | | `true` | Hourly pruning of old run data. |
| `modulo.workflow.retention.interval-ms` | | `3600000` | |
| `modulo.workflow.trace.redact-patterns` | | empty | Extra regexes redacted from execution traces. |
| `modulo.approval.poll-ms` | | `5000` | Interval of the approval sweep (`ApprovalService.sweep`). |
| `modulo.approvals.signing.private-key-file` | | empty | Ed25519 private key (PKCS#8) used to sign approval decisions. |
| `modulo.approvals.signing.public-key-file` | | empty | Matching Ed25519 public key (X.509). The pair is self-checked at startup. |
| `modulo.approvals.signing.required` | | `false` | When `true`, startup fails unless both key files load as a valid pair. When `false` and both paths are empty, decisions are unsigned. |

See [Workflows and approvals](../features/workflows-and-approvals.md) and
[Runbooks](../operations/runbooks.md).

## Plugins and marketplace

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `modulo.plugins.broker.enabled` | `MODULO_PLUGINS_BROKER_ENABLED` | `false` | NATS bridge for external plugin workloads. If on but NATS is down, bridging suspends; in-JVM events continue. |
| `modulo.plugins.broker.url` | `MODULO_PLUGINS_BROKER_URL` | `nats://nats:4222` | |
| `modulo.plugins.external.health-interval-ms` | | `30000` | Health polling of EXTERNAL plugins. |
| `modulo.plugins.first-party-origins` | | `https://github.com/Ikey168/Modulo` | Comma-separated URL prefixes allowed to run in-JVM; everything else is EXTERNAL-only. |
| `modulo.marketplace.trust.oidc-issuer` | | `https://token.actions.githubusercontent.com` | Expected Sigstore certificate issuer for marketplace artifacts. |
| `modulo.marketplace.trust.identity-regexp` | | `.*` | Expected signer identity. Narrow it in production. |
| `modulo.state.delivery.enabled` | | `true` | Plugin-state outbox delivery. |
| `modulo.state.delivery-delay-ms` | | `1000` | |

See [Plugins](../features/plugins.md).

## Files and attachments

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `modulo.upload.dir` | `MODULO_UPLOAD_DIR` | `${java.io.tmpdir}` | Local-filesystem attachment store used when Azure is not configured. Set it to a persistent volume. |
| `azure.storage.account-name` | `AZURE_STORAGE_ACCOUNT_NAME` | `modulostorage` | |
| `azure.storage.connection-string` | `AZURE_STORAGE_CONNECTION_STRING` | empty | |
| `azure.storage.account-key` | `AZURE_STORAGE_ACCOUNT_KEY` | empty | |
| `azure.storage.use-managed-identity` | `AZURE_STORAGE_USE_MANAGED_IDENTITY` | `true` | |
| `azure.storage.container-name` | `AZURE_STORAGE_CONTAINER_NAME` | `attachments` | |
| `azure.storage.cdn-endpoint` | `AZURE_CDN_ENDPOINT` | empty | |
| `azure.storage.max-file-size` | `AZURE_STORAGE_MAX_FILE_SIZE` | `10485760` | |
| `azure.storage.allowed-content-types` | `AZURE_STORAGE_ALLOWED_CONTENT_TYPES` | images, PDF, text, Word | The code default also allows WebP, Markdown, `message/rfc822` and audio types; `application.properties` narrows it. |
| `app.offline.database.enabled` | | `false` | SQLite offline store. |
| `app.offline.database.path` | | `./data/offline.db` | |

## Integrations

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `modulo.integrations.ipfs.enabled` | `MODULO_INTEGRATIONS_IPFS_ENABLED` | `true` | |
| `modulo.integrations.ipfs.node-url` | `MODULO_INTEGRATIONS_IPFS_NODE_URL` | `http://localhost:5001` | |
| `modulo.integrations.ipfs.gateway-url` | `MODULO_INTEGRATIONS_IPFS_GATEWAY_URL` | `http://localhost:8080` | |
| `modulo.integrations.blockchain.network` | `BLOCKCHAIN_NETWORK` (docker/staging) | `localhost` | One of `mainnet`, `sepolia`, `mumbai`, `polygon`, `localhost`. |
| `modulo.integrations.blockchain.rpc-url` | `BLOCKCHAIN_RPC_URL` (docker/staging) | `http://localhost:8545` | |
| `modulo.integrations.blockchain.gas-limit` / `gas-price-wei` | | `8000000` / `20000000000` | |
| `blockchain.network.rpc-url` | `BLOCKCHAIN_NETWORK_RPC_URL` | `http://localhost:8545` | Used by `BlockchainConfig`. |
| `blockchain.network.chain-id` | | `31337` | |
| `blockchain.contract.note-registry-address` etc. | | Hardhat default addresses | Also `modulo-token-address`, `note-monetization-address`. |
| `blockchain.private-key` | `BLOCKCHAIN_PRIVATE_KEY` | Hardhat account 0 | Replace for any real network. |
| `blockchain.gas.price` / `gas.limit` | | `20000000000` / `3000000` | |
| `modulo.remote.credential-key` | `MODULO_REMOTE_CREDENTIAL_KEY` | empty | Base64 32-byte AES key for server-held service credentials (feeds, CalDAV, ntfy, metadata). Empty: credential endpoints answer 503. |
| `modulo.remote.allow-private-networks` | `MODULO_REMOTE_ALLOW_PRIVATE_NETWORKS` | `false` | Let server-side fetchers reach private addresses. Any signed-in user can then make the server call internal hosts. |
| `modulo.praxis.enabled` | `MODULO_PRAXIS_ENABLED` | `false` | Praxis control-plane client (mutual TLS plus bearer token). |
| `modulo.praxis.base-url` | `MODULO_PRAXIS_URL` | empty | |
| `modulo.praxis.ca-file` | `MODULO_PRAXIS_CA_FILE` | empty | Internal CA. |
| `modulo.praxis.client-cert-file` / `client-key-file` | `MODULO_PRAXIS_CLIENT_CERT_FILE` / `MODULO_PRAXIS_CLIENT_KEY_FILE` | empty | Key is unencrypted PKCS#8 PEM. |
| `modulo.praxis.token-file` | `MODULO_PRAXIS_TOKEN_FILE` | empty | Otherwise the token is read from the env var named by `modulo.praxis.token-env` (default `PRAXIS_MODULO_TOKEN`). |
| `modulo.praxis.connect-timeout` / `request-timeout` / `stream-timeout` | | `5s` / `35s` / `10m` | |
| `noesis.brief.url` | `NOESIS_BRIEF_URL` | `http://localhost:8012` | Noesis API for the `action.noesis.brief` node. |
| `noesis.intake.mcp-url` | `NOESIS_INTAKE_MCP_URL` | empty | Noesis MCP endpoint for record intake. |
| `noesis.intake.credentials-file` | `NOESIS_INTAKE_CREDENTIALS_FILE` | empty | |
| `modulo.gmail.client-id` / `client-secret` | `MODULO_GMAIL_CLIENT_ID` / `MODULO_GMAIL_CLIENT_SECRET` | empty | Gmail mailbox connector; off when empty. |
| `modulo.gmail.redirect-uri` | `MODULO_GMAIL_REDIRECT_URI` | empty | `<public URL>/api/public/gmail/callback`. |
| `modulo.gmail.poll-ms` | | `60000` | |
| `google.calendar.enabled` | | `false` | Plus `google.calendar.api.key`, `client.id`, `client.secret`. |
| `openai.api.key` | `OPENAI_API_KEY` | unset | AI note summarisation. Also `openai.api.url`, `openai.model` (`gpt-3.5-turbo`), `openai.max.tokens` (`500`), `openai.temperature` (`0.7`). |

See [Integrations](../features/integrations.md).

## Observability

| Key | Env var | Default | Notes |
|-----|---------|---------|-------|
| `otel.service.name` | `OTEL_SERVICE_NAME` | `modulo-backend` | |
| `otel.service.version` | `OTEL_SERVICE_VERSION` | `1.0.0` | |
| `otel.traces.exporter` | `OTEL_TRACES_EXPORTER` | `otlp` | `otlp` or `jaeger`. |
| `otel.exporter.otlp.endpoint` | `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | gRPC. |
| `otel.exporter.jaeger.endpoint` | `OTEL_EXPORTER_JAEGER_ENDPOINT` | `http://localhost:14250` | Used when the exporter is `jaeger`. |
| `management.metrics.tags.application` | | `modulo-backend` | Label used by the SLO queries. |
| `management.metrics.distribution.percentiles-histogram.http.server.requests` | | `true` | Required for latency SLIs. |

The tracer is built by hand in
[`OpenTelemetryConfig`](../../backend/src/main/java/com/modulo/config/OpenTelemetryConfig.java),
not by the OTel Java agent. It reads only the five `otel.*` keys above. The
`otel.traces.sampler*`, `otel.instrumentation.*`, `otel.propagators` and
`otel.resource.attributes*` keys in the property files, and `OTEL_SDK_DISABLED`,
have no effect; every span is exported and `deployment.environment` is always
`development`. See [Observability](../operations/observability.md).

## Chaos testing

Testing only. All off by default.

| Key | Default |
|-----|---------|
| `modulo.chaos.enabled` | `false` |
| `modulo.chaos.opa-failure-rate` | `0.0` |
| `modulo.chaos.keycloak-failure-rate` | `0.0` |
| `modulo.chaos.database-failure-rate` | `0.0` |
| `modulo.chaos.network-delay-ms` | `0` |

## Frontend

### Build time (Vite)

Read from `frontend/.env*` or the shell when running `vite` or `vite build`.
See [`frontend/.env.example`](../../frontend/.env.example).

| Variable | Default | Notes |
|----------|---------|-------|
| `VITE_KEYCLOAK_URL` | `http://localhost:8180/realms/modulo` | OIDC issuer; the runtime value below overrides it. |
| `VITE_KEYCLOAK_CLIENT_ID` | `modulo-frontend` | |
| `VITE_DEV_BYPASS_AUTH` | `false` | `true` enters as a mock user. Only honoured in Vite dev builds. |
| `VITE_NOTE_WORKBENCH_ENABLED` | enabled | `false` boots without the note-workbench feature pack. |
| `VITE_GOOGLE_CLIENT_ID` | empty | Android native OAuth. |
| `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID` | empty, `common` | Android native OAuth. |
| `VITE_API_BASE_URL` | `http://localhost:8090` | Read only by the legacy `ApiClient` class. The main client calls same-origin `/api`. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Dev server only: where Vite proxies `/api`. |

### Container runtime

The frontend image writes `/runtime-config.js` at start
([`frontend/docker/40-runtime-config.sh`](../../frontend/docker/40-runtime-config.sh)),
so one image can be promoted between hosts. nginx and the service worker do not
cache that file.

| Variable | Default | Notes |
|----------|---------|-------|
| `MODULO_OIDC_ISSUER` | `http://localhost:8180/realms/modulo` | Must be `http(s)://` and URL-safe characters, or the container refuses to start. |
| `MODULO_OIDC_CLIENT_ID` | `modulo-frontend` | Letters, digits, `.`, `_`, `-`. |

The Android build sets `window.__MODULO_CONFIG__.serverOrigin` at runtime to the
server the user picks; see [Mobile and desktop](../features/mobile-and-desktop.md).

## Keys that nothing reads

These appear in the property files but no code binds them. Changing them has no
effect.

| Keys | Where |
|------|-------|
| `modulo.features.*.enabled` (for example `modulo.features.blockchain.enabled`) | `application.properties`, `dev`, `azure`, `kubernetes`. The bound names are `modulo.features.enable-*`. |
| `modulo.performance.file.max-size`, `modulo.performance.timeout.*`, `modulo.performance.cache.ttl` | same. Bound names are `modulo.performance.max-file-size-mb` etc. |
| `modulo.integrations.blockchain.polygon.rpc-url`, `modulo.integrations.external-api.timeout` | same |
| `modulo.auth.conflict-resolution-strategy`, `auto-migrate-legacy-users`, `require-manual-review-threshold` | `application.properties` |
| `modulo.security.headers.*`, `csp.*`, `cors.*`, `session.*`, `oauth2.*`, `audit.*` | `application-security.properties` |
| `modulo.performance.monitoring.*`, `modulo.cache.*` | `application-performance.properties` |
| `app.upload.dir`, `app.upload.max-file-size`, `app.offline.sync.*` | `application.properties` |
| `azure.application-insights.*` | `application.properties`, `azure` |
| `otel.traces.sampler*`, `otel.instrumentation.*`, `otel.propagators`, `otel.resource.attributes*` | see [Observability](#observability) |
