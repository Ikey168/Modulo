#!/bin/sh
set -eu

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set in the protected environment}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must point to a protected file}"
[ -r "$RESTIC_PASSWORD_FILE" ] || { printf 'restic password file is not readable\n' >&2; exit 2; }
[ "$(stat -c '%a' "$RESTIC_PASSWORD_FILE")" = 600 ] || { printf 'restic password file must be mode 0600\n' >&2; exit 2; }
command -v restic >/dev/null 2>&1 || { printf 'restic is required\n' >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { printf 'jq is required\n' >&2; exit 2; }

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
staging=${NETCUP_BACKUP_STAGING:-/var/lib/netcup-backup/staging}
mkdir -p "$staging"
chmod 0700 "$staging"
archive=$(NETCUP_BACKUP_DEST="$staging" "$script_dir/../scripts/backup-netcup-state.sh")
trap 'rm -f "$archive" "$archive.sha256"' EXIT HUP INT TERM
"$script_dir/../scripts/verify-netcup-backup.sh" "$archive"
sha256sum "$archive" > "$archive.sha256"
restic backup --tag netcup-development --tag boundary-verified "$archive" "$archive.sha256"
status_dir=${NETCUP_BACKUP_STATUS_DIR:-/var/lib/netcup-backup}
status_file="$status_dir/last-backup.json"
status_tmp="$status_file.$$"
install -d -m 0700 "$status_dir"
archive_bytes=$(stat -c '%s' "$archive")
archive_sha256=$(cut -d ' ' -f 1 "$archive.sha256")
jq -n \
  --arg checkedAt "$(date --iso-8601=seconds)" \
  --arg archive "$(basename "$archive")" \
  --arg sha256 "$archive_sha256" \
  --argjson bytes "$archive_bytes" \
  '{checkedAt: $checkedAt, result: "success", archive: $archive, archiveBytes: $bytes, archiveSha256: $sha256, offsite: true}' \
  > "$status_tmp"
chmod 0600 "$status_tmp"
mv "$status_tmp" "$status_file"
printf 'PASS restic Netcup backup: %s\n' "$archive"
