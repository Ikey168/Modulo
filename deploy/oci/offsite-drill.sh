#!/usr/bin/env bash
set -Eeuo pipefail

# Verify that the configured remote restic repository is reachable and, when
# requested, restore the newest Modulo snapshot into a temporary directory.

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

usage() {
  cat >&2 <<'EOF'
Usage: offsite-drill.sh [--check] [--restore <target-directory>]

The default is a read-only repository/configuration check. --restore downloads
the newest modulo-oci snapshot to a caller-selected empty directory and runs
the local restore drill in archive-only mode.
EOF
}

die() {
  echo "offsite-drill.sh: $*" >&2
  exit 1
}

check_only=true
restore_target=
while [[ $# -gt 0 ]]; do
  case $1 in
    --check) check_only=true; shift ;;
    --restore)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      check_only=false
      restore_target=$2
      shift 2
      ;;
    --help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY to an off-host restic repository.}"
[[ $RESTIC_REPOSITORY =~ ^(s3:|sftp:|rest:|azure:|gs:|b2:) ]] || die "RESTIC_REPOSITORY is not an off-host restic URL"
command -v restic >/dev/null 2>&1 || die "restic is required"
restic cat config >/dev/null
latest=$(restic snapshots --json --tag modulo-oci | jq -r 'map(.time) | max // empty')
[[ -n $latest ]] || die "no modulo-oci snapshot exists in the off-host repository"
printf 'Off-host repository reachable; newest modulo-oci snapshot: %s\n' "$latest"

$check_only && exit 0
[[ -n $restore_target ]] || die "restore target is required"
[[ ! -e $restore_target ]] || die "restore target must not already exist: $restore_target"
mkdir -p -- "$restore_target"
restic restore latest --tag modulo-oci --target "$restore_target"
snapshot=$(find "$restore_target" -type f -name COMPLETE -printf '%h\n' | sort | tail -n 1)
[[ -n $snapshot ]] || die "restic restore did not contain a complete snapshot"
RESTORE_DRILL_REPORT="$restore_target/restore-drill-report.json" \
  "$script_dir/restore-drill.sh" "$snapshot" --skip-postgres
printf 'Off-host restore drill passed: %s\n' "$snapshot"
