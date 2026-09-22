#!/usr/bin/env bash
set -Eeuo pipefail

# Reapply a previously verified, digest-pinned release manifest. The release
# command performs all validation, deployment, health and identity checks.

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
usage() {
  cat >&2 <<'EOF'
Usage: rollback.sh [--check] <release-manifest.json>

The manifest must be produced by release.sh and contain a full sourceRevision
plus digest-pinned backend, frontend, noesis and praxis image references.
EOF
}

[[ $# -ge 1 && $# -le 2 ]] || { usage; exit 2; }
check_flag=
manifest_arg=$1
if [[ $1 == --check ]]; then
  [[ $# -eq 2 ]] || { usage; exit 2; }
  check_flag=--check
  manifest_arg=$2
fi
manifest=$(realpath -e -- "$manifest_arg") || { echo "manifest not found: $manifest_arg" >&2; exit 1; }

source_revision=$(jq -er '.sourceRevision' "$manifest")
backend_image=$(jq -er '.images.backend' "$manifest")
frontend_image=$(jq -er '.images.frontend' "$manifest")
noesis_image=$(jq -er '.images.noesis' "$manifest")
praxis_image=$(jq -er '.images.praxis' "$manifest")

if [[ -n $check_flag ]]; then
  exec "$script_dir/release.sh" "$check_flag" "$source_revision" "$backend_image" "$frontend_image" "$noesis_image" "$praxis_image"
fi
exec "$script_dir/release.sh" "$source_revision" "$backend_image" "$frontend_image" "$noesis_image" "$praxis_image"
