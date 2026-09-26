#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
: "${RESTIC_REPOSITORY:?Configure the off-host repository}"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
restic check --read-data
restic restore latest --tag modulo-oci --host "${RESTIC_BACKUP_HOST:-$(hostname)}" --target "$work"
mapfile -t dumps < <(find "$work" -type f -name postgres.sql.gz)
((${#dumps[@]} == 1)) || { echo 'Expected exactly one PostgreSQL dump in the snapshot' >&2; exit 1; }
./restore-drill.sh "$(dirname "${dumps[0]}")"
