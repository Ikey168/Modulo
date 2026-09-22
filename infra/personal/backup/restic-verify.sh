#!/bin/sh
set -eu

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set in the protected environment}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must point to a protected file}"
[ -r "$RESTIC_PASSWORD_FILE" ] || { printf 'restic password file is not readable\n' >&2; exit 2; }
[ "$(stat -c '%a' "$RESTIC_PASSWORD_FILE")" = 600 ] || { printf 'restic password file must be mode 0600\n' >&2; exit 2; }
command -v restic >/dev/null 2>&1 || { printf 'restic is required\n' >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { printf 'jq is required\n' >&2; exit 2; }
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
restore_dir=$(mktemp -d /tmp/netcup-restic-restore.XXXXXX)
trap 'rm -rf "$restore_dir"' EXIT HUP INT TERM
restic check --read-data-subset="${RESTIC_VERIFY_SUBSET:-1/20}"
snapshot=$(restic snapshots --json | jq -r '[.[] | select((.tags // []) | index("netcup-development"))] | sort_by(.time) | last | .id // empty')
[ -n "$snapshot" ] || { printf 'no tagged Netcup snapshot found\n' >&2; exit 1; }
restic restore "$snapshot" --target "$restore_dir"
archive=$(find "$restore_dir" -type f -name 'netcup-dev-state-*.tar.gz' -print -quit)
[ -n "$archive" ] || { printf 'restored Netcup archive not found\n' >&2; exit 1; }
"$script_dir/../scripts/verify-netcup-backup.sh" "$archive"
status_dir=${NETCUP_BACKUP_STATUS_DIR:-/var/lib/netcup-backup}
status_file="$status_dir/last-verify.json"
status_tmp="$status_file.$$"
install -d -m 0700 "$status_dir"
jq -n \
  --arg checkedAt "$(date --iso-8601=seconds)" \
  --arg snapshot "$snapshot" \
  '{checkedAt: $checkedAt, result: "success", snapshot: $snapshot, isolatedRestore: true}' \
  > "$status_tmp"
chmod 0600 "$status_tmp"
mv "$status_tmp" "$status_file"
printf 'PASS restic repository and isolated restore: %s\n' "$snapshot"
