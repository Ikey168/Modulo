# Oracle deployment and recovery contract

Oracle is a production runtime. A normal operator may inspect it and run the
verification helpers, but does not build application source on the host.

## Immutable release

`deploy/oci/release.sh --check` validates a full Git SHA and one
`@sha256:<digest>` image reference for each application container:

```sh
cd /srv/modulo/deploy/oci
./release.sh --check <full-git-sha> \
  ghcr.io/example/modulo-backend@sha256:<digest> \
  ghcr.io/example/modulo-frontend@sha256:<digest> \
  ghcr.io/example/noesis@sha256:<digest> \
  ghcr.io/example/praxis@sha256:<digest>
```

The live form pulls those exact images and starts Compose with `--no-build`.
Each application container receives the source-revision label, and the
verified image references are written to `deployment-manifest.json`. The
manifest contains no credentials and is safe to retain with the deployment
evidence. CI is responsible for producing and signing the images; Oracle is
only a consumer of the reviewed digests.

The existing `compose.yml` still has build contexts so local development and
first-time bootstrap remain possible. They are not used by `release.sh`.
To roll back, pass a previously retained manifest to `rollback.sh`; it feeds
the exact revision and four image digests back through the same release checks.

## Backup and restore

`backup.sh --local-only` creates a checksummed snapshot containing PostgreSQL,
Neo4j and Noesis durable state. It excludes the Noesis model cache and marks a
snapshot `VERIFIED` and `COMPLETE` only after all archive checks pass. An
off-host run requires a configured restic repository and adds
`OFFSITE_COMPLETE`.

Run a non-destructive local drill against a completed snapshot:

```sh
./restore-drill.sh /srv/backups/modulo/<snapshot> --report restore-drill-report.json
```

The drill verifies checksums, extracts the two file-backed stores into a
temporary directory, and restores PostgreSQL with the pgvector-compatible
drill image into a throw-away container. It never mounts or overwrites a live
volume. `offsite-drill.sh --restore` performs
the corresponding archive-only drill after downloading the newest tagged
restic snapshot.

## Acceptance boundary

The repository now provides the deterministic release, backup, and restore
mechanisms. Full Oracle acceptance still requires the external CI promotion,
an independently stored off-host backup, and an authenticated restore on a
clean host. Those are provider/owner operations and must not be represented as
complete merely because the local checks pass.
