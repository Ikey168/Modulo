# Records disaster-recovery drill — 2026-09-20

## Result

The independently authenticated off-site Paperless backup and a clean,
application-level restore both passed. The drill ran from the desktop without
using the Raspberry Pi, its local Restic repository, or an existing Pi login.

| Check | Result |
| --- | --- |
| Off-site authentication | Passed with the separately held recovery bundle and pinned SSH host key |
| Repository integrity | 3 snapshots, 12 packs, full `restic check --read-data`, no errors |
| Snapshot restored | `84c472a9`, created 2026-09-20 01:44:46 UTC |
| Restored artifacts | 177 files; all 176 `SHA256SUMS` entries matched |
| PostgreSQL restore | 72 public tables and 3 document rows restored into a clean database |
| Fresh Paperless import | 3 documents and 2 non-system users imported successfully |
| Access-control parity | Row counts matched across 6 user, group, permission, and object-permission tables (14 rows) |
| Network isolation | Internal-only Docker network; 0 host port bindings |
| Measured recovery time | 63 seconds for the automated technical drill |
| Recovery-point age | About 15 hours 57 minutes at final verification, within the 24-hour RPO |

The measured time covers repository validation, snapshot download, database
restore, fresh application initialization, document import, and automated
checks on this 19.012 MiB snapshot. It does not include procuring a replacement
host, restoring public DNS, or a user-led production cutover.

## Recovery path exercised

1. Read the off-site repository location and password from the separately held,
   encrypted desktop recovery bundle.
2. Authenticate with the separately stored SSH key and a pinned `known_hosts`
   entry. The destination account is restricted to SFTP; an interactive shell
   was denied during verification.
3. Run a full Restic data read and restore the latest snapshot to a disposable
   directory.
4. Verify every entry in the snapshot's SHA-256 manifest.
5. Restore `deployment/postgresql.dump` to a new PostgreSQL database and inspect
   its schema and document count.
6. Start fresh pinned PostgreSQL, Redis, and Paperless images on an internal-only
   Docker network, then import the Paperless exporter bundle.
7. Compare document and access-control data between the database dump and the
   fresh application database.
8. Remove the temporary containers, Docker network, databases, recovered files,
   and in-memory secret environment values.

The source repository was read only during the drill. A final cleanup check
found no `records-dr-*` containers, networks, or temporary restore directories.

## Repeatable procedure

Run from the desktop while the encrypted recovery vault is mounted:

```bash
./scripts/paperless-offsite-restore-drill.sh
```

The script accepts `--recovery-dir` and `--known-hosts` overrides, pins all
container images by digest, retries transient Restic operations, exposes no
ports, reports only non-secret evidence, and cleans up on success or failure.

Quarterly cadence: run on or before 2026-12-20, then every three months, and
after any material backup, credential, Paperless, database, or network change.

## Task disposition

- `REC-DR-04`: complete. Independent off-site authentication, encryption,
  retention history, repository integrity, forced-SFTP isolation, and recovery
  without the Pi were verified.
- `REC-DR-06`: partially verified. The backup key, Restic password, deployment
  configuration, database credential, and pinned host identity worked from the
  separate recovery bundle. Password-manager and cloud-provider account
  recovery still need an owner-led lockout exercise.
- `REC-DR-07`: partially verified. Backup and monitor timers are active and the
  age/status/capacity probe reports healthy. No external notification or
  escalation destination has been accepted yet.
- `REC-DR-09`: complete for technical clean-host recovery. Fresh services,
  database, documents, users, and permission rows were recovered and checked.
- `REC-DR-10`: cadence and reusable procedure are established, but the task
  remains open until the offline/immutable copy, bootstrap lockout exercise,
  and external alert route are closed.

## Remaining acceptance gates

1. Create a separately custodied offline medium or immutable/object-locked copy,
   then test its rotation and expiry.
2. Perform an owner-led password-manager and off-site-provider account-recovery
   exercise without relying on an already unlocked session.
3. Select and test an external alert destination and escalation path for backup
   monitor failures.

These gates require physical custody, external account recovery, or a named
notification destination and were not silently substituted with weaker local
checks.
