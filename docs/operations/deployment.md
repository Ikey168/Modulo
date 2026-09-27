# Deployment

This page is for operators choosing and running a Modulo deployment. It covers
the supported targets (a single OCI host, a Raspberry Pi, and Kubernetes with
Helm and Argo CD), what each one runs, how secrets reach the backend, and the
known gaps in each path. How images are built, signed and promoted is in
[Releases and supply chain](releases-and-supply-chain.md); backups are in
[Database operations](database.md); every backend key is in the
[configuration reference](../reference/configuration.md).

## Choosing a target

| Target | Files | Status | Use it for |
|--------|-------|--------|-----------|
| OCI host (Oracle A1, ARM64) | [`deploy/oci/`](../../deploy/oci) | Production path. Digest-pinned releases, verified backups, automated rollback. | The running personal deployment. |
| Raspberry Pi 5 | [`deploy/pi/`](../../deploy/pi) | Minimal self-hosted stack, builds on the device. | A home server on a LAN or tailnet. |
| Kubernetes (plain manifests) | [`k8s/`](../../k8s) | Reference manifests; need adaptation (see gaps below). | A cluster you run yourself. |
| Kubernetes (Helm + Argo CD) | [`helm/`](../../helm), [`argocd/`](../../argocd), [`rollouts/`](../../rollouts) | GitOps scaffolding; values contain placeholders. | Clusters managed through Argo CD. |
| Azure (AKS / App Service) | [`azure/`](../../azure), [`terraform/`](../../terraform), `aks-deploy.yml`, `azure-deploy.yml` | Workflows contain placeholder resource names; Terraform references a missing module. | Starting point only. |
| Local stack | [`docker-compose.yml`](../../docker-compose.yml) | Development. | See [Local development](../getting-started/local-development.md). |

Every target runs the same two application images (frontend nginx and Spring
Boot backend) plus PostgreSQL and Keycloak. The backend is always started
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

The minimal stack (Caddy, frontend, backend, Keycloak, PostgreSQL) tuned
for an 8 GB Pi 5. No observability sidecars and no IPFS node.

Hardware: Raspberry Pi 5 with 8 GB. Boot from NVMe or a USB SSD, not an SD card:
PostgreSQL writes constantly and SD cards are slow and wear out. Use
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

About 3 GB is committed, leaving more than half of an 8 GB Pi for page cache and builds.
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

## Kubernetes with plain manifests

[`k8s/`](../../k8s) is numbered in apply order. [`k8s/deploy.sh`](../../k8s/deploy.sh)
applies them and waits for PostgreSQL; [`k8s/setup-production.sh`](../../k8s/setup-production.sh)
installs prerequisites.

| File | Contents |
|------|----------|
| `00-namespace.yaml`, `01-resourcequota.yaml` | `modulo` namespace and quota |
| `01.5-postgres-deployment.yaml` | Single PostgreSQL pod with a 10 Gi PVC |
| `02-api-configmap.yaml` | `SPRING_PROFILES_ACTIVE=kubernetes`, actuator and metrics settings |
| `03-api-secret.yaml` | `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` (mapped to `SPRING_DATASOURCE_*`) |
| `04-api-deployment.yaml`, `05-api-service.yaml` | Backend, 512 Mi/250 m requests, 2 Gi/1 CPU limits |
| `06`–`08` | Frontend config, deployment, service |
| `09-ingress.yaml`, `cert-manager-issuers.yaml` | nginx ingress with cert-manager TLS |
| `10-api-hpa.yaml`, `vpa-config.yaml` | Autoscaling |
| `11-network-policies.yaml` | Namespace network policies |
| `postgresql-cluster.yaml`, `postgres-read-replicas.yaml` | Alternatives to the single PostgreSQL pod |
| `external-secrets/` | External Secrets Operator (see [Secrets](#secrets)) |
| `policies/` | Kyverno image-signature policies (see [Releases](releases-and-supply-chain.md#enforcing-signatures-in-kubernetes)) |
| `observability/` | Prometheus, Grafana, Loki, Tempo, OTel collector, SLO rules |
| `nats/` | NATS for the external-plugin broker |
| `incident-response/` | PagerDuty, Alertmanager and status-page manifests |

Before using these manifests, fix the following:

- **Secrets.** `03-api-secret.yaml` contains `postgres`/`postgres` in base64.
  Replace it, or use External Secrets. The `MODULO_SECURITY_*` secrets are not
  set at all; the `kubernetes` profile falls back to placeholders that fail
  validation, so the backend will not start until you provide them.
- **Probe port.** `application.properties` sets `management.server.port=8081`
  and the `kubernetes` profile does not change it, while the probes call
  `/api/actuator/health/*` on port 8080. Set `MANAGEMENT_SERVER_PORT=8080` in the
  ConfigMap, or move the probes to 8081 with path `/actuator/health/*`.
- **Images.** The manifests reference `ghcr.io/ikey168/modulo/*:latest`. Pin
  digests from a signed release instead.

## Kubernetes with Helm, Argo CD and Rollouts

| Chart | Purpose |
|-------|---------|
| [`helm/api`](../../helm/api) | Backend Deployment or Argo Rollout, Service, Ingress, HPA. Probes on `/actuator/health/liveness` and `/readiness`, metrics on `/actuator/prometheus`. |
| [`helm/web`](../../helm/web) | Frontend |
| [`helm/worker`](../../helm/worker) | Background worker |
| [`helm/plugin`](../../helm/plugin) | One external plugin workload; see [Plugins](../features/plugins.md) |
| [`helm/keycloak`](../../helm/keycloak), [`infra/keycloak/chart`](../../infra/keycloak/chart) | Keycloak (`make keycloak-up` installs the latter with dev values) |

Environment overrides live in [`helm/environments`](../../helm/environments)
(`api-dev`, `api-prod`, `web-dev`, `web-prod`). Test locally with
`helm lint helm/api/` and `helm template helm/api/ -f helm/environments/api-dev.yaml`.

Argo CD uses an app-of-apps: [`argocd/app-of-apps.yaml`](../../argocd/app-of-apps.yaml)
syncs everything under `argocd/apps/` from `main`.

| Application | Source | Branch | Namespace |
|-------------|--------|--------|-----------|
| `api`, `web`, `worker` | `helm/*` | `main` | `modulo` |
| `dev` (api + web) | `helm/*` with dev values | `develop` | `modulo-dev` |
| `prod` (api + web) | `helm/*` with prod values | `main` | `modulo-prod` |
| `nats` | `k8s/nats` | `main` | `modulo` |
| `rollouts` | `rollouts/` | `main` | `modulo` |
| `plugins/script-sandbox` | `helm/plugin` | `main` | `modulo` |

All use automated sync with self-heal. Everything except `prod` also prunes automatically; `prod` leaves pruning to a manual sync. Inspect or roll back with
`argocd app get|sync|rollback <app>`.

Progressive delivery: set `rollout.enabled=true` in `helm/api` values
(`strategy: canary` or `blueGreen`). The canary in
[`rollouts/api-rollout.yaml`](../../rollouts/api-rollout.yaml) steps through
10, 20, 40, 60, 80 and 100 % with 30 s pauses. Analysis starts at the 20 % step
and aborts when the Prometheus success rate drops below 95 % or p95 latency
exceeds 500 ms ([`analysis-templates.yaml`](../../rollouts/analysis-templates.yaml)).
[`rollouts/demo.sh`](../../rollouts/demo.sh) walks through promote and abort.

Chart values still carry placeholders (`image.repository: moduloapi`,
`tag: latest` / `prod-v1.0.0`). Point them at signed GHCR digests before use.

## Azure

- [`terraform/`](../../terraform) defines a resource group, virtual network,
  PostgreSQL Flexible Server, Blob Storage, Application Insights and Log Analytics
  with alerts, with `environments/dev` and `environments/prod` variable files.
  `main.tf` references `./modules/storage`, which does not exist, so
  `terraform init` fails until that module is added or the block removed. The
  [`terraform.yml`](../../.github/workflows/terraform.yml) workflow plans and
  applies dev from `develop` and prod from `main`, with GitHub environments as
  approval gates, and offers a manual destroy.
- [`azure/`](../../azure) holds imperative scripts (ACR build and push, AKS and
  App Service deployment, Blob Storage and monitoring setup).
- [`aks-deploy.yml`](../../.github/workflows/aks-deploy.yml) (on `backend/**` or
  `k8s/**` changes to `main`) and
  [`azure-deploy.yml`](../../.github/workflows/azure-deploy.yml) (on
  `backend/**`) use placeholder values (`your-acr-name`,
  `your-resource-group`) and need `AZURE_CREDENTIALS`. Replace the placeholders
  or disable them.
- The `azure` Spring profile reads `DATABASE_URL`, `DATABASE_USERNAME`,
  `DATABASE_PASSWORD`, `GOOGLE_*`/`AZURE_*` OAuth secrets, `FRONTEND_URL` and
  `APPLICATIONINSIGHTS_CONNECTION_STRING`. It does not enable Flyway; add
  `SPRING_FLYWAY_ENABLED=true` for PostgreSQL.

## Secrets

| Target | Where secrets live | How they reach the backend |
|--------|-------------------|---------------------------|
| OCI | `deploy/oci/.env` (mode 0600, generated), `/etc/modulo/backup.env`, restic password file | Compose environment |
| Pi | `deploy/pi/.env` | Compose environment |
| Kubernetes | Azure Key Vault via External Secrets Operator, or plain Secrets | `envFrom`/`secretKeyRef` |
| Local | Compose defaults; optional SOPS files | See [Local development](../getting-started/local-development.md#local-secrets) |

### External Secrets Operator (Kubernetes)

[`k8s/external-secrets/`](../../k8s/external-secrets) installs the operator
(Flux `HelmRelease`), a `SecretStore` and a `ClusterSecretStore` for
`https://modulo-keyvault.vault.azure.net/`, RBAC, and `ExternalSecret` resources.

```sh
./scripts/setup-azure-keyvault.sh       # create vault + service principal, seed secrets
./scripts/deploy-external-secrets.sh    # operator, RBAC, stores, ExternalSecrets
kubectl get externalsecrets -n modulo -o wide
```

| Key Vault secret | Kubernetes secret | Refresh |
|------------------|-------------------|---------|
| `modulo-database-host`, `-port`, `-name`, `-username`, `-password` | `api-secret` | 5 min |
| `modulo-jwt-secret`, `modulo-api-key` | `api-application-secret` | 10 min |
| `modulo-app-insights-connection-string` | `app-insights-secret` | 15 min |
| `modulo-acr-password` | `acr-secret` (`.dockerconfigjson`) | 30 min |

The operator updates the Kubernetes Secret on its refresh interval, but Spring
reads environment variables only at startup: pods must be restarted to use a
rotated value. [`scripts/rotate-secrets.sh`](../../scripts/rotate-secrets.sh)
(`jwt`, `api-key`, `database`, or an interactive menu) writes the new value to
Key Vault, waits for the sync, verifies it in a pod and runs
`kubectl rollout restart`. Rotating the database password also requires changing
it in PostgreSQL itself.

Troubleshooting:

```sh
kubectl describe secretstore azure-keyvault-store -n modulo
kubectl describe externalsecret api-database-secret -n modulo
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets
kubectl annotate externalsecret api-database-secret -n modulo force-sync="$(date)" --overwrite
```

Back up Key Vault secrets before rotating or deleting them; a deleted secret is
recoverable only while soft-delete retention lasts.

## Environments at a glance

| Environment | Where | Profile | Data |
|-------------|-------|---------|------|
| Local | Laptop, `docker-compose.yml` | `docker` | Throwaway volumes |
| CI (ZAP, performance, backups) | GitHub Actions runners | `docker` / `staging` | Ephemeral |
| Staging | `staging` profile, `modulodb_staging` | `staging` | Created by [`database/init`](../../database/init) |
| Production | OCI host | `docker` | Backed up nightly, off-host |
