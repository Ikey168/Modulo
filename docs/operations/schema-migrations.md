# PostgreSQL schema migrations

PostgreSQL Docker, production, staging, and Kubernetes profiles use Flyway and
Hibernate `validate`. H2 development/tests retain Hibernate schema generation.
Migrations live in `backend/src/main/resources/db/postgresql`; the history table
is `public.modulo_schema_history`. Flyway clean and automatic baselining are disabled.

V1 represents the current Hibernate 5 entity mappings, including BIGINT note IDs,
plus the JDBC plugin tables. V2 adds pack distribution/provenance fields and the
note update index. The historical `database/migrations` directory defines a
different UUID schema and is deliberately excluded. Do not point this Flyway
configuration at that directory or rewrite checksums to disguise drift.

## New database

Start the PostgreSQL-backed application normally. Flyway applies V1 and V2 before
Hibernate validates mappings. Do not mount the legacy plugin seed SQL into a new
PostgreSQL database; those tables are now created by V1.

## Existing Hibernate-managed database

Adoption is explicit. It records V1 only after Hibernate validates every mapped
entity and SQL checks verify the baseline plugin columns. It does not convert
UUID IDs, repair missing tables, or rewrite existing note data.

1. Export an off-host backup and restore it into an isolated drill database.
2. Set `MODULO_MIGRATION_IMAGE` to the candidate backend image digest and run
   `deploy/oci/restore-drill.sh SNAPSHOT_DIRECTORY`. The drill validates and adopts
   the restored schema when it has no history, then migrates and validates it.
3. Schedule a maintenance window and stop the application writers. From
   `deploy/oci`, run `docker compose -f compose.yml stop backend`.
4. Export the candidate `MODULO_BACKEND_IMAGE` and `MODULO_FRONTEND_IMAGE` digests.
   Run `./schema.sh adopt`, `./schema.sh migrate`, then `./schema.sh validate`.
5. Start the release and run authenticated deployment verification.

Run adoption once, using the same database configuration as the application.
If validation rejects a database, keep the original backup and inspect the schema
differences on the restored copy. Do not enable `baseline-on-migrate`, switch back
to `ddl-auto=update`, or run the UUID migrations to bypass the failure.

The administration entrypoint runs without starting HTTP endpoints or scheduled
jobs. It reads `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and
`SPRING_DATASOURCE_PASSWORD` from the container environment; credentials are not
passed as CLI arguments. Schema commands need DDL rights.

## Future changes and rollback

Add a new numbered migration; never edit a deployed migration. Use additive,
backward-compatible changes while the previous application release remains a
rollback candidate. Drop or rename columns in a later release after old clients
are retired. Application rollback changes image digests, not database history.
A database restore is a separate maintenance operation and can lose writes made
after the snapshot.

`SchemaMigrationTest` uses PostgreSQL 16 to verify fresh installation, repeatable
startup, upgrading a real pg_dump/pg_restore copy, preserved notes and sequence
allocation, UUID-schema rejection, entity drift, and checksum drift. Run:

```sh
mvn -f backend/pom.xml -Dtest=SchemaMigrationTest test
```
