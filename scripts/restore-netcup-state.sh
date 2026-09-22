#!/bin/sh
# Restore a previously boundary-verified Netcup state archive into isolation.
set -eu

archive=${1:-}
destination=${2:-}
[ -r "$archive" ] && [ -n "$destination" ] || {
  printf 'Usage: %s ARCHIVE.tar.gz EMPTY_DESTINATION\n' "$0" >&2
  exit 2
}
case "$destination" in
  /tmp/netcup-restore-*|/var/tmp/netcup-restore-*) ;;
  *)
    [ "${NETCUP_RESTORE_ALLOW_DESTINATION:-}" = yes ] || {
      printf 'restore destination must be an isolated /tmp/netcup-restore-* path\n' >&2
      exit 2
    }
    ;;
esac
[ ! -e "$destination" ] || {
  printf 'restore destination must not already exist: %s\n' "$destination" >&2
  exit 1
}

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$script_dir/../infra/personal/scripts/verify-netcup-backup.sh" "$archive"
mkdir -p "$destination"
tar -xzf "$archive" -C "$destination" --no-same-owner --no-same-permissions
[ -d "$destination/home/ik/ChatGPT/Modulo" ] || { printf 'Modulo root missing after restore\n' >&2; exit 1; }
[ -d "$destination/home/ik/ChatGPT/Noesis" ] || { printf 'Noesis root missing after restore\n' >&2; exit 1; }
printf 'PASS isolated Netcup restore: %s\n' "$destination"
