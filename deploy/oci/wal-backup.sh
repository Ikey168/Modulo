#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

backup_root=${BACKUP_ROOT:-/srv/backups/modulo}
wal_root="$backup_root/wal"
mkdir -p "$backup_root" "$wal_root"
backup_root=$(realpath "$backup_root")
wal_root=$(realpath "$wal_root")
exec 9>"$backup_root/.backup.lock"
flock -n 9 || { echo 'Another backup is running; WAL sync will retry next hour.'; exit 0; }

: "${RESTIC_REPOSITORY:?Configure an off-host restic repository before enabling WAL sync}"
[[ $RESTIC_REPOSITORY =~ ^(s3:|sftp:|rest:|azure:|gs:|b2:) ]] || {
  echo 'WAL sync requires an off-host restic repository.' >&2
  exit 1
}
restic cat config >/dev/null

# Keep enough archived WAL to pair with the oldest retained daily base backup.
# The extra hour covers segment timestamp and base-backup start boundaries.
oldest_base_epoch=
for snapshot in "$backup_root"/20*; do
  [[ -d $snapshot && -f $snapshot/PITR_BASE_COMPLETE && -f $snapshot/OFFSITE_COMPLETE ]] || continue
  [[ -f $snapshot/PITR_BASE_STARTED_AT ]] || continue
  started_at=$(<"$snapshot/PITR_BASE_STARTED_AT")
  started_epoch=$(date -u -d "$started_at" +%s)
  if [[ -z $oldest_base_epoch || $started_epoch -lt $oldest_base_epoch ]]; then
    oldest_base_epoch=$started_epoch
  fi
done
[[ -n $oldest_base_epoch ]] || {
  echo 'No completed offsite physical PostgreSQL base backup is available yet.' >&2
  exit 1
}
wal_cutoff=$(date -u -d "@$((oldest_base_epoch - 3600))" +%Y-%m-%dT%H:%M:%SZ)
find "$wal_root" -maxdepth 1 -type f ! -newermt "$wal_cutoff" -delete

restic backup --tag modulo-wal --host "${RESTIC_BACKUP_HOST:-$(hostname)}" "$wal_root"
prune_wal_repo=true
if [[ -f $backup_root/.wal-pruned-at ]]; then
  last_prune=$(stat -c %Y "$backup_root/.wal-pruned-at")
  if (( $(date +%s) - last_prune < 86400 )); then prune_wal_repo=false; fi
fi
forget_args=(--group-by host,tags --tag modulo-wal --host "${RESTIC_BACKUP_HOST:-$(hostname)}"
  --keep-within 24h --keep-daily 17)
if $prune_wal_repo; then
  restic forget "${forget_args[@]}" --prune
  touch "$backup_root/.wal-pruned-at"
else
  restic forget "${forget_args[@]}"
fi

printf 'Off-host WAL archive complete through %s (cutoff %s).\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$wal_cutoff"
