#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
backup_root=${BACKUP_ROOT:-/srv/backups/modulo}
mkdir -p "$backup_root"
backup_root=$(realpath "$backup_root")
exec 9>"$backup_root/.backup.lock"
flock -n 9 || { echo 'A backup is already running.' >&2; exit 1; }
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
# POSTGRES_USER is expanded inside the database container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T db sh -ec 'pg_dumpall -U "$POSTGRES_USER"' | gzip -9 > "$target/postgres.sql.gz"
gzip -t "$target/postgres.sql.gz"
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
(cd "$target" && sha256sum postgres.sql.gz neo4j-data.tar.gz noesis-data.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
touch "$target/VERIFIED"
mv "$target" "$backup_root/$stamp"
target="$backup_root/$stamp"
if ! $local_only; then
  restic backup --tag modulo-oci --host "${RESTIC_BACKUP_HOST:-$(hostname)}" "$target"
  restic check
  restic forget --group-by host,tags --tag modulo-oci --host "${RESTIC_BACKUP_HOST:-$(hostname)}" --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
  touch "$target/OFFSITE_COMPLETE"
fi
touch "$target/COMPLETE"
# Remove only our own verified snapshots, after the new required upload succeeded.
for old in "$backup_root"/*; do
  [[ -d $old && -f $old/COMPLETE ]] || continue
  [[ $local_only == true || -f $old/OFFSITE_COMPLETE ]] || continue
  if [[ -n $(find "$old/COMPLETE" -mtime +7 -print) ]]; then rm -rf -- "$old"; fi
done
if [[ -n ${BACKUP_RESULT_FILE:-} ]]; then printf '%s\n' "$target" > "$BACKUP_RESULT_FILE"; fi
printf 'Backup complete: %s\n' "$target"
