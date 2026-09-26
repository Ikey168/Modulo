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
./status.sh
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

Run `./backup.sh` for a local snapshot. Local snapshots are not a substitute
for an encrypted off-host backup.

Install the included nightly timer with:

```sh
sudo install -m 0644 systemd/modulo-backup.service /etc/systemd/system/
sudo install -m 0644 systemd/modulo-backup.timer /etc/systemd/system/
sudo install -m 0644 systemd/modulo-wal-backup.service /etc/systemd/system/
sudo install -m 0644 systemd/modulo-wal-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now modulo-backup.timer
sudo systemctl enable --now modulo-wal-backup.timer
```

The backup job stores a logical PostgreSQL dump and a daily physical base
backup. The WAL timer copies archived WAL to the off-host restic repository
hourly. It retains 17 daily base and WAL points so a full 14-day recovery
window has a margin for the daily base-backup schedule. WAL is pruned locally
only after an off-host base backup exists, and old segments are removed only
after the corresponding retained base backup no longer needs them.

The PostgreSQL container needs write access to the host WAL directory, and the
backup user needs read access. Set `MODULO_WAL_GID` to the backup user's numeric
group ID (the included `init-env.sh` records it), then prepare the directory
before starting the database:

```sh
sudo install -d -o ubuntu -g ubuntu -m 2770 /srv/backups/modulo/wal
```

After changing WAL directory ownership or the database `group_add` setting,
recreate the database container once so its supplementary group is applied.

To verify a point-in-time restore without touching the live database, run
`pitr-drill.sh <base-backup-directory> <wal-directory> <ISO-target-time>`. It
restores into a disposable container and reports success only after PostgreSQL
has replayed WAL through the requested time and paused.
