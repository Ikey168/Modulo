# Personal infrastructure recovery runbook

This is the entry point for recovery of the workstation, Raspberry Pi 5
homeserver, Oracle production, Modulo, Noesis, Paperless, Git repositories and
cloud copies. It contains no credentials. Secret locations named below are
custody references, not values.

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

The recovery custodian must obtain secrets from the encrypted recovery vault or
the password manager. Never paste secret values into a task, note, command
history or this repository.

## Choose the recovery path

| Symptom | Start here | Authoritative source |
| --- | --- | --- |
| One deleted or damaged file | [File or working tree](#file-or-working-tree) | Git, Modulo export or endpoint backup |
| Workstation/SSD/laptop lost | [Endpoint loss](#endpoint-loss) | Git remotes, endpoint backup and recovery vault |
| Pi disk or Pi lost | [Pi homeserver loss](#pi-homeserver-loss) | Compose/config backup plus application backups |
| Paperless unavailable/corrupt | [Paperless](#paperless) | Independently authenticated Restic repository |
| Oracle VM/database lost | [Oracle production](#oracle-production-loss) | Git deployment config plus off-host snapshot |
| Modulo content deleted/corrupt | [Modulo](#modulo-deletion-or-corruption) | Life OS export and PostgreSQL snapshot |
| Noesis data corrupt | [Noesis](#noesis-corruption) | Noesis source/data archive; indexes are rebuildable |
| Netcup host lost | [Netcup](#netcup-loss) | Git plus declared persistent-data backup |
| GitHub unavailable/account lost | [GitHub](#github-loss) | Local clones plus independent repository bundles |
| Backup provider unavailable | [Cloud outage](#cloud-backup-outage) | Local/offline copy; do not delete provider state |
| Backup credential unavailable | [Credential loss](#lost-backup-credential) | Independent recovery custody |
| Ransomware suspected | [Ransomware](#ransomware) | Offline/immutable last known-good copy |
| Several systems lost | [Total loss](#complete-infrastructure-loss) | Offline recovery kit and independent backups |

## File or working tree

For a tracked file, inspect history without changing the current tree:

```sh
git status --short
git log --all -- path/to/file
git show COMMIT:path/to/file > /tmp/recovered-file
sha256sum /tmp/recovered-file
```

For an entire repository, create a separate recovery worktree. Do not reset the
dirty checkout:

```sh
git worktree add ../recovery-checkout COMMIT
git -C ../recovery-checkout fsck --full
```

For an untracked file, restore to a new directory from the endpoint backup or a
Modulo export, compare hashes/content, then copy it into place. Recovery is
accepted only after the relevant build/test opens the restored artifact.

## Endpoint loss

1. Revoke the lost device's login, SSH, GitHub, ZeroTier and service sessions.
2. Preserve a remote wipe request only if it cannot destroy the only remaining
   copy of data.
3. Install the documented OS baseline on replacement hardware.
4. Restore SSH keys and recovery material from independent custody; do not copy
   them from an untrusted recovered filesystem.
5. Clone repositories from their authoritative remotes. Restore only non-Git
   files from the endpoint backup into staging.
6. Run each repository's documented bootstrap and verification commands.
7. Re-enrol the device with its canonical name and least-privilege access.

Acceptance: the device can be rebuilt without the lost disk, important files
exist in their declared authority, and the lost device no longer authenticates.

## Pi homeserver loss

The Raspberry Pi 5 is an always-on homeserver, not an experimental edge lab.

1. Fence the failed Pi and retain its NVMe read-only.
2. Provision Raspberry Pi OS and storage on replacement hardware.
3. Restore versioned Compose/systemd configuration before application data.
4. Restore each service into isolated volumes and validate it separately.
5. Reuse the canonical `pi5` identity only after the old node is offline.
6. Restore Paperless with the procedure below. Restore Matrix/bridges only from
   their documented databases and encryption/recovery material.
7. Start monitoring last; reconcile every expected container and timer.

Acceptance: all declared services pass health checks, backup freshness is green,
and no experimental workload or recovered secret is exposed publicly.

## Paperless

The exercised recovery path is documented in
[`../records/disaster-recovery-2026-09-20.md`](../records/disaster-recovery-2026-09-20.md).
From the desktop with the encrypted recovery vault mounted, run:

```sh
./scripts/paperless-offsite-restore-drill.sh
```

The script performs a full Restic data read, restores into a disposable
directory, validates the manifest, restores PostgreSQL, starts fresh pinned
Paperless dependencies on an internal-only network, verifies documents and
access-control rows, and removes the disposable environment. A production
cutover is a separate human decision after this drill passes.

## Oracle production loss

Prerequisites are the Modulo repository, an off-host snapshot, deployment
secret custody, DNS access and a replacement ARM64 Linux host.

1. Quarantine the old VM and preserve its boot volume snapshot if available.
2. Provision a replacement host; patch it and restrict administrative access.
3. Clone the repository and follow [`../../../deploy/oci/README.md`](../../../deploy/oci/README.md).
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
8. Change DNS only after Modulo, Keycloak, Noesis, Neo4j and Praxis are healthy.

Rollback: restore DNS to the previous healthy endpoint or keep it fenced while
repairing. Never point production traffic at an unverified restore.

## Modulo deletion or corruption

For a single logical record, inspect a Life OS JSON backup before importing it.
The restore defaults to additive behavior; replacement must be selected
explicitly. For attachments, use the desktop ZIP backup.

For database-wide loss, stop the backend, restore the PostgreSQL dump into a new
database/container with `deploy/oci/restore-drill.sh`, run schema validation and
representative authenticated note/plugin-state reads, then switch the backend
connection during a maintenance window. Do not import a database dump into the
live database in place.

Acceptance: authentication works, notes and links open, plugin records have no
pending/conflict state, attachments match checksums, and the deployed schema is
valid.

## Noesis corruption

1. Stop Noesis writes and preserve the corrupt data directory.
2. Verify the selected `noesis-data.tar.gz` against the snapshot manifest.
3. Extract into a new directory, never over the source.
4. Restore authoritative documents/source metadata first.
5. Rebuild derived embeddings, indexes, caches and models rather than treating
   them as authorities.
6. Start Noesis privately and run health plus representative cited retrievals.
7. Switch the mounted data directory only after provenance and source counts
   match the recovery record.

## Netcup loss

Netcup is disposable development compute. Reprovision the base Linux host,
private network, named non-root user, SSH policy, firewall, Docker/toolchain and
repository clones from code. Restore only explicitly declared persistent
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

4. Recover the GitHub identity or create the approved replacement remote.
5. Push from a verified bundle/clone, restore branch protections and CI secrets
   from independent custody, then compare refs before reopening writes.

## Cloud backup outage

Do not run a destructive synchronization or prune either side during an outage.
Continue local snapshots if capacity permits, record the first missed recovery
point, and verify the local repository. After service returns, use a copy/dry-run
operation and checksum comparison before resuming normal retention. If migration
is necessary, copy to a new provider; keep the old provider untouched until the
new repository passes a complete restore.

## Lost backup credential

1. Do not rotate or overwrite the repository while testing credentials.
2. Use the independent recovery bundle and an isolated client.
3. Test repository listing and a small restore; never report secret material.
4. If recovery fails, preserve the encrypted repository and escalate to the
   owner-led password-manager/provider recovery procedure.
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

Recovery order minimizes circular dependencies:

1. owner identity, recovery mailbox, password manager and hardware factors;
2. DNS/provider consoles and the private administrative network;
3. one trusted workstation and the encrypted recovery vault;
4. source repositories and immutable deployment artifacts;
5. Oracle identity/Modulo control plane;
6. Pi homeserver and Paperless records;
7. Noesis and other derived services;
8. endpoint synchronization, automation and monitoring.

At each layer, stop if the next layer depends on an unverified credential or an
unavailable sole copy. Record actual RPO/RTO rather than assuming the target was
met.

## Evidence record

Every exercise or incident records:

- incident/exercise ID, date and operator;
- affected dataset/service and last known-good time;
- snapshot/revision identifier without secrets;
- restore destination and isolation method;
- checksum/schema/application checks;
- start, restore-ready and accepted times;
- deviations, failed checks and corrective tasks;
- cutover or rollback decision.

Run the structural check after editing this runbook:

```sh
python3 scripts/verify-recovery-runbook.py
```
