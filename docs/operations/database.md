# Database operations

This page is for operators who run Modulo's PostgreSQL database: how the schema
is versioned, how to adopt an existing database, how backups and restore drills
work on each deployment target, and how to run the tenant-ownership migration.
For the data model itself see [Data and state](../architecture/data-and-state.md).

## Schema ownership: Flyway owns PostgreSQL DDL

Every PostgreSQL profile (`docker`, `staging`, `production`, `kubernetes`) runs
Flyway at startup and then Hibernate with `ddl-auto=validate`. Hibernate never
creates or alters PostgreSQL tables. H2 (the no-profile default for local runs and
most tests) keeps Hibernate schema generation.

| Setting | Value |
|---------|-------|
| Migration location | [`backend/src/main/resources/db/postgresql`](../../backend/src/main/resources/db/postgresql) |
| History table | `public.modulo_schema_history` |
| Schemas | `public`, `application` |
| `baseline-on-migrate` | `false` (existing databases are adopted explicitly) |
| `clean-disabled` | `true` |

`V1__Current_JPA_baseline.sql` is the Hibernate 5 entity mapping at the time
Flyway was introduced (BIGINT note IDs) plus the JDBC plugin tables. Later
versions add packs, plugin state, tenant-owned tags, durable workflows,
approvals, typed properties, semantic knowledge, marketplace trust, workspace
files, remote credentials and Praxis submissions. List them with
`ls backend/src/main/resources/db/postgresql`.

The old [`database/migrations`](../../database/migrations) directory describes a
different, UUID-based schema. It is deliberately not on the Flyway path. Do not
point Flyway at it, and do not rewrite checksums to hide drift.

### Rules for new migrations

- Add a new numbered file. Never edit a migration that has been deployed.
- Keep changes additive and backward compatible while the previous release is
  still a rollback candidate. Drop or rename columns in a later release, after
  old clients are gone.
- Application rollback swaps image digests; it does not reverse migrations. A
  database restore is a separate maintenance operation and loses writes made
  after the snapshot.

`SchemaMigrationTest` runs against PostgreSQL 16 (Testcontainers) and checks
fresh install, repeat startup, upgrade of a real `pg_dump`/`pg_restore` copy,
preservation of notes and sequence allocation, rejection of the UUID schema,
entity drift and checksum drift:

```sh
mvn -f backend/pom.xml -Dtest=SchemaMigrationTest test
```

### New database

Start the backend with a PostgreSQL profile. Flyway applies every migration,
then Hibernate validates. Do not mount the legacy plugin seed SQL into a new
database; V1 creates those tables.

### Adopting an existing database

A database that Hibernate managed before Flyway existed has no history table.
Adoption records V1 only after Hibernate validates every mapped entity and SQL
checks confirm the baseline plugin columns. It does not convert UUID IDs, repair
missing tables or rewrite note data.

The schema commands run through
[`SchemaMigrationTool`](../../backend/src/main/java/com/modulo/migration/SchemaMigrationTool.java),
which starts without HTTP endpoints or schedulers. It reads
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and
`SPRING_DATASOURCE_PASSWORD` from the container environment (never from CLI
arguments) and needs DDL rights. On the OCI host,
[`deploy/oci/schema.sh`](../../deploy/oci/schema.sh) wraps it:
`./schema.sh adopt|migrate|validate`.

1. Take an off-host backup and restore it into an isolated drill database.
2. Rehearse: set `MODULO_MIGRATION_IMAGE` to the candidate backend image digest
   and run `deploy/oci/restore-drill.sh SNAPSHOT_DIRECTORY`. The drill adopts the
   restored copy when it has no history, then migrates and validates it.
3. In a maintenance window, stop writers: `docker compose -f compose.yml stop backend`
   (from `deploy/oci`).
4. Export the candidate `MODULO_BACKEND_IMAGE` and `MODULO_FRONTEND_IMAGE` digests,
   then run `./schema.sh adopt`, `./schema.sh migrate`, `./schema.sh validate`.
5. Start the release and run authenticated verification
   (`python3 verify-deployment.py`).

Run adoption once, with the same database configuration the application uses.

If validation rejects the database, keep the original backup and compare schemas
on the restored copy. Do not enable `baseline-on-migrate`, switch back to
`ddl-auto=update`, or run the UUID migrations to get past the error.

## Backups and restore drills

What you get depends on the deployment target. None of them provides continuous
point-in-time recovery; nightly dumps mean roughly one day of recovery point.

| Target | Tooling | Schedule | Off-host | Drill |
|--------|---------|----------|----------|-------|
| OCI production host | [`deploy/oci/backup.sh`](../../deploy/oci/backup.sh), restic | systemd timer, daily 03:30 UTC | Required by default | Monthly, 1st at 05:00 UTC, automated |
| Raspberry Pi | [`deploy/pi/backup.sh`](../../deploy/pi/backup.sh) | cron you add | Manual copy | Manual |
| Compose (generic) | [`docker-compose.backup.yml`](../../docker-compose.backup.yml), [`database/backups`](../../database/backups), [`scripts/backup-manager.sh`](../../scripts/backup-manager.sh) | container cron, daily 02:00 UTC | Optional S3 | Monthly container drill |

### OCI host (production)

What is backed up: PostgreSQL with `pg_dumpall` (this includes Keycloak's
database) and the Noesis data directory. Noesis is stopped briefly while its
data is archived. Not included, so back
them up separately: deployment secrets, realm configuration, external attachment
stores and device-local workspace exports.

Setup, once:

1. Install restic on the host. Create an off-host repository and run
   `restic init` once. Keep the repository password somewhere other than the
   server.
2. Copy [`backup.env.example`](../../deploy/oci/backup.env.example) to
   `/etc/modulo/backup.env` (root-owned, mode 0600) and fill in
   `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE` and the object-store credentials.
   The password file must be readable by the service user, for example
   `root:ubuntu 0640` inside a restricted directory.
3. Create `/srv/backups/modulo`, writable by `ubuntu`.
4. Install the timers:

   ```sh
   sudo install -m 0644 systemd/modulo-*.service systemd/modulo-*.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now modulo-backup.timer modulo-restore-drill.timer
   ```

Behaviour you can rely on:

- `./backup.sh` needs an off-host restic repository. For a device-only snapshot
  run `./backup.sh --local-only`; a local snapshot is not a substitute for an
  encrypted off-host copy.
- It detects a failed dump even when gzip succeeds, verifies archive integrity
  and SHA-256 checksums, restarts only the services it stopped, and never prunes
  older backups after a failed upload. A lock prevents overlapping runs.
- Retention after a successful upload: 7 daily, 4 weekly, 12 monthly restic
  snapshots per host. Local completed snapshots are kept for 7 days.
- Set `RESTIC_BACKUP_HOST` consistently if backup or drill jobs move to another
  host. Export `POSTGRES_DB` for drills when the application database is not the
  default.
- `./offsite-drill.sh` checks the repository, restores the latest snapshot, and
  runs `restore-drill.sh` against an isolated PostgreSQL container. No production
  database or volume is touched. The SQL import and application-table queries
  must succeed. The Noesis archive gets checksum and archive-integrity checks
  only; that does not prove Noesis boots from the restore.
- Failures surface as a non-zero systemd result. Inspect with
  `journalctl -u modulo-backup -u modulo-restore-drill`.
- Every `release.sh deploy` also takes and uploads a verified backup and runs the
  candidate's migrations against a restored copy before switching containers
  (see [Deployment](deployment.md#oci-production-host)).

### Raspberry Pi

```sh
sudo mkdir -p /mnt/backup/modulo       # ideally an external disk
./backup.sh                            # or: ./backup.sh /path/to/target
# crontab: 15 3 * * * /home/pi/Modulo/deploy/pi/backup.sh >> /var/log/modulo-backup.log 2>&1
```

It takes a live `pg_dump`, then deletes files older than `KEEP_DAYS` (default 30). Copy the target directory off the device
regularly. Test a restore once, before you need it:

```sh
gunzip -c /mnt/backup/modulo/postgres-<stamp>.sql.gz \
  | docker compose -f docker-compose.pi.yml exec -T db psql -U modulo modulodb
```

### Generic Compose stack

The `backup` profile adds two containers to the main compose file:

```sh
docker compose -f docker-compose.yml -f docker-compose.backup.yml --profile backup up -d
```

- `db-backup` runs cron from [`database/backups/crontab`](../../database/backups/crontab):
  full backup daily at 02:00 UTC, cleanup Sundays at 03:00 UTC (7-day retention),
  restore drill on the first Sunday of the month at 04:00 UTC. Set
  `BACKUP_S3_BUCKET` and `AWS_REGION` to upload to `s3://<bucket>/database-backups/`.
- `restore-drill` restores into `modulodb_staging`. Run on demand with
  `docker compose run restore-drill /scripts/restore-script.sh drill`.

[`scripts/backup-manager.sh`](../../scripts/backup-manager.sh) wraps these:
`start-services`, `stop-services`, `create-backup`, `restore [file] [target_db]`,
`cleanup`, `status`, `logs`.

These scripts simulate WAL archiving; they do not give a one-hour recovery point.
The [`db-backup-testing`](../../.github/workflows/db-backup-testing.yml) workflow
exercises them in CI (daily at 06:00 UTC, and a monthly drill on the first Sunday).

### Restoring for real

1. Stop the application writers (backend) so nothing writes during the restore.
2. Restore PostgreSQL from the chosen dump into a fresh database, not over the
   live one. Validate with the backend's schema tool
   (`./schema.sh validate` on OCI) before pointing the application at it.
3. Start the release and run the smoke checks in [Runbooks](runbooks.md#post-deploy-smoke-test).
4. Record which snapshot you restored and the window of writes that was lost.

## Tenant-ownership migration

Migration V4 and the ownership changes that came with it make the authenticated,
provisioned account the only authority over private notes, tags, links, files,
tasks, offline queues, collaboration and audit access. The acting user is the
numeric `users.id` resolved from the verified issuer and subject (or an
authenticated local principal). Request headers, request-body owners and editor
names cannot select a different account. Unknown accounts fail closed: provision
their verified provider subject first.

### Upgrade

1. Stop application writes. Back up PostgreSQL, the SQLite offline database and
   local or blob attachments together.
2. Rehearse on a restored copy.
3. Run the schema migration entrypoint through V4 before starting the new
   application. An unmanaged database must pass the V1 adoption check first.
   Never use Hibernate schema updates to adopt PostgreSQL.

What V4 does:

- Splits each shared legacy tag into one tag per owning note account and rewires
  the relationships, so each account can reuse tag names independently. Tags on
  unowned notes stay as they were.
- Leaves unowned notes and SQLite queue rows inaccessible until reviewed. Logging
  in never claims legacy data.
- Keeps historical share tokens and audit actors (they were derived from
  caller-supplied headers) but marks them unverified. Owners must create new share
  links. Old audit records stay available to database administrators and are
  excluded from the user audit API. Do not bulk-mark them verified.
- New public share grants resolve their stored, verified owner and stop working
  if the note changes owner.

### Assigning legacy notes to owners

Prepare a reviewed UTF-8 CSV without a header, one `note_id,owner_id` per line.
Resolve every target against `public.users` and verified provider subjects. Mixed
workspaces need individual assignments; an email address or legacy editor string
alone is not evidence of ownership. Keep the mapping with the backup and change
record.

With the application stopped and `SPRING_DATASOURCE_*` set from your secret
environment, from `backend/`:

```sh
mvn -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile=/tmp/modulo-classpath
java -cp "target/classes:$(cat /tmp/modulo-classpath)" \
  com.modulo.migration.OwnershipBackfillTool preview /secure/reviewed-owners.csv
java -cp "target/classes:$(cat /tmp/modulo-classpath)" \
  com.modulo.migration.OwnershipBackfillTool apply /secure/reviewed-owners.csv
```

`preview` runs the full validation and relationship changes in a transaction and
rolls back. `apply` commits the whole mapping atomically. Missing notes, missing
users, already-owned notes and duplicate assignments reject the batch. The tool
keeps note IDs and content, moves tags into the target owner's namespace, leaves
original legacy tags intact, and never transfers an already-owned note.

Review legacy links and task relationships separately: a relationship that
crosses owners is inaccessible. Do not copy someone else's task to restore an old
global link. Unassigned records can stay quarantined indefinitely.

### SQLite offline store, files and collaboration

- The SQLite offline schema gains a nullable `user_id` through its own updater.
  Back up the file first and check `PRAGMA table_info(offline_notes)` after
  startup. Assign a legacy row only after checking its `server_id` against the
  reviewed PostgreSQL owner (for never-synced rows, review the real source
  account). Use a transaction, an explicit list of row IDs and
  `WHERE user_id IS NULL`. Leave unresolved rows unowned. PostgreSQL's legacy
  offline table gets the same column in V4; that does not replace the SQLite
  backup.
- Background jobs without an authenticated principal no longer replay global
  queues. Manual sync replays only the caller's queue, with per-account locks. A
  background worker needs independently verified owner authority before it is
  enabled.
- Local file URLs require authentication and are served `private, no-store`.
- Azure containers are initialised private and existing container ACLs are reset
  at startup, so the storage identity must be allowed to change ACLs. Disable
  public blob access at the storage-account level and purge old CDN caches before
  reopening; bytes that were already cached publicly cannot be recalled by the
  application. Blob download grants are read-only and expire after five minutes.
- STOMP `CONNECT` authenticates the login token. Note topics check ownership at
  subscribe time and again on delivery; generic updates go to private user
  queues. Expired sockets stop receiving data.

### Verify before reopening

Use two separately provisioned accounts. Create identically named tags and
private notes in each and confirm that lists, search, caches, exports, task
relationships, attachments and graph paths never cross accounts. Try forged
owner/editor headers and foreign IDs on reads and writes. Confirm that only newly
created share grants work and that audit filters cannot impersonate an admin.

### Rollback

Restore the complete backup. Do not deploy the previous global-access application
over newly private data, and do not roll back only the tag mappings.
