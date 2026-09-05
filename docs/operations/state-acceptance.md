# Synchronized state acceptance and restore

Issue #423; parent #409. The `State acceptance` GitHub Actions workflow runs
without identity-provider, cloud-storage or public API dependencies. PostgreSQL
runs in a disposable Testcontainer; signed fixture tokens use a test-only key.
Diagnostics are published as `state-acceptance-diagnostics` for seven days.

## Evidence covered

- Two HTTP clients, two authenticated owners, invalid/expired authentication,
  namespace lists, conditional writes, deletion and machine-readable conflicts.
- PostgreSQL custom-format backup and restore into an empty database, followed by
  restart. Owner data, tombstones, record versions and custom schema versions are
  checked through the API and database after restoration.
- Owner-partitioned offline queues, restart, ordered replay, storage quota failure,
  delayed acknowledgements, explicit conflict decisions and changed database history.
- Operational-store migration, duplicate IDs, remote conflicts, recovery exports,
  account switches and deterministic financial export ordering.
- Existing PostgreSQL tests exercise payload limits, malformed JSON, grant expiry
  and revocation, event delivery, namespace permissions and migration adoption.

Run the workflow locally with Java 17, Docker and the repository's Node toolchain:

```sh
mvn -f backend/pom.xml -Dtest=StateAcceptanceTest,PluginStateStoreTest,PluginStateContractTest,SchemaMigrationTest test
npm ci --workspace frontend --include-workspace-root
npm run test:run --workspace frontend -- src/services/__tests__/stateAcceptance.test.ts src/services/__tests__/pluginStateClient.test.ts src/features/workspace/__tests__/operationalState.test.ts src/features/workspace/__tests__/useOperationalCollection.test.tsx
npm run typecheck --workspace frontend
```

The suite verifies the shared web/desktop client and real HTTP/storage boundary.
It does not replace a packaged Electron release smoke test or certify a deployment's
encryption, RPO or RTO. No production account or database is modified by these tests.

## Database restore procedure

V6 adds a storage-generation UUID. API mutations require the generation returned
by authenticated `GET /api/workspaces/personal/plugin-state/{namespace}?generation`
in the `X-Modulo-State-Generation` header. Missing generations receive 428; stale
ones receive 412. The server checks under a transaction lock so rotation cannot
race an accepted mutation. Deploy the migration and updated client together.

Use standard libpq environment variables for host, user and credentials. Keep
archives on access-controlled, encrypted storage; database exports contain plaintext.

```sh
PGDATABASE=modulodb ./scripts/state-backup.sh backup /secure/backup.dump
# Stop API writers. Create a new empty destination; do not restore over live traffic.
createdb restored_modulo
PGDATABASE=restored_modulo ./scripts/state-backup.sh restore /secure/backup.dump
```

The restore is transactional and fails on SQL errors. Before returning, the script
rotates the generation, revokes restored owner grants and marks historical outbox
rows delivered. Point the application at the restored database only after these
steps succeed. State records and schemas retain their original versions and owners.
An older archive needs the normal schema migrations followed by the same generation
rotation and grant revocation before traffic resumes. This script intentionally
requires the V6 table; it fails rather than claiming an unfenced restore succeeded.

On the next connection, clients refresh cached reads. They preserve every pending
mutation as a conflict against the restored server value; an explicit local/remote
decision is required before replay. Offline clients retain their queue until the
handshake succeeds. This also protects legacy caches with no recorded generation.
A restore that bypasses generation rotation cannot provide this guarantee; use the
procedure above for all state-aware restores.
