#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  manifest.sh [--check] <output> <source-sha> <backend@sha256:...> <frontend@sha256:...> <noesis@sha256:...> <praxis@sha256:...> [<noesis-source-sha> <praxis-source-sha>]

--check validates the source and image references without writing a manifest.
EOF
}

die() {
  echo "manifest.sh: $*" >&2
  exit 1
}

check_only=false
if [[ ${1:-} == --check ]]; then
  check_only=true
  shift
fi
[[ $# -eq 6 || $# -eq 8 ]] || { usage; exit 2; }

manifest_path=$1
source_revision=$2
backend_image=$3
frontend_image=$4
noesis_image=$5
praxis_image=$6
noesis_source_revision=${7:-}
praxis_source_revision=${8:-}

[[ $manifest_path != -* ]] || die "output path must not begin with '-'"
[[ $source_revision =~ ^[0-9a-fA-F]{40}$ ]] || die "source revision must be a full 40-character Git SHA"
if [[ -n $noesis_source_revision || -n $praxis_source_revision ]]; then
  [[ -n $noesis_source_revision && -n $praxis_source_revision ]] || die "both external source revisions are required"
  [[ $noesis_source_revision =~ ^[0-9a-fA-F]{40}$ ]] || die "Noesis source revision must be a full 40-character Git SHA"
  [[ $praxis_source_revision =~ ^[0-9a-fA-F]{40}$ ]] || die "Praxis source revision must be a full 40-character Git SHA"
fi

validate_image() {
  local image=$1
  local digest=${image##*@sha256:}
  local reference=${image%@sha256:*}
  [[ $image == *@sha256:* ]] || die "image must be pinned by digest: $image"
  [[ -n $reference && $digest =~ ^[0-9a-f]{64}$ ]] || die "invalid digest-pinned image: $image"
  [[ $image != *[[:space:]]* ]] || die "image contains whitespace: $image"
}

for image in "$backend_image" "$frontend_image" "$noesis_image" "$praxis_image"; do
  validate_image "$image"
done

$check_only && {
  printf 'Release manifest inputs valid for source %s\n' "$source_revision"
  exit 0
}

command -v jq >/dev/null 2>&1 || die "jq is required"
mkdir -p -- "$(dirname -- "$manifest_path")"
tmp_manifest=$(mktemp "${manifest_path}.tmp.XXXXXX")
trap 'rm -f -- "$tmp_manifest"' EXIT
jq_args=(
  --arg source "$source_revision"
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  --arg backend "$backend_image"
  --arg frontend "$frontend_image"
  --arg noesis "$noesis_image"
  --arg praxis "$praxis_image"
)
if [[ -n $noesis_source_revision ]]; then
  jq_args+=(
    --arg noesis_source "$noesis_source_revision"
    --arg praxis_source "$praxis_source_revision"
  )
  jq -n "${jq_args[@]}" \
    '{format:"modulo.oracle.release.v1", sourceRevision:$source, generatedAt:$generated_at, images:{backend:$backend, frontend:$frontend, noesis:$noesis, praxis:$praxis}, sources:{modulo:$source, noesis:$noesis_source, praxis:$praxis_source}}' \
    > "$tmp_manifest"
else
  jq -n "${jq_args[@]}" \
    '{format:"modulo.oracle.release.v1", sourceRevision:$source, generatedAt:$generated_at, images:{backend:$backend, frontend:$frontend, noesis:$noesis, praxis:$praxis}}' \
    > "$tmp_manifest"
fi
chmod 0644 "$tmp_manifest"
mv -f -- "$tmp_manifest" "$manifest_path"
trap - EXIT
printf 'Release manifest written: %s\n' "$manifest_path"
