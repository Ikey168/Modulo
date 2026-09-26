# Noesis data lifecycle and backup policy

Noesis is a knowledge and evidence system, not a second task tracker. Its
production authority is the `modulo-oci_noesis_data` Docker volume on Oracle.
The repository defines code and schemas; the volume contains the live research
state. Credentials and recovery material remain outside both locations.

## Data classes

| Class | Examples | Authority | Backup and lifecycle |
| --- | --- | --- | --- |
| Irreplaceable source state | imported source bytes or text, unique web captures, document revisions, annotations, provenance, claims, citations, user-authored research outputs | Noesis DuckDB in `/data/noesis.duckdb` | Daily consistent volume snapshot; retain under the Noesis retention/hold rules and the personal retention policy. Never discard merely because a derived index exists. |
| Operational definitions | namespace/source-pack definitions, workflow configuration, enabled packs | Git repositories for definitions; `/data/packs` for live installed state | Version-control non-secret definitions and include live state in the daily data-volume snapshot. |
| Costly derived state | embeddings, enriched parser output, vector/search indexes, expensive intermediate results | Noesis DuckDB | Include with the database snapshot when stored in the same file. It may be rebuilt only from retained source revisions with the exact model/configuration receipt. |
| Cheap derived state | ordinary indexes, downloaded public metadata, reproducible parser scratch data | Noesis runtime | May be regenerated, but remains inside a whole-database snapshot when separating it would make recovery less reliable. |
| Disposable runtime state | temporary parser files, scratch workspaces, transient logs | container filesystem or `/data/logs` | Do not treat as recovery authority. Logs use bounded operational retention; scratch data may be removed after failed-run evidence is captured. |
| Re-downloadable assets | public model weights and tokenizer caches | `modulo-oci_noesis_models` / `/models-cache` | Excluded from backups. Restore from pinned model names, immutable revisions and license records. |
| Portable evidence | verified answer/research bundles and retention archives | explicitly selected export destination | Retain when they are the delivery or legal/decision record. Verify checksums/signatures independently; an export is not a substitute for the live database backup. |

## Production backup contract

`deploy/oci/backup.sh` owns the Oracle snapshot. It:

1. acquires a single-instance lock and writes into a hidden partial directory;
2. exports PostgreSQL separately;
3. stops Noesis and Neo4j before copying their `/data` volumes, preventing a
   torn DuckDB or graph snapshot;
4. excludes the separate Noesis model-cache volume;
5. validates gzip and tar readability, records SHA-256 checksums, and marks the
   snapshot `VERIFIED` and `COMPLETE` only after every check passes;
6. restarts stopped services even when backup fails;
7. retains completed local-only snapshots for eight days. The separate
   immutable/off-site project must supply and test the remote restic target.

The systemd timer runs daily. The resulting maximum normal data-loss interval
is 24 hours; recovery is expected within four hours once a clean Oracle host and
the snapshot are available. A failed or partial directory is evidence, not a
restore candidate.

## Restore sequence

1. Select a directory containing `VERIFIED`, `COMPLETE`, `SHA256SUMS`, and
   `noesis-data.tar.gz`; verify the checksum manifest before extraction.
2. Stop Noesis. Create a new empty Docker volume rather than overwriting the
   only current copy.
3. Extract the archive into the new volume, attach it to the pinned Noesis
   image/configuration, and start the service privately.
4. Run health, schema/version, document-count, provenance, cited-answer, and
   representative search checks. Confirm that missing model weights are
   reported as unavailable until the pinned cache is restored, not replaced by
   fabricated output.
5. Promote the restored volume only after the checks pass. Retain the previous
   volume until rollback is no longer required.

Noesis's internal retention archives are content-addressed and independently
verified, but they restore typed retention records rather than arbitrary
application tables. They complement this database-level snapshot; they do not
replace it.

## Review triggers

Review this policy after a Noesis storage/schema change, new external artifact
backend, model-cache relocation, failed backup, failed restore exercise, or a
material change in source licensing or legal-hold requirements. Record only
counts, hashes, versions and custody locations in Modulo—never source content
that has a stricter access class.
