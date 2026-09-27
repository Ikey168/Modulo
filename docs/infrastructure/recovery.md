# Recovery runbook

The entry point for recovering the owner's infrastructure: workstation and
endpoints, the Raspberry Pi 5 homeserver, Oracle production, Modulo, Noesis,
Paperless, Netcup, Git repositories and cloud backup copies. It is for whoever
is acting as recovery custodian during an incident or a drill. It contains no
credentials; secret locations named here are custody references, not values.
Device-level rebuild profiles are in [devices.md](devices.md), network restore in
[home-network.md](home-network.md#backup-and-recovery), and security incidents
(compromise rather than loss) in
[incident response](../security/incident-response.md).

## Rules for every incident

1. Stop writes to the affected system. Do not prune backups, rotate credentials
   or reinstall the source until a recoverable copy has been identified.
2. Record the incident start time, last known-good time, affected system and
   suspected cause in Modulo. If Modulo is affected, use an offline text file
   and import it later.
3. Preserve the failed disk, database or working tree read-only when practical.
4. Restore into a new directory, database, volume or host. Never test a restore
   by overwriting the only production copy.
5. Verify checksums, schema/application startup and representative records
   before cutover. Record the snapshot ID, duration and failed checks.
6. Cut over only after the old path is fenced. Keep the rollback copy until the
   recovery has been reviewed.

The recovery custodian obtains secrets from the encrypted recovery vault or the
password manager. Never paste secret values into a task, note, command history
or this repository.

## Choose the recovery path

| Symptom | Start here | Authoritative source |
| --- | --- | --- |
| One deleted or damaged file | [File or working tree](#file-or-working-tree) | Git, Modulo export or endpoint backup |
| Workstation, SSD or laptop lost | [Endpoint loss](#endpoint-loss) | Git remotes, endpoint backup and recovery vault |
| Pi disk or Pi lost | [Pi homeserver loss](#pi-homeserver-loss) | Compose/config backup plus application backups |
| Paperless unavailable or corrupt | [Paperless](#paperless) | Independently authenticated Restic repository |
| Oracle VM or database lost | [Oracle production](#oracle-production-loss) | Git deployment config plus off-host snapshot |
| Modulo content deleted or corrupt | [Modulo](#modulo-deletion-or-corruption) | Life OS export and PostgreSQL snapshot |
| Noesis data corrupt | [Noesis](#noesis-corruption) | Noesis data archive; indexes are rebuildable |
| Netcup host lost | [Netcup](#netcup-loss) | Git plus declared persistent-data backup |
| GitHub unavailable or account lost | [GitHub](#github-loss) | Local clones plus independent repository bundles |
| Backup provider unavailable | [Cloud outage](#cloud-backup-outage) | Local/offline copy; do not delete provider state |
| Backup credential unavailable | [Credential loss](#lost-backup-credential) | Independent recovery custody |
| Ransomware suspected | [Ransomware](#ransomware) | Offline/immutable last known-good copy |
| Several systems lost | [Total loss](#complete-infrastructure-loss) | Offline recovery kit and independent backups |
| Router or access point lost | [Home network recovery](home-network.md#safe-recovery-order) | Encrypted MikroTik/OpenWrt artifacts |

## File or working tree

For a tracked file, inspect history without changing the current tree:

```sh
git status --short
git log --all -- path/to/file
git show COMMIT:path/to/file > /tmp/recovered-file
sha256sum /tmp/recovered-file
```

For a whole repository, create a separate recovery worktree. Do not reset the
dirty checkout:

```sh
git worktree add ../recovery-checkout COMMIT
git -C ../recovery-checkout fsck --full
```

For an untracked file, restore into a new directory from the endpoint backup or a
Modulo export, compare hashes/content, then copy it into place. Recovery is
accepted only after the relevant build/test opens the restored artifact.

## Endpoint loss

1. Revoke the lost device's login, SSH, GitHub, ZeroTier and service sessions
   (and its WireGuard peer, if enrolled).
2. Request a remote wipe only if it cannot destroy the only remaining copy of
   data.
3. Install the documented OS baseline on replacement hardware.
4. Restore SSH keys and recovery material from independent custody; never copy
   them from an untrusted recovered filesystem.
5. Clone repositories from their authoritative remotes. Restore only non-Git
   files from the endpoint backup, into staging.
6. Run each repository's documented bootstrap and verification commands.
7. Re-enrol the device with its canonical name and least-privilege access.

Acceptance: the device can be rebuilt without the lost disk, important files
exist in their declared authority, and the lost device no longer authenticates.

## Pi homeserver loss

The Raspberry Pi 5 is an always-on homeserver, not an experimental edge lab.

1. Fence the failed Pi and keep its NVMe read-only.
2. Provision Raspberry Pi OS and storage on replacement hardware.
3. Restore versioned Compose/systemd configuration before application data.
4. Restore each service into isolated volumes and validate it separately.
5. Reuse the canonical `home-pi` identity (current name `pi5`) only after the
   old node is offline.
6. Restore Paperless with the procedure below. Restore Matrix/bridges only from
   their documented databases and encryption/recovery material
   ([`scripts/matrix-restore-drill.sh`](../../scripts/matrix-restore-drill.sh)
   verifies a vault backup's checksums before restoring).
7. Start monitoring last; reconcile every expected container and timer.

Acceptance: all declared services pass health checks, backup freshness is green,
and no experimental workload or recovered secret is exposed publicly.

## Paperless

The exercised recovery path and its results are in
[records.md](records.md#paperless-off-site-restore-drill-2026-09-20).
From the desktop, with the encrypted recovery vault mounted, run from the
repository root:

```sh
./scripts/paperless-offsite-restore-drill.sh
```

The script reads the off-site repository location and credentials from the
separately held recovery bundle, authenticates with a pinned `known_hosts`
entry, performs a full Restic data read, restores into a disposable directory,
validates the SHA-256 manifest, restores PostgreSQL into a new database, starts
fresh digest-pinned PostgreSQL, Redis and Paperless on an internal-only network
with no published ports, imports the exporter bundle, compares document and
access-control rows, and removes the disposable environment on success or
failure. It accepts `--recovery-dir` and `--known-hosts` overrides. It does not
use the Pi, its local Restic repository or a Pi login. A production cutover is a
separate human decision after this drill passes.

Run it quarterly and after any material backup, credential, Paperless, database
or network change.

## Oracle production loss

Prerequisites: the Modulo repository, an off-host snapshot, deployment secret
custody, DNS access and a replacement ARM64 Linux host.

1. Quarantine the old VM and preserve its boot-volume snapshot if available.
2. Provision a replacement host; patch it and restrict administrative access.
3. Clone the repository and follow [`deploy/oci/README.md`](../../deploy/oci/README.md).
4. Restore the latest off-host snapshot into a staging directory.
5. Validate its checksums and perform the isolated database drill:

   ```sh
   cd deploy/oci
   ./restore-drill.sh /path/to/restored/snapshot
   ```

6. Recreate deployment secrets from custody, render the realm, and validate
   Compose before starting services.
7. Start with a temporary private/test hostname. Run `status.sh` and
   `verify-deployment.py` with a short-lived test token.
8. Change DNS only after Modulo, Keycloak, Noesis and Praxis are healthy.
9. Restore the WireGuard relay (`/etc/wireguard/wg-home.conf`) as described in
   [home-network.md](home-network.md#restoring-wireguard).

Rollback: point DNS back at the previous healthy endpoint, or keep it fenced
while repairing. Never point production traffic at an unverified restore.

`restore-drill.sh` refuses snapshots without `VERIFIED` or `COMPLETE`, checks
`SHA256SUMS` and the data archives, and restores only into a throwaway container.
On Oracle, `modulo-restore-drill.timer` runs
[`deploy/oci/offsite-drill.sh`](../../deploy/oci/offsite-drill.sh) monthly
(1st, 05:00 UTC) against the encrypted off-host repository.

## Modulo deletion or corruption

For a single logical record, inspect a Life OS JSON backup before importing it.
The restore is additive by default; replacement must be selected explicitly. For
attachments, use the desktop ZIP backup.

For database-wide loss, stop the backend, restore the PostgreSQL dump into a new
database/container with `deploy/oci/restore-drill.sh`, run schema validation and
representative authenticated note/plugin-state reads, then switch the backend
connection during a maintenance window. Never import a database dump into the
live database in place. Database tooling is described in
[database operations](../operations/database.md).

Acceptance: authentication works, notes and links open, plugin records have no
pending/conflict state, attachments match checksums, and the deployed schema is
valid.

## Noesis corruption

1. Stop Noesis writes and preserve the corrupt data directory.
2. Verify the selected `noesis-data.tar.gz` against the snapshot manifest.
3. Extract into a new directory or volume, never over the source.
4. Restore authoritative documents and source metadata first.
5. Rebuild derived embeddings, indexes, caches and models rather than treating
   them as authorities.
6. Start Noesis privately and run health plus representative cited retrievals.
7. Switch the mounted data directory only after provenance and source counts
   match the recovery record.

The data classes and the detailed volume restore sequence are in
[data-lifecycle.md](data-lifecycle.md#restore-sequence).

## Netcup loss

Netcup is disposable development compute. Reprovision the base Linux host,
private network, named non-root user, SSH policy, firewall, Docker/toolchain and
repository clones from code (`infra/personal/playbooks/development-server.yml`;
see [devices.md](devices.md#device-profiles)). The provider console is the
out-of-band recovery path. Restore only explicitly declared persistent
development data. If an artifact has no authority outside Netcup, stop and
record data loss instead of silently substituting a stale copy.

## GitHub loss

1. Freeze pushes and preserve every local clone, branch, tag and worktree.
2. Run `git fsck --full` in each clone and inventory unpushed commits with
   `git log --all --not --remotes`.
3. Create encrypted/offline bundles without changing the working trees:

   ```sh
   git bundle create repository.bundle --all
   git bundle verify repository.bundle
   ```

4. Recover the GitHub identity (see
   [identity recovery](../security/identity-recovery.md)) or create the approved
   replacement remote.
5. Push from a verified bundle/clone, restore branch protections and CI secrets
   from independent custody, then compare refs before reopening writes.

## Cloud backup outage

Do not run a destructive synchronization or prune either side during an outage.
Continue local snapshots if capacity permits (`backup.sh --local-only` on
Oracle), record the first missed recovery point, and verify the local
repository. After service returns, use a copy/dry-run operation and checksum
comparison before resuming normal retention. If migration is necessary, copy to
a new provider and leave the old provider untouched until the new repository
passes a complete restore.

## Lost backup credential

1. Do not rotate or overwrite the repository while testing credentials.
2. Use the independent recovery bundle and an isolated client.
3. Test repository listing and a small restore; never report secret material.
4. If recovery fails, preserve the encrypted repository and escalate to the
   owner-led password-manager/provider recovery procedure
   ([identity recovery](../security/identity-recovery.md)).
5. After access is restored, rotate only with a verified rollback copy and
   update independent custody.

## Ransomware

Disconnect affected hosts from LAN, overlay and cloud sync. Preserve logs and a
disk image where practical. From a known-clean device, revoke sessions and
credentials, identify a last known-good offline/immutable snapshot, and scan it
without mounting it read-write on an infected host. Rebuild systems from known
configuration and restore data into isolated locations. Reconnect only after
credential rotation, integrity checks and representative application tests.

## Complete infrastructure loss

The recovery order minimizes circular dependencies:

1. owner identity, recovery mailbox, password manager and hardware factors;
2. DNS/provider consoles and the private administrative network;
3. one trusted workstation and the encrypted recovery vault;
4. source repositories and immutable deployment artifacts;
5. Oracle identity/Modulo control plane;
6. Pi homeserver and Paperless records;
7. Noesis and other derived services;
8. endpoint synchronization, automation and monitoring.

At each layer, stop if the next layer depends on an unverified credential or an
unavailable sole copy. Record the actual RPO/RTO instead of assuming the target
was met. Targets: Oracle and Paperless have a 24-hour RPO; Oracle recovery is
expected within four hours once a clean host and snapshot are available.

## Evidence record

Every exercise or incident records:

- incident/exercise ID, date and operator;
- affected dataset/service and last known-good time;
- snapshot/revision identifier, without secrets;
- restore destination and isolation method;
- checksum, schema and application checks;
- start, restore-ready and accepted times;
- deviations, failed checks and corrective tasks;
- cutover or rollback decision.

Add the result to [records.md](records.md). Run the structural check after
editing this runbook:

```sh
python3 scripts/verify-recovery-runbook.py
```
