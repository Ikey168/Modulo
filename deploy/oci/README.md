# Oracle A1 deployment

This profile runs Modulo and a private Noesis API on one ARM64 Oracle A1 VM.
Only Caddy publishes Internet-facing ports. Noesis is bound to
`127.0.0.1:8012` and is intended to be reached through an SSH tunnel.

## First deployment

From `/srv/modulo/deploy/oci`:

```sh
./init-env.sh https://modulo.example.com
./render-realm.sh
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --build
MODULO_URL=https://modulo.example.com ./status.sh
```

For pre-DNS validation, use `http://SERVER_IP` as the URL. Do not enter
credentials over this temporary plaintext endpoint. If the realm was already
imported, changing the URL later also requires updating the existing realm and
client in Keycloak; startup imports intentionally do not overwrite them.

Reach Noesis from a trusted workstation:

```sh
ssh -L 8012:127.0.0.1:8012 ubuntu@SERVER_IP
curl http://127.0.0.1:8012/health
```

Run `./backup.sh --local-only` for a local snapshot. Local snapshots are not a substitute
for an encrypted off-host backup.

Install the included nightly timer with:

```sh
sudo install -m 0644 systemd/modulo-backup.service /etc/systemd/system/
sudo install -m 0644 systemd/modulo-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now modulo-backup.timer
```

## Validated releases and rollback

Existing Hibernate-managed installations must complete the explicit adoption in
[the migration runbook](../../docs/operations/schema-migrations.md) before starting
this backend version. Fresh databases are migrated automatically.

CI publishes AMD64/ARM64 images only after the main-branch CI succeeds. Download
the `image-frontend` and `image-backend` artifacts from that commit's Docker build.
Their contents are immutable `ghcr.io/...@sha256:...` references. Preserve these
references with the deployment record; do not substitute `latest` tags.

Export `MODULO_URL` and `MODULO_SMOKE_TOKEN_FILE`. The latter points to a mode-0600
file containing a short-lived bearer token for a dedicated test user permitted
to create/read/delete notes. Obtain it through your normal Keycloak login flow;
no password grant or permanent admin credential is required. Verification creates
one uniquely named temporary note and deletes it, including on read-back failure.

Load the backup credentials into the release process environment as well. Then:

```sh
./release.sh deploy FRONTEND_IMAGE@sha256:DIGEST BACKEND_IMAGE@sha256:DIGEST
./release.sh rollback
```

`deploy` pulls the candidate images, creates and uploads a verified backup, and
runs the candidate backend's migration and schema validation against a restored,
isolated copy. Only then does it replace the frontend/backend containers. It
waits for container health and verifies OIDC, anonymous access rejection, and
real authenticated note persistence before recording the release in `.releases`.
Failed verification attempts to restore the currently recorded image pair and
returns nonzero. If no verified release is recorded yet, there is no automatic
rollback target. Backing services must already be provisioned; this command
updates only frontend/backend.

Rollback swaps application images only; it does not reverse migrations. Keep
migrations backward compatible with the previous application version. The
explicit initial database adoption remains a maintenance-window operation.

`./status.sh` now fails if an endpoint check fails. For the full gate, run:

```sh
python3 verify-deployment.py --url https://modulo.example.com --token-file /secure/token
```

The frontend image reads its login issuer at startup from Compose's
`MODULO_OIDC_ISSUER`, so the same tested image can be promoted between hosts.
Changing the Keycloak issuer still requires updating the realm/client settings.

## Encrypted backups and restore drills

Install restic on the host. Create an off-host repository, initialize it once with
`restic init`, and keep the repository password separately from the server. Use
`backup.env.example` as the template for `/etc/modulo/backup.env` (root-owned,
mode 0600); systemd reads it into the backup service environment. The password
file itself must be readable by the service user, for example root:ubuntu 0640
inside a restricted directory. Provision `/srv/backups/modulo` writable by ubuntu.

`./backup.sh` now requires an off-host restic repository by default. For an
explicit device-only snapshot use `./backup.sh --local-only`. It detects failed
dumps even when gzip succeeds, verifies archive integrity and SHA-256 checksums,
restarts only services it stopped, and never prunes previous backups after a
failed upload. Neo4j and Noesis are briefly stopped while their data is archived.
A lock prevents overlapping backup runs.

Successful uploads retain seven daily, four weekly, and twelve monthly restic
snapshots per host. Local completed snapshots are retained for seven days. Set
`RESTIC_BACKUP_HOST` consistently when moving backup/drill jobs to another host.
For a nondefault application database, export `POSTGRES_DB` for restore drills.

Install the backup timer and the monthly drill timer:

```sh
sudo install -m 0644 systemd/modulo-*.service systemd/modulo-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now modulo-backup.timer modulo-restore-drill.timer
```

`./offsite-drill.sh` checks the encrypted repository, restores its latest snapshot,
and runs `restore-drill.sh` against an isolated PostgreSQL container. No production
database or volume is overwritten. PostgreSQL SQL import and application table
queries must succeed; Neo4j/Noesis archives receive checksum and archive-integrity
checks. These archive checks do not prove those two applications can boot after a
restore. Alerts can use the nonzero systemd service result; inspect runs with
`journalctl -u modulo-backup -u modulo-restore-drill`.

Backups cover PostgreSQL (including Keycloak's database), Neo4j data, and Noesis
data. Keep deployment secrets, realm configuration, external attachment stores,
and device-local workspace exports backed up separately. Nightly dumps provide
roughly a one-day recovery point, not continuous point-in-time recovery.
