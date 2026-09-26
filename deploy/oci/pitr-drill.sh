#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage: pitr-drill.sh <base-backup-directory> <wal-directory> <target-time> [--report <path>]

Restores a physical PostgreSQL base backup into an isolated disposable
container, replays archived WAL to target-time, and waits for recovery to pause.
No live database volume is mounted or changed.
EOF
}

die() {
  echo "pitr-drill.sh: $*" >&2
  exit 1
}

[[ $# -ge 3 ]] || { usage; exit 2; }
snapshot_arg=$1
wal_arg=$2
target_time=$3
shift 3
report_path=${PITR_DRILL_REPORT:-}
while [[ $# -gt 0 ]]; do
  case $1 in
    --report)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      report_path=$2
      shift 2
      ;;
    --help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $target_time =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}[T\ ][0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?([+-][0-9]{2}(:?[0-9]{2})?|Z)$ ]] || die "target time must be an ISO timestamp with a time zone"
snapshot=$(realpath -e -- "$snapshot_arg") || die "base backup directory does not exist"
wal_dir=$(realpath -e -- "$wal_arg") || die "WAL archive directory does not exist"
[[ -d $snapshot && -d $wal_dir ]] || die "backup and WAL paths must be directories"
for marker in VERIFIED PITR_BASE_COMPLETE PITR_BASE_STARTED_AT; do
  [[ -f $snapshot/$marker ]] || die "base backup is missing $marker"
done
[[ -f $snapshot/postgres-base.tar ]] || die "base backup is missing postgres-base.tar"
base_epoch=$(date -u -d "$(<"$snapshot/PITR_BASE_STARTED_AT")" +%s) || die "invalid base-backup timestamp"
target_epoch=$(date -u -d "$target_time" +%s) || die "invalid target timestamp"
(( target_epoch >= base_epoch )) || die "target time predates this physical base backup"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/modulo-pitr-drill.XXXXXX")
container_name=modulo-pitr-drill-$$
status=failed
finish() {
  rc=$?
  trap - EXIT
  if (( rc )) && docker inspect "$container_name" >/dev/null 2>&1; then
    docker logs "$container_name" >&2 || true
  fi
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  if [[ -d $tmp_dir ]] && command -v docker >/dev/null 2>&1 && docker image inspect "${postgres_image:-pgvector/pgvector:pg16}" >/dev/null 2>&1; then
    docker run --rm --user 0 --volume "$tmp_dir:/restore" \
      "${postgres_image:-pgvector/pgvector:pg16}" chmod -R 0777 /restore >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmp_dir"
  if [[ -n $report_path ]]; then
    report_tmp=$(mktemp "${report_path}.tmp.XXXXXX")
    jq -n \
      --arg status "$status" \
      --arg snapshot "$(basename "$snapshot")" \
      --arg target "$target_time" \
      --arg checked_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{format:"modulo.pitr-drill.v1",status:$status,snapshot:$snapshot,targetTime:$target,checkedAt:$checked_at}' \
      > "$report_tmp"
    chmod 0644 "$report_tmp"
    mv -f -- "$report_tmp" "$report_path"
  fi
  exit "$rc"
}
trap finish EXIT

command -v docker >/dev/null 2>&1 || die "docker is required"
command -v jq >/dev/null 2>&1 || die "jq is required"
postgres_image=${POSTGRES_DRILL_IMAGE:-pgvector/pgvector:pg16}
if ! docker image inspect "$postgres_image" >/dev/null 2>&1; then docker pull "$postgres_image" >/dev/null; fi

mkdir -p "$tmp_dir/base" "$tmp_dir/data"
tar -xf "$snapshot/postgres-base.tar" -C "$tmp_dir/base"
for archive in base.tar.gz pg_wal.tar.gz; do
  [[ -s $tmp_dir/base/$archive ]] || die "physical backup is missing $archive"
  gzip -t "$tmp_dir/base/$archive"
  tar -tzf "$tmp_dir/base/$archive" >/dev/null
done
{
  printf "\nrestore_command = 'cp /recovery-wal/%%f %%p'\n"
  printf "recovery_target_time = '%s'\n" "$target_time"
  printf "recovery_target_action = 'pause'\n"
} > "$tmp_dir/recovery.conf"

docker run --rm --user 0 \
  --volume "$tmp_dir:/restore" \
  "$postgres_image" sh -ec '
    tar -xzf /restore/base/base.tar.gz --no-same-owner -C /restore/data
    mkdir -p /restore/data/pg_wal
    tar -xzf /restore/base/pg_wal.tar.gz --no-same-owner -C /restore/data/pg_wal
    cat /restore/recovery.conf >> /restore/data/postgresql.auto.conf
    touch /restore/data/recovery.signal
    chown -R postgres:postgres /restore/data
  '

postgres_user=${POSTGRES_USER:-modulo}
docker run --detach --name "$container_name" --network none --user 999 \
  --group-add "${MODULO_WAL_GID:-1001}" \
  --env POSTGRES_USER="$postgres_user" \
  --env POSTGRES_PASSWORD=pitr-drill \
  --volume "$tmp_dir/data:/var/lib/postgresql/data" \
  --volume "$wal_dir:/recovery-wal:ro" \
  "$postgres_image" postgres -c archive_mode=off >/dev/null

reached_target=false
for _ in {1..180}; do
  if docker exec "$container_name" psql -U "$postgres_user" -d postgres -Atqc \
      "SELECT pg_is_in_recovery() AND pg_get_wal_replay_pause_state() = 'paused'" 2>/dev/null | grep -qx t; then
    reached_target=true
    break
  fi
  state=$(docker inspect "$container_name" --format '{{.State.Status}}' 2>/dev/null || true)
  [[ $state == running ]] || die "throw-away PostgreSQL stopped before reaching the recovery target"
  sleep 1
done
$reached_target || die "PostgreSQL did not reach and pause at the requested target time"
if [[ -n ${PITR_DRILL_EXPECT_DATABASE:-} ]]; then
  [[ $PITR_DRILL_EXPECT_DATABASE =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "expected database name is invalid"
  found_database=$(docker exec "$container_name" psql -U "$postgres_user" -d postgres -Atqc \
    "SELECT count(*) FROM pg_database WHERE datname = '$PITR_DRILL_EXPECT_DATABASE'")
  [[ $found_database == 1 ]] || die "the expected database is absent at the recovery target"
fi

status=passed
printf 'PITR restore drill passed: %s at %s\n' "$(basename "$snapshot")" "$target_time"
