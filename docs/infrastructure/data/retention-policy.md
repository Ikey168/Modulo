# Data retention and lifecycle policy

This policy turns retention and deletion into explicit decisions. It applies to
personal devices, the Raspberry Pi 5 homeserver, Oracle production, Netcup
development, Modulo, Noesis, Paperless and backup repositories. It contains no
secret values and is not a substitute for legal or tax advice.

## Lifecycle

Every governed dataset has one authority and moves deliberately through:

```text
Capture -> Active -> Reference -> Archive -> Delete eligible -> Purged
```

`Delete eligible` is a review state, not an automatic deletion command. A
dataset may be purged only when its authority, replicas, legal/business hold,
backup aging and recovery consequences are understood. Synchronization is not a
backup and a backup is not an authority.

## Data classes

| Class | Meaning | Default lifecycle |
| --- | --- | --- |
| T0 | Identity and recovery: recovery codes, backup credentials, encryption and SSH recovery material | Retain current material while the protected system exists; keep superseded material only until replacement and independent recovery are verified; never auto-delete |
| T1 | Irreplaceable originals: personal documents/photos, original writing, research and created media | Permanent archive unless the owner makes a recorded deletion decision; independent backups required |
| T2 | Operational state: Modulo, Noesis authority, databases, uploads and persistent service state | Versioned while active; retain recovery points per service policy; purge only after replacement/cutover and restore evidence |
| T3 | Version-controlled source: repositories, infrastructure, dotfiles and configuration | Git history is authoritative; retain protected branches/tags and independent repository bundles; generated checkouts are replaceable |
| T4 | Expensive derived data | Retain while reproduction cost exceeds storage/retrieval cost; record source/version before deletion |
| T5 | Replaceable downloads: public datasets, packages, models and downloaded media | Cache only when useful; delete under capacity pressure after source and version are recorded |
| T6 | Ephemeral: caches, build outputs, temporary files, dependencies and scratch data | No backup; delete automatically or during routine cleanup when not in use |

When classification is uncertain, use the more protective class temporarily and
create a review item. Unknown never means safe to delete.

## Dataset rules

| Dataset | Authority | Class | Retention/control |
| --- | --- | --- | --- |
| Password-manager and offline recovery material | owner-controlled vault/offline custody | T0 | current verified set; superseded copies removed only after replacement test |
| Paperless records | Paperless on Pi plus record source metadata | T1/T2 | class and review date tracked; expired items require human review; no automatic document deletion |
| Modulo notes and plugin state | Oracle PostgreSQL/plugin-state service | T2 | versioned portable export plus database snapshots; deleted records age out only through an explicit service/backup policy |
| Modulo attachments | server attachment store | T1/T2 | included in managed ZIP/off-host protection; orphan cleanup requires checksum and reference review |
| Noesis sources and provenance | Noesis source/data store | T1/T2 | preserve sources, claims and provenance; embeddings/indexes/caches are T4/T6 and rebuildable |
| Git repositories and infrastructure definitions | declared Git remote plus verified local unpushed work | T3 | protect main/tags; bundle unpushed refs before device/server disposal |
| Oracle snapshots | encrypted off-host backup | T2 | seven daily, four weekly and twelve monthly after a successful upload; failed uploads never trigger pruning |
| Paperless Restic snapshots | local and independently authenticated off-site repositories | T1/T2 | keep the configured daily/weekly/monthly policy; changes require a successful clean restore first |
| Application/audit logs | producing service | T2/T5 | minimum needed for incident/debugging review; default 30 days online, up to 90 days for security/audit evidence unless a documented requirement differs |
| CI/test artifacts | GitHub/release store | T4/T5 | retain releases/SBOM/evidence as declared; ordinary debug artifacts default to 30 days |
| Temporary exports | creating host | T6, or T0/T1 until imported | default seven days; sensitive exports are deleted immediately after verified import unless they are the declared encrypted backup |
| Build output, dependency caches and packages | reproducible source/lockfiles | T6 | no backup; safe to remove when no process uses them |

## Deletion gate

Before deleting T0-T4 data, record all of the following:

- dataset and authoritative location;
- classification and reason;
- applicable hold/retention end;
- known replicas and synchronization paths;
- last verified backup and restore evidence;
- approver/operator and deletion date;
- when the deleted content will age out of each backup tier.

Deletion is blocked when the authority is disputed, a legal/business hold is
unknown, the only backup is unverified, or a replica may reintroduce the data.
Bulk deletion, backup pruning and provider teardown require a preview/inventory
and a rollback copy.

## Implementation controls

- Modulo's GoBD Vault tracks configurable retention classes and reports expiry;
  it never auto-deletes expired records.
- The Paperless integration exposes retention/expiry review and creates review
  tasks rather than deleting documents.
- Pi Paperless retention review and quarterly timers are enabled; their tests
  validate lifecycle behavior without deleting real records.
- Oracle backup pruning runs only after a successful verified off-host upload.
- Life OS exports preserve recognized server stores and human-readable indexes;
  browser caches and reproducible derived state are non-authoritative.
- Git, CI and infrastructure configuration retain versions; build caches and
  dependency downloads are excluded from recovery scope.

## Review and evidence

Review quarterly and after a new provider, data class, legal requirement or
backup design. Record changes, expired/held items, deletion decisions, backup
aging and exceptions in Modulo without copying protected content.

Run the structural verifier after changing this policy:

```sh
python3 scripts/verify-retention-policy.py
```
