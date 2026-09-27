# Local development

This page gets a contributor from a fresh clone to a running Modulo stack and a
green local acceptance gate. It covers the toolchain, the two ways to run the
app (full Docker Compose stack or native backend/frontend), tests, local
secrets, and the problems people most often hit.

For what the components are, read [Architecture](../architecture/README.md) first.
For every configuration key mentioned here, see the
[configuration reference](../reference/configuration.md).

## Prerequisites

The toolchain is pinned in [`.mise.toml`](../../.mise.toml). Installing
[mise](https://mise.jdx.dev/) and running `mise install` in the repository root
gives you the right versions.

| Tool | Version | Used for |
|------|---------|----------|
| Java | Temurin 17 | Backend (Spring Boot 2.7) |
| Maven | 3.9 | Backend build (there is no `mvnw` wrapper) |
| Node.js | 22 (exact pin in [`.node-version`](../../.node-version), also used by CI and the frontend Dockerfile) | Frontend, smart contracts, scripts |
| Python | 3.14 | Operations and infrastructure verifiers under `scripts/` |
| Docker + Compose v2 | recent | Full stack, integration tests that use Testcontainers |
| Rust + `wasm32-unknown-unknown` target | stable | Only for `mise run check-wasm` |
| k6 | 0.46+ | Only for load tests |

[`setup.sh`](../../setup.sh) is an older helper that installs npm dependencies and
Husky hooks. Its version checks (Java 11+, Node 18+) are out of date; prefer mise.

## Install dependencies

```sh
mise install                 # toolchain
npm ci                       # root workspace: frontend + smart-contracts + commitlint/husky
```

The root [`package.json`](../../package.json) is an npm workspace containing
`frontend` and `smart-contracts`, so a single `npm ci` at the root installs both.
`npm ci` also runs `husky`, which installs the `commit-msg` hook that enforces
Conventional Commits (see [Commit messages](#commit-messages)).

## Run the full stack with Docker Compose

[`docker-compose.yml`](../../docker-compose.yml) builds the frontend and backend
images and starts every backing service.

```sh
docker compose up --build          # or: npm start
```

| Service | Host port | Notes |
|---------|-----------|-------|
| frontend (nginx) | 80 | Serves the Vite build; proxies `/api` and `/ws` to the backend |
| backend (Spring Boot) | 8080 | `SPRING_PROFILES_ACTIVE=docker`, context path `/` |
| keycloak | 8180 | `start-dev --import-realm` with [`keycloak/realm-modulo.json`](../../keycloak/realm-modulo.json); admin `admin`/`admin` |
| db (PostgreSQL 16) | 5432 | `modulodb`, user/password `postgres`/`postgres` |
| ipfs (kubo) | 4001, 5001, 8082 | Encrypted note sharing |
| otel-collector | 4317, 4318, 8889, 13133 | Receives backend traces |
| jaeger | 16686 | Trace UI |
| prometheus | 9090 | Metrics, 30-day retention |
| grafana | 3000 | `admin`/`admin123` |
| loki | 3100 | Logs |
| elasticsearch | 9200 | Searchable audit logs |
| audit-collector | 8081 | OPA decision-log sink ([`services/audit-collector`](../../services/audit-collector)) |
| opa | 8181, 9191 | Policy engine with decision logging |

Open <http://localhost> and sign in as **demo / demo**. That user is part of the
imported realm and holds the `admin` realm role.

Things to know about the compose stack:

- The backend runs with `SERVER_SERVLET_CONTEXT_PATH=/`. `application.properties` sets a
  `/api` context path, and the controllers already map `/api/...`, so without the
  override every endpoint would live under `/api/api/...`. The override must be
  `/`, not empty: the app's own `ServerProperties` validation rejects a blank
  context path.
- PostgreSQL schema is created by Flyway on first start (profile `docker` enables
  it). See [Database operations](../operations/database.md).
- Dev-only values for `MODULO_SECURITY_JWT_SECRET`, `MODULO_SECURITY_API_KEY` and
  `MODULO_SECURITY_ENCRYPTION_KEY` are filled in by the compose file. Never reuse
  them outside a laptop.
- The backend trusts Keycloak bearer tokens because
  `MODULO_SECURITY_KEYCLOAK_JWK_SET_URI` (fetched over the Docker network) and
  `MODULO_SECURITY_KEYCLOAK_ISSUER_URI` (the browser-facing issuer,
  `http://localhost:8180/realms/modulo`) are set.
- Service volumes use the `:z` suffix so the stack also works on SELinux hosts.

### Optional compose overlays

| File | Purpose | Start with |
|------|---------|------------|
| [`docker-compose.backup.yml`](../../docker-compose.backup.yml) | `db-backup` cron container and a `restore-drill` container (profile `backup`) | `docker compose -f docker-compose.yml -f docker-compose.backup.yml --profile backup up -d` |
| [`docker-compose.envoy-opa.yml`](../../docker-compose.envoy-opa.yml) | Envoy in front of the backend with OPA ext-authz ([`infra/opa`](../../infra/opa)) | `make envoy-opa-up` |

## Run the backend and frontend natively

This is the fastest edit loop. Start only the backing services you need in
Docker, then run the two apps on the host.

### Backing services

[`docker-compose.dev.yml`](../../docker-compose.dev.yml) is a standalone Compose
project (`modulo-dev`) with just the services a native backend and frontend need.
Its definitions mirror `docker-compose.yml`, but it has its own data volume, so it
never touches the full stack's database. It uses the same host ports, so stop one
stack before starting the other.

```sh
docker compose -f docker-compose.dev.yml up -d                           # or: npm run start:dev
docker compose -f docker-compose.dev.yml --profile observability up -d   # also start Jaeger
docker compose -f docker-compose.dev.yml down                            # stop (add -v to drop the database)
```

| Service | Host port | Notes |
|---------|-----------|-------|
| db (PostgreSQL 16) | 5432 | `modulodb`, user/password `postgres`/`postgres`; volume `postgres_dev_data` |
| keycloak | 8180 | Same realm import and theme as the full stack; admin `admin`/`admin`, app login `demo`/`demo` |
| jaeger (profile `observability`) | 16686, 4317, 4318 | Receives OTLP traces directly from a native backend (its default exporter endpoint is `localhost:4317`) |

Metrics, logs and dashboards (Prometheus, Loki, Grafana) are only in the full
stack; see [Observability](../operations/observability.md).

### Backend

```sh
docker compose -f docker-compose.dev.yml up -d   # backing services (see above)
```

With the `dev` profile
([`application-dev.properties`](../../backend/src/main/resources/application-dev.properties))
the backend serves on port 8080 with context path `/`, uses PostgreSQL on
`localhost:5432/modulodb` (`postgres`/`postgres`, Flyway on), and trusts bearer
tokens from the Keycloak realm on `localhost:8180`, which is what the compose `db`
and `keycloak` services provide. Override any of these with the usual
environment variables (`SPRING_DATASOURCE_*`, `MODULO_SECURITY_KEYCLOAK_*`).
Actuator is on the management port 8081.

```sh
cd backend
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

With no profile the backend uses an in-memory H2 database instead (Hibernate
creates the schema, Flyway is off); pass `SERVER_SERVLET_CONTEXT_PATH=/` so the
`/api` routes are not prefixed twice. The `docker` profile is what the Compose
deployments use; it needs `SPRING_DATASOURCE_*` from the environment.

Remote debugging: add
`-Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"`.

### Frontend

```sh
npm run dev --workspace=frontend           # Vite on http://localhost:3000
```

Vite proxies `/api` to `http://localhost:8080`. Point it at any other backend
with `VITE_API_PROXY_TARGET=https://host npm run dev --workspace=frontend`.
Copy [`frontend/.env.example`](../../frontend/.env.example) to `frontend/.env.local`
to change build-time variables. The useful ones:

| Variable | Default | Effect |
|----------|---------|--------|
| `VITE_KEYCLOAK_URL` | `http://localhost:8180/realms/modulo` | OIDC issuer |
| `VITE_KEYCLOAK_CLIENT_ID` | `modulo-frontend` | OIDC client |
| `VITE_DEV_BYPASS_AUTH` | `false` | `true` skips OIDC and enters as a mock user. Honoured only in Vite dev builds. |
| `VITE_NOTE_WORKBENCH_ENABLED` | enabled | `false` boots Core and the Blueprint engine without the note-workbench pack |

`VITE_DEV_BYPASS_AUTH=true` lets you work on UI without running Keycloak; API
calls that need a real token will still fail against a secured backend.

### Keycloak only

`docker compose -f docker-compose.dev.yml up -d keycloak` is enough for login. The realm's
`modulo-frontend` client allows redirects to `localhost:3000`, `:3001`, `:5173`
and `:80`. [`scripts/bootstrap-dev.sh`](../../scripts/bootstrap-dev.sh) can add
extra demo users, roles, a confidential backend client and optional Google/GitHub
identity providers through the admin API. It defaults to
`KEYCLOAK_URL=http://localhost:8080`, so pass `KEYCLOAK_URL=http://localhost:8180`
for the compose Keycloak, plus `KEYCLOAK_ADMIN_PASSWORD=admin`.

### Smart contracts (optional)

```sh
cd smart-contracts
npx hardhat node          # local chain on :8545
npx hardhat test          # or from the root: npm test
```

The backend's blockchain features read `blockchain.*` and
`modulo.integrations.blockchain.*` keys; with no reachable RPC node, anchoring
is unavailable and everything else works.

## Run the tests

| Scope | Command (from repo root unless noted) |
|-------|------------|
| Everything the local gate runs | `mise run check` |
| Frontend unit tests | `npm run test:run --workspace=frontend` (or `npx vitest run` in `frontend/`) |
| One frontend folder | `cd frontend && npx vitest run src/core/` |
| Frontend type check | `npm run typecheck --workspace=frontend` |
| Boundary lint (CI gate) | `npm run lint:boundary:ci --workspace=frontend` |
| Full ESLint (reports existing debt) | `npm run lint --workspace=frontend` |
| Lint against the baseline (CI) | `npm run lint:ci --workspace=frontend` |
| Playwright end-to-end | `npm run test:e2e --workspace=frontend` |
| Backend, full reactor with coverage gate | `mvn -B verify` |
| One backend test class | `cd backend && mvn test -Dtest=MyTest` |
| Several classes, offline | `cd backend && mvn -q -o test -Dtest=Foo,Bar` |
| Smart contracts | `npm test` |
| OPA policies | `make policy-test` |
| Load tests | see [Observability](../operations/observability.md#performance-and-load-testing) |

`lint:ci` compares findings by file, rule, severity, message and count against
[`frontend/eslint-baseline.json`](../../frontend/eslint-baseline.json). Any new
finding fails. Shrink the baseline as you fix issues; never regenerate it to
accept new ones.

Backend PostgreSQL migration tests use Testcontainers, so Docker must be running
for `mvn verify`.

## The local acceptance gate

`mise run check` is the repository's acceptance gate. It runs these tasks:

| Task | What it does |
|------|--------------|
| `check-repository` | `git diff --check` (whitespace and conflict markers) |
| `check-frontend` | typecheck, boundary lint, unit tests, strict production build into a temp dir |
| `check-backend` | `mvn -B verify -Dmaven.test.failure.ignore=false` |
| `check-wasm` | rebuilds the AssemblyScript and Rust WASM node examples and byte-compares them with the fixtures in `backend/src/test/resources/wasm/` |
| `check-infrastructure` | `python3 scripts/verify-personal-infra.py` |

`mise run check-frontend-strict-lint` reports the full ESLint debt and is not part
of `check`.

Modulo shares an engineering contract with the Praxis and Noesis repositories:
each has a root README, CONTRIBUTING, SECURITY, AGENTS file, a `.mise.toml` with
a `check` task, versioned architecture docs with an ADR location, and an example
environment file without live credentials.
[`scripts/verify-repository-contract.py`](../../scripts/verify-repository-contract.py)
checks it. The rules that go with it:

- Work on a branch in reviewable commits; do not rewrite shared history.
- Rebuild generated output from its source. Commit it only where a release
  procedure requires it.
- Update the lock file in the same change as a dependency change.
- "Done" means the changed behaviour ran successfully. Record the exact command,
  result and environment, and name any live gate you did not run. A passing
  schema check or a file existing is not functional acceptance.
- Deployments and data migrations also need an identified rollback and kept
  recovery evidence.
- Write an ADR when a change sets or reverses a durable boundary, authority,
  data-ownership rule, wire or storage contract, or operational invariant.
  Supersede old decisions instead of editing them (see
  [Decision log](../architecture/decisions.md)).

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
enforced by commitlint ([`commitlint.config.js`](../../commitlint.config.js)) in
the Husky `commit-msg` hook. Release Please derives versions from them
(`fix` → patch, `feat` → minor, `!` or `BREAKING CHANGE:` → major); see
[Releases and supply chain](../operations/releases-and-supply-chain.md).

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`. Common scopes: `frontend`, `backend`, `database`,
`docker`, `k8s`, `auth`, `blockchain`, `search`, `websocket`.

The Husky `pre-commit` hook is currently a no-op. A separate
[pre-commit](https://pre-commit.com/) configuration
([`.pre-commit-config.yaml`](../../.pre-commit-config.yaml)) with Gitleaks and file
hygiene hooks is available with `pre-commit install`; see
[Security testing](../operations/security-testing.md#secret-scanning).

## Local secrets

Nothing you need for local development is secret: the compose file and
`application.properties` carry dev-only placeholders. When you want real
credentials locally (OAuth client secrets, API keys for integrations), the repo
supports SOPS-encrypted env files loaded by direnv.

| File | Role |
|------|------|
| [`.sops.yaml`](../../.sops.yaml) | Creation rules for `.env.encrypted`, `smart-contracts/.env.encrypted` and `config/secrets/*.encrypted`. Ships with a placeholder age recipient and a PGP fingerprint. |
| [`.envrc`](../../.envrc) | direnv script: decrypts and loads the encrypted env files, sets development defaults (`SPRING_PROFILES_ACTIVE=dev`, `POSTGRES_*`, `COMPOSE_PROJECT_NAME=modulo-dev`) |
| [`.env.encrypted.example`](../../.env.encrypted.example) | Shape of the encrypted file |
| [`scripts/setup-local-secrets.sh`](../../scripts/setup-local-secrets.sh) | One-time setup |
| [`scripts/manage-secrets.sh`](../../scripts/manage-secrets.sh) | Day-to-day management |

Setup:

```sh
# needs sops, age and direnv on PATH
./scripts/setup-local-secrets.sh
eval "$(direnv hook bash)"      # or zsh; add to your shell rc
direnv allow
```

The setup script generates an age key at `~/.config/sops/age/keys.txt` (back it
up), writes your public key into `.sops.yaml`, creates and encrypts
`.env.encrypted` and `smart-contracts/.env.encrypted` with random values, runs
`direnv allow`, and adds plaintext env files to `.gitignore`.

Day-to-day:

```sh
./scripts/manage-secrets.sh list
./scripts/manage-secrets.sh view .env.encrypted
./scripts/manage-secrets.sh get  .env.encrypted DATABASE_PASSWORD
./scripts/manage-secrets.sh edit .env.encrypted          # or: sops .env.encrypted
./scripts/manage-secrets.sh rotate .env.encrypted JWT_SECRET jwt
./scripts/manage-secrets.sh add-member <age-public-key>
```

Rotation types: `password` (24 characters), `jwt` (base64), `hex` (32 bytes),
`api-key` (`mod_` prefix), and random base64 by default.

To give a teammate access, add their age public key to `.sops.yaml` and run
`sops updatekeys .env.encrypted`. Encrypted files are safe to commit; plaintext
`.env`, `.env.local`, `.env.*.local` and `.env.clear` are not.

The generated file uses generic names (`JWT_SECRET`, `API_KEY`,
`DATABASE_PASSWORD`). Spring Boot does not read those. Export the Spring names
(`MODULO_SECURITY_JWT_SECRET`, `MODULO_SECURITY_API_KEY`,
`SPRING_DATASOURCE_PASSWORD`, ...) in the encrypted file or in `.envrc` if you
want the backend to pick them up.

Cluster secrets are handled differently (External Secrets Operator with Azure
Key Vault); see [Deployment](../operations/deployment.md#secrets).

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| Every API call returns 404 when the backend runs natively | The `/api` context path doubles the prefix. Start with `SERVER_SERVLET_CONTEXT_PATH=/`. |
| Backend fails at startup with `JWT secret must be a valid base64 string` or `API key must start with 'mod_'` | `ModuloProperties` validation. Set `MODULO_SECURITY_JWT_SECRET` (base64, 32+ chars) and `MODULO_SECURITY_API_KEY` (`mod_` + 16+ alphanumerics). |
| Backend fails with `Context path is required` | `SERVER_SERVLET_CONTEXT_PATH` was set to an empty string. Use `/`. |
| Log floods with `Failed to export spans` | No collector at `OTEL_EXPORTER_OTLP_ENDPOINT` (default `localhost:4317`). Start Jaeger with `docker compose -f docker-compose.dev.yml --profile observability up -d`, start the full stack's `otel-collector`, or point the variable at a reachable collector. |
| Login redirects fail or tokens are rejected | Issuer mismatch. The frontend and `MODULO_SECURITY_KEYCLOAK_ISSUER_URI` must both use the browser-facing URL (`http://localhost:8180/realms/modulo`). |
| Keycloak will not start on 8080 | It is mapped to host 8180 on purpose; 8080 and 8081 belong to the backend and audit-collector. |
| Backend refuses to start against an existing PostgreSQL | Flyway validation against a schema that Hibernate created earlier. Follow the adoption procedure in [Database operations](../operations/database.md#adopting-an-existing-database). |
| `docker compose -f docker-compose.dev.yml up` fails with "port is already allocated" | The full stack (or another local service) holds 5432 or 8180. `docker compose down` the other stack first. |
| Upload of a large file fails with 413 or multipart errors | Multipart limit is 25 MB per file and 100 MB per request (`spring.servlet.multipart.*`); attachments are further limited to 10 MB by the app. |
