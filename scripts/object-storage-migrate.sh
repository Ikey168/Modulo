#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: object-storage-migrate.sh [--apply] [--config PATH] SOURCE DESTINATION

Copies one object prefix to another without deleting either side. The default
is a dry run. SOURCE and DESTINATION are rclone paths such as
old-s3:bucket/prefix and r2:bucket/prefix.

--apply        Perform the copy, then verify every source object by downloading
               and hashing both sides. This can incur provider read charges.
--config PATH  Use an explicit rclone configuration file.

The script deliberately never calls `rclone sync`, delete or purge. Freeze the
writer before final cutover and retain the source for the policy-defined
rollback period.
EOF
}

apply=false
config_args=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --apply)
      apply=true
      shift
      ;;
    --config)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      config_args=(--config "$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      usage
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

[[ $# -eq 2 ]] || { usage; exit 2; }
source_remote=$1
destination_remote=$2

[[ $source_remote == *:* && $destination_remote == *:* ]] || {
  echo "Both endpoints must be explicit rclone remote paths." >&2
  exit 2
}
[[ $source_remote != "$destination_remote" ]] || {
  echo "Source and destination must differ." >&2
  exit 2
}
[[ $source_remote != *$'\n'* && $destination_remote != *$'\n'* ]] || {
  echo "Endpoint contains a newline." >&2
  exit 2
}

command -v rclone >/dev/null 2>&1 || {
  echo "rclone is required." >&2
  exit 1
}

common=(
  "${config_args[@]}"
  --check-first
  --fast-list
  --metadata
  --log-level INFO
  --stats 30s
)

printf 'Object-storage migration mode: %s\n' "$([[ $apply == true ]] && echo apply || echo dry-run)"
printf 'Source: %s\nDestination: %s\n' "$source_remote" "$destination_remote"
rclone version | sed -n '1,2p'

printf '%s\n' 'Source inventory:'
rclone size "${config_args[@]}" --json "$source_remote"

if [[ $apply == false ]]; then
  rclone copy "${common[@]}" --dry-run "$source_remote" "$destination_remote"
  printf '%s\n' 'Dry run complete; no objects were copied or deleted.'
  exit 0
fi

rclone copy "${common[@]}" "$source_remote" "$destination_remote"

# Cross-provider multipart ETags and checksum support vary. Download verification
# is slower and may be billable, but it verifies content instead of trusting
# provider-specific metadata.
rclone check "${config_args[@]}" \
  --download \
  --one-way \
  --combined - \
  "$source_remote" \
  "$destination_remote"

printf '%s\n' 'Migration copy and content verification passed.'
printf '%s\n' 'No source or destination objects were deleted.'
