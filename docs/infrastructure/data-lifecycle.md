# Data lifecycle and retention

How the owner's data is classified, how long each class is kept, when deletion
is allowed, and how Noesis production data is backed up and restored. It covers
personal devices, the Raspberry Pi 5 homeserver, Oracle production, Netcup
development, Modulo, Noesis, Paperless and the backup repositories. It is for
the owner when adding a dataset, changing a backup or deleting anything. It
contains no secret values and is not legal or tax advice.

## Lifecycle

Every governed dataset has exactly one authority and moves deliberately through:

```text
Capture -> Active -> Reference -> Archive -> Delete eligible -> Purged
```

`Delete eligible` is a review state, not an automatic deletion command. A dataset
may be purged only when its authority, replicas, legal/business hold, backup
aging and recovery consequences are understood. Synchronization is not a backup,
and a backup is not an authority.

## Data classes

| Class | Meaning | Default lifecycle |
| --- | --- | --- |
| T0 | Identity and recovery: recovery codes, backup credentials, encryption and SSH recovery material | Retain current material while the protected system exists; keep superseded material only until replacement and independent recovery are verified; never auto-delete |
| T1 | Irreplaceable originals: personal documents/photos, original writing, research and created media | Permanent archive unless the owner makes a recorded deletion decision; independent backups required |
| T2 | Operational state: Modulo, Noesis authority, databases, uploads and persistent service state | Versioned while active; retain recovery points per service policy; purge only after replacement/cutover and restore evidence |
| T3 | Version-controlled source: repositories, infrastructure, dotfiles and configuration | Git history is authoritative; retain protected branches/tags and independent repository bundles; generated checkouts are replaceable |
| T4 | Expensive derived data | Retain while reproduction cost exceeds storage/retrieval cost; record source/version before deletion |
| T5 | Replaceable downloads: public datasets, packages, models, downloaded media | Cache only when useful; delete under capacity pressure after recording source and version |
| T6 | Ephemeral: caches, build outputs, temporary files, dependencies, scratch data | No backup; delete automatically or during routine cleanup when unused |

When classification is uncertain, use the more protective class temporarily and
create a review item. Unknown never means safe to delete.

## Dataset rules

| Dataset | Authority | Class | Retention and control |
| --- | --- | --- | --- |
| Password-manager and offline recovery material | owner-controlled vault / offline custody | T0 | current verified set; superseded copies removed only after a replacement test |
| Paperless records | Paperless on the Pi plus record source metadata | T1/T2 | class and review date tracked; expired items need human review; no automatic document deletion |
| Modulo notes and plugin state | Oracle PostgreSQL / plugin-state service | T2 | versioned portable export plus database snapshots; deleted records age out only through an explicit service/backup policy |
| Modulo attachments | server attachment store | T1/T2 | included in managed ZIP and off-host protection; orphan cleanup needs checksum and reference review |
| Noesis sources and provenance | Noesis source/data store | T1/T2 | preserve sources, claims and provenance; embeddings, indexes and caches are T4/T6 and rebuildable (see [Noesis](#noesis-production-data)) |
| Git repositories and infrastructure definitions | declared Git remote plus verified local unpushed work | T3 | protect main and tags; bundle unpushed refs before device or server disposal |
| Oracle snapshots | encrypted off-host restic repository | T2 | 7 daily, 4 weekly, 12 monthly, pruned only after a successful upload and `restic check`; failed uploads never trigger pruning |
| Paperless Restic snapshots | local and independently authenticated off-site repositories | T1/T2 | configured daily/weekly/monthly policy; changes require a successful clean restore first |
| Application/audit logs | producing service | T2/T5 | minimum needed for incident/debugging review; default 30 days online, up to 90 days for security/audit evidence unless a documented requirement differs |
| CI/test artifacts | GitHub / release store | T4/T5 | releases, SBOMs and evidence as declared; ordinary debug artifacts default to 30 days |
| Temporary exports | creating host | T6, or T0/T1 until imported | default 7 days; sensitive exports deleted immediately after verified import unless they are the declared encrypted backup |
| Build output, dependency caches and packages | reproducible source / lockfiles | T6 | no backup; safe to remove when no process uses them |

## Deletion gate

Before deleting T0-T4 data, record:

- dataset and authoritative location;
- classification and reason;
- applicable hold or retention end;
- known replicas and synchronization paths;
- last verified backup and restore evidence;
- approver/operator and deletion date;
- when the deleted content ages out of each backup tier.

Deletion is blocked when the authority is disputed, a legal/business hold is
unknown, the only backup is unverified, or a replica may reintroduce the data.
Bulk deletion, backup pruning and provider teardown require a preview/inventory
and a rollback copy.

## Implementation controls

- Modulo's GoBD Vault plugin tracks retention for notes tagged `retain/<class>`
  with configurable periods and reports expiry; it never auto-deletes expired
  records.
- The Paperless-ngx Records plugin shows retention and expiry and creates review
  tasks; a deletion becomes a proposal queued for human review, never a direct
  delete.
- On the Pi, Paperless retention-review and quarterly timers are enabled; their
  tests validate lifecycle behaviour without deleting real records.
- Oracle backup pruning runs only after a verified off-host upload
  ([`deploy/oci/backup.sh`](../../deploy/oci/backup.sh)).
- Life OS exports preserve recognized server stores and human-readable indexes;
  browser caches and reproducible derived state are non-authoritative.
- Git, CI and infrastructure configuration keep versions; build caches and
  dependency downloads are outside recovery scope.

## Noesis production data

Noesis is a knowledge and evidence system, not a second task tracker. Its
production authority is the `modulo-oci_noesis_data` Docker volume on Oracle
(mounted as `noesis_data:/data`). The repository defines code and schemas; the
volume holds the live research state. Credentials and recovery material stay
outside both.

| Class | Examples | Authority | Backup and lifecycle |
| --- | --- | --- | --- |
| Irreplaceable source state | imported source bytes/text, unique web captures, document revisions, annotations, provenance, claims, citations, user-authored research outputs | Noesis DuckDB at `/data/noesis.duckdb` | Daily consistent volume snapshot; retained under Noesis retention/hold rules and this policy. Never discarded because a derived index exists. |
| Operational definitions | namespace/source-pack definitions, workflow configuration, enabled packs | Git for definitions; `/data/packs` for live installed state | Version non-secret definitions; live state is in the daily volume snapshot. |
| Costly derived state | embeddings, enriched parser output, vector/search indexes, expensive intermediates | Noesis DuckDB | In the database snapshot when stored in the same file. Rebuild only from retained source revisions with the exact model/configuration receipt. |
| Cheap derived state | ordinary indexes, downloaded public metadata, reproducible parser scratch | Noesis runtime | May be regenerated, but stays in the whole-database snapshot when separating it would make recovery less reliable. |
| Disposable runtime state | temporary parser files, scratch workspaces, transient logs | container filesystem or `/data/logs` | Never a recovery authority. Logs use bounded retention; scratch may be removed after failed-run evidence is captured. |
| Re-downloadable assets | public model weights and tokenizer caches | `modulo-oci_noesis_models` volume at `/models-cache` | Excluded from backups. Restore from pinned model names, immutable revisions and license records. |
| Portable evidence | verified answer/research bundles, retention archives | explicitly chosen export destination | Keep when they are the delivery or legal/decision record. Verify checksums/signatures independently; an export does not replace the live database backup. |

### Oracle backup contract

[`deploy/oci/backup.sh`](../../deploy/oci/backup.sh) owns the Oracle snapshot:

1. takes a single-instance lock and writes into a hidden partial directory;
2. dumps PostgreSQL separately (`pg_dumpall` to `postgres.sql.gz`, checked with
   `gzip -t`);
3. stops Neo4j and Noesis before archiving their `/data` volumes
   (`neo4j-data.tar.gz`, `noesis-data.tar.gz`), preventing a torn DuckDB or
   graph snapshot;
4. excludes the Noesis model-cache volume;
5. validates each archive with `gzip -t` and a tar listing, writes `SHA256SUMS`
   and checks it with `sha256sum -c`, then marks the snapshot `VERIFIED`;
6. restarts stopped services even when the backup fails, and leaves a failed run
   in its `.partial-*` directory;
7. uploads to the off-host restic repository (required unless `--local-only`),
   runs `restic check`, prunes with the 7/4/12 policy and marks
   `OFFSITE_COMPLETE`; only then marks the snapshot `COMPLETE`;
8. removes local snapshots whose `COMPLETE` marker is more than seven days old,
   and only those that also reached off-host storage (or all, in local-only
   mode).

`modulo-backup.timer` runs nightly at 03:30 UTC (up to 20 min randomized delay,
persistent). The maximum normal data-loss interval is therefore 24 hours;
recovery is expected within four hours once a clean Oracle host and the snapshot
are available. A failed or partial directory is evidence, never a restore
candidate. [`deploy/oci/offsite-drill.sh`](../../deploy/oci/offsite-drill.sh)
reads the off-host repository back (`restic check --read-data` plus restore).

### Restore sequence

1. Select a snapshot directory containing `VERIFIED`, `COMPLETE`, `SHA256SUMS`
   and `noesis-data.tar.gz`; verify the checksum manifest before extracting.
2. Stop Noesis. Create a new empty Docker volume instead of overwriting the only
   current copy.
3. Extract the archive into the new volume, attach it to the pinned Noesis
   image and configuration, and start the service privately.
4. Run health, schema/version, document-count, provenance, cited-answer and
   representative search checks. Missing model weights must be reported as
   unavailable until the pinned cache is restored, never replaced by fabricated
   output.
5. Promote the restored volume only after the checks pass. Keep the previous
   volume until rollback is no longer needed.

Noesis's internal retention archives are content-addressed and independently
verified, but they restore typed retention records, not arbitrary application
tables. They complement the database snapshot; they do not replace it. The
full cross-system procedure is in [recovery.md](recovery.md#noesis-corruption).

## Review

Review quarterly and after a new provider, data class, legal requirement or
backup design. Also review the Noesis section after a Noesis storage/schema
change, a new external artifact backend, a model-cache relocation, a failed
backup or restore exercise, or a material change in source licensing or
legal-hold requirements. Record changes, expired/held items, deletion decisions,
backup aging and exceptions in Modulo as counts, hashes, versions and custody
locations only, never protected content.

Run both structural verifiers after editing this page:

```sh
python3 scripts/verify-retention-policy.py
python3 scripts/verify-noesis-lifecycle.py
```
