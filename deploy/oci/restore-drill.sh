#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Validate a verified snapshot and restore PostgreSQL into a throw-away
# container. No live volume is mounted or overwritten by this drill.

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

usage() {
  cat >&2 <<'EOF'
Usage: restore-drill.sh <snapshot-directory> [--skip-postgres] [--report <path>]

The drill validates checksums and archive readability, extracts the Noesis and
Neo4j archives into a temporary directory, and restores the PostgreSQL dump to
an isolated disposable container. --skip-postgres is intended only for static
CI checks where Docker is unavailable.
EOF
}

die() {
  echo "restore-drill.sh: $*" >&2
  exit 1
}

[[ $# -ge 1 ]] || { usage; exit 2; }
snapshot_arg=$1
shift
skip_postgres=false
report_path=${RESTORE_DRILL_REPORT:-}
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-postgres) skip_postgres=true; shift ;;
    --report)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      report_path=$2
      shift 2
      ;;
    --help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

snapshot=$(realpath -e -- "$snapshot_arg") || die "snapshot does not exist: $snapshot_arg"
[[ -d $snapshot ]] || die "snapshot is not a directory: $snapshot"
for marker in VERIFIED SHA256SUMS; do
  [[ -f $snapshot/$marker ]] || die "snapshot is missing $marker"
done
for archive in postgres.sql.gz neo4j-data.tar.gz noesis-data.tar.gz; do
  [[ -f $snapshot/$archive ]] || die "snapshot is missing $archive"
done

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/modulo-restore-drill.XXXXXX")
container_name=
postgres_restored=false
postgres_attempted=false
status=failed
report_tmp=

finish() {
  rc=$?
  if [[ -n $container_name ]]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmp_dir"
  if [[ -n $report_path ]]; then
    report_tmp=$(mktemp "${report_path}.tmp.XXXXXX")
    jq -n \
      --arg status "$status" \
      --arg snapshot "$(basename "$snapshot")" \
      --arg checked_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg postgres "$(if $postgres_restored; then echo restored; elif $postgres_attempted; then echo failed; else echo skipped; fi)" \
      '{format:"modulo.restore-drill.v1", status:$status, snapshot:$snapshot, checkedAt:$checked_at, checks:{checksum:"passed", archives:"passed", postgres:$postgres}}' \
      > "$report_tmp"
    chmod 0644 "$report_tmp"
    mv -f -- "$report_tmp" "$report_path"
  fi
  exit "$rc"
}
trap finish EXIT

(cd "$snapshot" && sha256sum -c SHA256SUMS >/dev/null)
gzip -t "$snapshot/postgres.sql.gz"
tar -tzf "$snapshot/neo4j-data.tar.gz" >/dev/null
tar -tzf "$snapshot/noesis-data.tar.gz" >/dev/null
if [[ -f $snapshot/postgres-base.tar ]]; then
  mkdir "$tmp_dir/postgres-base"
  tar -xf "$snapshot/postgres-base.tar" -C "$tmp_dir/postgres-base"
  for archive in base.tar.gz pg_wal.tar.gz; do
    [[ -s $tmp_dir/postgres-base/$archive ]] || die "physical PostgreSQL backup is missing $archive"
    gzip -t "$tmp_dir/postgres-base/$archive"
    tar -tzf "$tmp_dir/postgres-base/$archive" >/dev/null
  done
fi
mkdir "$tmp_dir/neo4j" "$tmp_dir/noesis"
tar -xzf "$snapshot/neo4j-data.tar.gz" --no-same-owner -C "$tmp_dir/neo4j"
tar -xzf "$snapshot/noesis-data.tar.gz" --no-same-owner -C "$tmp_dir/noesis"
[[ -f $tmp_dir/noesis/noesis.duckdb ]] || die "Noesis archive has no noesis.duckdb"

if ! $skip_postgres; then
  postgres_attempted=true
  command -v docker >/dev/null 2>&1 || die "docker is required for PostgreSQL restore"
  docker compose version >/dev/null 2>&1 || die "docker compose is required for PostgreSQL restore"
  postgres_image=${POSTGRES_DRILL_IMAGE:-pgvector/pgvector:pg16}
  if ! docker image inspect "$postgres_image" >/dev/null 2>&1; then
    docker pull "$postgres_image" >/dev/null
  fi
  container_name=modulo-restore-drill-$RANDOM
  docker run --detach --rm --name "$container_name" \
    --env POSTGRES_PASSWORD=restore-drill \
    --env POSTGRES_USER=postgres \
    --env POSTGRES_DB=postgres \
    "$postgres_image" >/dev/null
  ready=false
  for _ in {1..60}; do
    if docker exec "$container_name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  $ready || die "throw-away PostgreSQL did not become ready"
  gunzip -c "$snapshot/postgres.sql.gz" | docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null
  docker exec "$container_name" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc 'SELECT current_database()' | grep -qx postgres
  postgres_restored=true
fi

status=passed
printf 'Restore drill passed: %s\n' "$snapshot"
