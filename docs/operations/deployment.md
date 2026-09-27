# Deployment

This page is for operators choosing and running a Modulo deployment. It covers
the supported targets (a single OCI host and a Raspberry Pi, plus the Kubernetes
pieces that run external plugins), what each one runs, how secrets reach the
backend, and the known gaps in each path. How images are built, signed and promoted is in
[Releases and supply chain](releases-and-supply-chain.md); backups are in
[Database operations](database.md); every backend key is in the
[configuration reference](../reference/configuration.md).

## Choosing a target

| Target | Files | Status | Use it for |
|--------|-------|--------|-----------|
| OCI host (Oracle A1, ARM64) | [`deploy/oci/`](../../deploy/oci) | Production path. Digest-pinned releases, verified backups, automated rollback. | The running personal deployment. |
| Raspberry Pi 5 | [`deploy/pi/`](../../deploy/pi) | Minimal self-hosted stack, builds on the device. | A home server on a LAN or tailnet. |
| External plugins on Kubernetes | [`helm/plugin/`](../../helm/plugin), [`argocd/`](../../argocd), [`k8s/nats/`](../../k8s/nats) | Plugin workloads and their broker only; the core is not deployed to Kubernetes. | Running external plugins ([ADR 0004](../architecture/decisions.md#adr-0004)). |
| Local stack | [`docker-compose.yml`](../../docker-compose.yml) | Development. | See [Local development](../getting-started/local-development.md). |

The cluster and cloud stacks that used to sit alongside these (plain `k8s/`
manifests for the core, the `api`/`web`/`worker`/`keycloak` Helm charts, Argo
Rollouts, Azure scripts and workflows, Terraform) were unused and did not work
as committed. They were removed in #540 and are preserved at the Git tag
[`archive/cloud-deployments`](#archived-cloud-deployments).

Every target runs the same two application images (frontend nginx and Spring
Boot backend) plus PostgreSQL, Neo4j and Keycloak. The backend is always started
with `SERVER_SERVLET_CONTEXT_PATH=/` in Compose-based targets because the
controllers carry their own `/api` prefix.

## OCI production host

One ARM64 Oracle A1 VM runs Modulo and a private Noesis API. Only Caddy
publishes ports (80, 443). Noesis listens on `127.0.0.1:8012` and is reached
through an SSH tunnel.

| Service | Image | Memory cap | Notes |
|---------|-------|-----------|-------|
| caddy | `caddy:2.10.2-alpine` | 128 MB | TLS, routing ([`Caddyfile`](../../deploy/oci/Caddyfile)) |
| frontend | built or digest-pinned | 160 MB | `MODULO_OIDC_ISSUER=${MODULO_URL}/auth/realms/modulo` |
| backend | built or digest-pinned | 1.5 GB | `docker` profile, Flyway, OTel disabled, IPFS off |
| keycloak | [`keycloak.Containerfile`](../../deploy/oci/keycloak.Containerfile) | 1.25 GB | Production mode (`start --optimized`), served at `/auth`, PostgreSQL-backed |
| db | `postgres:16.10-alpine` | 768 MB | Also hosts the `keycloak` database ([`postgres-init/10-keycloak.sh`](../../deploy/oci/postgres-init/10-keycloak.sh)) |
| neo4j | `neo4j:5.26.12-community` | 1.25 GB | |
| noesis | built from `NOESIS_CONTEXT` | 5 GB | Bound to localhost only |

Networks: `edge` (Caddy, frontend), `internal` (everything), `egress` (backend
and services that must reach the Internet).

Caddy routes: `/api/*` and `/ws*` to the backend, `/auth/callback` and
`/auth/silent-callback` to the frontend, other `/auth/*` to Keycloak, everything
else to the frontend. It answers CORS preflight for the Android app's
`https://localhost` origin on `/api/*`, and serves cached cover images from
`/media-cache/*`.

### First deployment

From `/srv/modulo/deploy/oci`:

```sh
./init-env.sh https://modulo.example.com     # writes .env with generated secrets; refuses to overwrite
./render-realm.sh                            # renders generated/realm-modulo.json for this URL
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --build
MODULO_URL=https://modulo.example.com ./status.sh
```

- Before DNS exists you can use `http://SERVER_IP` as the URL. Do not type
  credentials into that plaintext endpoint.
- The realm is imported once. Changing the URL later means updating the existing
  realm and client in Keycloak as well; startup imports do not overwrite them.
- The frontend reads its issuer from `MODULO_OIDC_ISSUER` at container start, so
  the same tested image can move between hosts.
- `status.sh` fails if any of `/health`, `/api/health` or Noesis `/health` fails.

Reach Noesis from a trusted workstation:

```sh
ssh -L 8012:127.0.0.1:8012 ubuntu@SERVER_IP
curl http://127.0.0.1:8012/health
```

### `.env` on the host

[`init-env.sh`](../../deploy/oci/init-env.sh) generates this from
[`.env.example`](../../deploy/oci/.env.example):

| Variable | Purpose |
|----------|---------|
| `MODULO_SITE`, `MODULO_URL` | Caddy site address and public URL |
| `NOESIS_CONTEXT` | Absolute path of the Noesis checkout on the server |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Application database |
| `KEYCLOAK_DB_PASSWORD`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` | Keycloak |
| `NEO4J_PASSWORD` | Neo4j |
| `MODULO_SECURITY_JWT_SECRET`, `MODULO_SECURITY_API_KEY`, `MODULO_SECURITY_ENCRYPTION_KEY` | Required backend secrets |
| `NOESIS_JWT_SECRET`, `NOESIS_API_KEY_SALT` | Noesis |
| `MODULO_REMOTE_CREDENTIAL_KEY` | Optional. Base64 32-byte key; empty disables stored service credentials. |
| `MODULO_GMAIL_CLIENT_ID`, `MODULO_GMAIL_CLIENT_SECRET` | Optional Gmail connector. The redirect URI is derived from `MODULO_URL`. |
| `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_NETWORK` | Optional anchoring RPC. `BLOCKCHAIN_NETWORK` must be one of `mainnet`, `sepolia`, `mumbai`, `polygon`, `localhost`: the example value `base` fails `ModuloProperties` validation. |

### Releasing a validated build

Existing Hibernate-managed installations must finish the one-time schema
adoption first ([Database operations](database.md#adopting-an-existing-database)).
Fresh databases migrate automatically.

1. Take the immutable image references for the commit you want from the
   `signed-artifact-manifest-<sha>` artifact of the
   [Signed production CI](releases-and-supply-chain.md#build-sign-and-promote)
   run on `main`. They look like `ghcr.io/ikey168/modulo/backend@sha256:...`.
   Keep them with the deployment record. Never substitute `latest`.
2. Export `MODULO_URL` and `MODULO_SMOKE_TOKEN_FILE`. The token file (mode
   0600) holds a short-lived bearer token for a dedicated test user that may
   create, read and delete notes. Get it through a normal Keycloak login; no
   password grant or permanent admin credential is needed.
3. Load the backup credentials (`/etc/modulo/backup.env`) into the environment.
4. Deploy:

   ```sh
   ./release.sh deploy FRONTEND_IMAGE@sha256:DIGEST BACKEND_IMAGE@sha256:DIGEST
   ```

What `release.sh deploy` does, in order:

1. Refuses anything that is not `name@sha256:<64 hex>`; takes a lock so two
   releases cannot overlap.
2. Pulls both images.
3. Runs `backup.sh` (verified, uploaded off-host).
4. Runs `restore-drill.sh` on that snapshot with the candidate backend as the
   migration image: migrations and schema validation run against an isolated
   restored copy.
5. Replaces only the frontend and backend containers (`--no-deps --wait`, 240 s
   timeout). Backing services must already be running.
6. Runs [`verify-deployment.py`](../../deploy/oci/verify-deployment.py): frontend
   and backend health, `runtime-config.js` issuer matches the deployment,
   OIDC discovery, anonymous `/api/notes` rejected, then an authenticated note is
   created, read back exactly, deleted, and confirmed gone (cleanup runs even if
   read-back fails).
7. On success records the pair in `.releases/current` (the previous pair moves
   to `.releases/previous`). On failure it redeploys the currently recorded pair,
   verifies it, and exits non-zero. With no recorded release there is no
   automatic rollback target.

Rollback:

```sh
./release.sh rollback
```

It swaps the application images back to `.releases/previous` and verifies. It
does not reverse migrations, which is why migrations must stay backward
compatible with the previous release.

For the full gate at any time:

```sh
python3 verify-deployment.py --url https://modulo.example.com --token-file /secure/token
```

Backups and restore drills for this host are in
[Database operations](database.md#oci-host-production).

## Raspberry Pi

The minimal stack (Caddy, frontend, backend, Keycloak, PostgreSQL, Neo4j) tuned
for an 8 GB Pi 5. No observability sidecars and no IPFS node.

Hardware: Raspberry Pi 5 with 8 GB. Boot from NVMe or a USB SSD, not an SD card:
PostgreSQL and Neo4j write constantly and SD cards are slow and wear out. Use
64-bit Raspberry Pi OS (Bookworm) or another arm64 Debian/Ubuntu, with Docker.

```sh
git clone https://github.com/Ikey168/Modulo.git
cd Modulo/deploy/pi
cp .env.example .env          # fill in every value; generation commands are in the file
docker compose -f docker-compose.pi.yml up -d --build
```

The first build compiles backend and frontend on the Pi (20–40 minutes). To
avoid that, build on a PC with `docker buildx build --platform linux/arm64` and
load the images.

Choose how the Pi is reached; this sets `MODULO_URL` and `MODULO_DOMAIN`:

| Access | `MODULO_URL` | `MODULO_DOMAIN` | Notes |
|--------|--------------|-----------------|-------|
| LAN by IP | `http://192.168.x.x` | `:80` | Simplest |
| LAN mDNS | `http://modulo.local` | `modulo.local:80` | Needs avahi |
| Tailscale (recommended) | `http://<pi>.<tailnet>.ts.net` | `<pi>.<tailnet>.ts.net:80` | Reachable from your devices, nothing exposed publicly |
| Public domain | `https://modulo.example.com` | `modulo.example.com` | Caddy gets Let's Encrypt certificates; needs DNS and open 80/443 |

| Service | Memory cap |
|---------|-----------|
| caddy | 128 MB |
| frontend | 128 MB |
| backend | 1.5 GB |
| keycloak | 768 MB |
| db | 512 MB |
| neo4j (512 MB heap, 128 MB page cache) | 1 GB |

About 4 GB is committed, leaving half of an 8 GB Pi for page cache and builds.
Only Caddy publishes ports; Keycloak is served through Caddy at `/auth`.

First login: open `MODULO_URL`. The `modulo` realm is imported on first start;
create your user in the admin console at `MODULO_URL/auth/admin/`.

Updating:

```sh
cd ~/Modulo && git pull
cd deploy/pi && docker compose -f docker-compose.pi.yml up -d --build
```

`MODULO_URL` is baked into the Pi frontend build, so rebuild after changing it.

Known limits:

- Keycloak runs in `start-dev` mode. That is acceptable on a LAN or tailnet;
  before exposing the Pi to the Internet, move Keycloak to production mode with a
  database and hostname configuration (as the OCI stack does).
- Blueprint webhooks (`/api/public/blueprints/webhook/...`) are reachable only
  where Caddy is reachable.
- For on-chain anchoring, deploy `NoteRegistry.sol` to an L2 and set
  `BLOCKCHAIN_RPC_URL` (and a valid `BLOCKCHAIN_NETWORK`) in `.env`. Left empty,
  anchoring is unavailable and everything else works.

## Kubernetes for external plugins

External plugins ([ADR 0004](../architecture/decisions.md#adr-0004)) run as
Kubernetes workloads next to a core that runs elsewhere. Only the pieces they
need are kept:

| Path | Purpose |
|------|---------|
| [`helm/plugin`](../../helm/plugin) | One external plugin workload (ServiceAccount, Deployment, Service, deny-by-default NetworkPolicy). Also what [`scripts/deploy-marketplace-release.mjs`](../../scripts/deploy-marketplace-release.mjs) installs with `helm upgrade --install`. |
| [`argocd/app-of-apps.yaml`](../../argocd/app-of-apps.yaml) | Syncs everything under `argocd/apps/` (recursively) from `main` |
| [`argocd/apps/plugins/`](../../argocd/apps/plugins) | One Argo CD Application per plugin; [`script-sandbox.yaml`](../../argocd/apps/plugins/script-sandbox.yaml) is the reference |
| [`argocd/apps/nats.yaml`](../../argocd/apps/nats.yaml), [`k8s/nats/`](../../k8s/nats) | NATS broker for the plugin event bridge |

All Applications deploy to the `modulo` namespace with automated sync, prune and
self-heal. How to build, deploy and attach a plugin is in
[Plugins](../features/plugins.md#deploying-external-plugins).

## Archived cloud deployments

The tag `archive/cloud-deployments` points at the last commit that contained the
retired cluster and cloud stacks:

| Removed | What it was |
|---------|-------------|
| `k8s/` (except `k8s/nats/`) | Plain manifests for the core, PostgreSQL, ingress and autoscaling; Kyverno image-signature policies; External Secrets with Azure Key Vault; Prometheus, Grafana, Loki and Tempo with SLO recording and burn-rate rules and dashboards; PagerDuty, Alertmanager and status-page manifests; Litmus chaos experiments; cost management |
| `helm/api`, `helm/web`, `helm/worker`, `helm/keycloak`, `helm/environments` | Application Helm charts and their values |
| `argocd/apps/{api,web,worker,dev,prod,rollouts}.yaml`, `rollouts/` | Argo CD applications for the core, and Argo Rollouts canary and blue-green |
| `azure/`, `terraform/` | Azure scripts (ACR, AKS, App Service) and Terraform for Azure resources |
| `aks-deploy.yml`, `azure-deploy.yml`, `terraform.yml`, `test-image-signing.yml` | Their GitHub workflows |
| `scripts/setup-image-signing.sh`, `validate-image-signing.sh`, `test-image-signing-comprehensive.sh`, `deploy-autoscaling.sh`, `deploy-external-secrets.sh`, `setup-azure-keyvault.sh`, `rotate-secrets.sh` | Helper scripts for those stacks |

Known problems at archive time: the Azure workflows used placeholder resource
names and waited forever for environment approval, `terraform/main.tf`
referenced a missing `./modules/storage`, the core manifests probed port 8080
while actuator listens on 8081, and the Kyverno policies expected the
`docker-build.yml` signer instead of `signed-production.yml`.

To look at or restore a piece:

```sh
git fetch origin tag archive/cloud-deployments
git show archive/cloud-deployments:k8s/README.md
git checkout archive/cloud-deployments -- k8s/observability    # restore a directory into the working tree
```

The backend's `kubernetes` and `azure` Spring profiles are still in
`backend/src/main/resources/`; see the
[configuration reference](../reference/configuration.md#profiles).

## Secrets

| Target | Where secrets live | How they reach the backend |
|--------|-------------------|---------------------------|
| OCI | `deploy/oci/.env` (mode 0600, generated), `/etc/modulo/backup.env`, restic password file | Compose environment |
| Pi | `deploy/pi/.env` | Compose environment |
| Kubernetes (plugin workloads) | Plain Secrets you create | The plugin's `env` values in its Application or Helm release |
| Local | Compose defaults; optional SOPS files | See [Local development](../getting-started/local-development.md#local-secrets) |

## Environments at a glance

| Environment | Where | Profile | Data |
|-------------|-------|---------|------|
| Local | Laptop, `docker-compose.yml` | `docker` | Throwaway volumes |
| CI (ZAP, performance, backups) | GitHub Actions runners | `docker` / `staging` | Ephemeral |
| Staging | `staging` profile, `modulodb_staging` | `staging` | Created by [`database/init`](../../database/init) |
| Production | OCI host | `docker` | Backed up nightly, off-host |
