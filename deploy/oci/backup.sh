#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
backup_root=${BACKUP_ROOT:-/srv/backups/modulo}
mkdir -p "$backup_root"
backup_root=$(realpath "$backup_root")
exec 9>"$backup_root/.backup.lock"
flock 9
local_only=false
if [[ ${1:-} == --local-only ]]; then local_only=true; elif [[ $# != 0 ]]; then echo 'Usage: backup.sh [--local-only]' >&2; exit 2; fi
if ! $local_only; then
  : "${RESTIC_REPOSITORY:?Configure an off-host restic repository or explicitly use --local-only}"
  [[ $RESTIC_REPOSITORY =~ ^(s3:|sftp:|rest:|azure:|gs:|b2:) ]] || { echo 'An off-host restic repository is required.' >&2; exit 1; }
  restic cat config >/dev/null
fi
stamp=$(date -u +%Y%m%dT%H%M%S)-$$
target="$backup_root/.partial-$stamp"
mkdir "$target"
compose=(docker compose -f compose.yml)
restart=()
cleanup() {
  rc=$?
  trap - EXIT
  if ((${#restart[@]})); then "${compose[@]}" start "${restart[@]}" >/dev/null || rc=1; fi
  if ((rc)); then echo "Backup failed; incomplete files retained at $target" >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Keep the logical dump for simple restores, and take a physical base backup
# with the WAL needed to make that backup consistent. The hourly WAL job ships
# subsequent archive segments off-host.
# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -ec 'pg_dumpall -U "$POSTGRES_USER"' | gzip -9 > "$target/postgres.sql.gz"
gzip -t "$target/postgres.sql.gz"
base_started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$base_started_at" > "$target/PITR_BASE_STARTED_AT"
# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -ec '
  base_dir=/tmp/modulo-pitr-basebackup
  rm -rf "$base_dir"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  pg_basebackup --host=127.0.0.1 --username="$POSTGRES_USER" \
    --checkpoint=fast --format=tar --wal-method=stream --gzip --pgdata="$base_dir"
  test -s "$base_dir/base.tar.gz"
  test -s "$base_dir/pg_wal.tar.gz"
  gzip -t "$base_dir/base.tar.gz" "$base_dir/pg_wal.tar.gz"
  tar -C "$base_dir" -cf - base.tar.gz pg_wal.tar.gz
  rm -rf "$base_dir"
' > "$target/postgres-base.tar"
tar -tf "$target/postgres-base.tar" | grep -qx 'base.tar.gz'
tar -tf "$target/postgres-base.tar" | grep -qx 'pg_wal.tar.gz'
for service in neo4j noesis; do
  container=$("${compose[@]}" ps -aq "$service")
  [[ -n $container ]] || { echo "Missing $service container" >&2; exit 1; }
  volume=$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{if eq .Type "volume"}}{{.Name}}{{end}}{{end}}{{end}}')
  [[ -n $volume ]] || { echo "Missing $service data volume" >&2; exit 1; }
  if [[ $(docker inspect "$container" --format '{{.State.Running}}') == true ]]; then
    restart+=("$service")
    "${compose[@]}" stop "$service"
  fi
  docker run --rm -v "$volume:/source:ro" -v "$target:/backup" alpine:3.22 \
    tar -C /source -czf "/backup/$service-data.tar.gz" .
  gzip -t "$target/$service-data.tar.gz"
  tar -tzf "$target/$service-data.tar.gz" >/dev/null
 done
if ((${#restart[@]})); then "${compose[@]}" start "${restart[@]}"; restart=(); fi
(cd "$target" && sha256sum postgres.sql.gz postgres-base.tar neo4j-data.tar.gz noesis-data.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
touch "$target/VERIFIED"
touch "$target/PITR_BASE_COMPLETE"
mv "$target" "$backup_root/$stamp"
target="$backup_root/$stamp"
if ! $local_only; then
  system_state="$backup_root/system-state"
  mkdir -p "$system_state"
  dpkg-query -W -f='${binary:Package}\t${Version}\n' > "$system_state/packages.tsv"
  systemctl list-unit-files --no-pager > "$system_state/system-unit-files.txt"
  systemctl list-timers --all --no-pager > "$system_state/system-timers.txt"
  docker ps -a --no-trunc > "$system_state/docker-containers.txt"
  docker image ls --digests --no-trunc > "$system_state/docker-images.txt"
  restic backup --tag modulo-oci --host "${RESTIC_BACKUP_HOST:-$(hostname)}" \
    "$target" "$PWD" "$system_state"
  restic check
  restic forget --group-by host,tags --tag modulo-oci --host "${RESTIC_BACKUP_HOST:-$(hostname)}" \
    --keep-within 48h --keep-daily 17 --keep-weekly 8 --keep-monthly 12 --keep-yearly 3 --prune
  touch "$target/OFFSITE_COMPLETE"
fi
touch "$target/COMPLETE"
# Remove only our own verified snapshots, after the new required upload succeeded.
for old in "$backup_root"/*; do
  [[ -d $old && -f $old/COMPLETE ]] || continue
  [[ $local_only == true || -f $old/OFFSITE_COMPLETE ]] || continue
  if [[ -n $(find "$old/COMPLETE" -mtime +16 -print) ]]; then rm -rf -- "$old"; fi
done
if [[ -n ${BACKUP_RESULT_FILE:-} ]]; then printf '%s\n' "$target" > "$BACKUP_RESULT_FILE"; fi
printf 'Backup complete: %s\n' "$target"
