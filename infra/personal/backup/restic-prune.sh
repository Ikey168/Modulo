#!/bin/sh
set -eu

[ "${NETCUP_BACKUP_ALLOW_PRUNE:-}" = yes ] || {
  printf 'refusing remote prune; set NETCUP_BACKUP_ALLOW_PRUNE=yes after review\n' >&2
  exit 2
}
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY must be set in the protected environment}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE must point to a protected file}"
[ -r "$RESTIC_PASSWORD_FILE" ] || { printf 'restic password file is not readable\n' >&2; exit 2; }
[ "$(stat -c '%a' "$RESTIC_PASSWORD_FILE")" = 600 ] || { printf 'restic password file must be mode 0600\n' >&2; exit 2; }
command -v restic >/dev/null 2>&1 || { printf 'restic is required\n' >&2; exit 2; }
restic forget --tag netcup-development --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune
