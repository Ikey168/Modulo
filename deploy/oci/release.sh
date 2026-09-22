#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy a release whose source revision and application images are immutable.
# The normal compose workflow remains available for local development; this
# path never invokes a build on the production host.

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

manifest_path=${MANIFEST_PATH:-deployment-manifest.json}
compose=(docker compose -f compose.yml)
readonly services=(backend frontend noesis praxis)
readonly runtime_services=(db neo4j keycloak backend frontend noesis praxis caddy)

usage() {
  cat >&2 <<'EOF'
Usage:
  release.sh --check <source-sha> <backend@sha256:...> <frontend@sha256:...> <noesis@sha256:...> <praxis@sha256:...>
  release.sh        <source-sha> <backend@sha256:...> <frontend@sha256:...> <noesis@sha256:...> <praxis@sha256:...>

--check validates the release inputs and rendered compose configuration without
pulling images or changing containers. A live release pulls the four pinned
application images and starts the stack with --no-build.
EOF
}

die() {
  echo "release.sh: $*" >&2
  exit 1
}

[[ ${1:-} == --help ]] && { usage; exit 0; }
check_only=false
if [[ ${1:-} == --check ]]; then
  check_only=true
  shift
fi
[[ $# -eq 5 ]] || { usage; exit 2; }

source_revision=$1
backend_image=$2
frontend_image=$3
noesis_image=$4
praxis_image=$5

[[ $source_revision =~ ^[0-9a-fA-F]{40}$ ]] || die "source revision must be a full 40-character Git SHA"

validate_image() {
  local image=$1 digest reference
  [[ $image == *@sha256:* ]] || die "image must be pinned by digest: $image"
  digest=${image##*@sha256:}
  reference=${image%@sha256:*}
  [[ -n $reference && $digest =~ ^[0-9a-f]{64}$ ]] || die "invalid digest-pinned image: $image"
  [[ $image != *[[:space:]\"\']* ]] || die "image contains whitespace or quotes: $image"
}

for image in "$backend_image" "$frontend_image" "$noesis_image" "$praxis_image"; do
  validate_image "$image"
done

command -v docker >/dev/null 2>&1 || die "docker is required"
docker compose version >/dev/null 2>&1 || die "docker compose is required"

# Shell variables intentionally override only the non-secret release inputs;
# Compose continues to read credentials from deploy/oci/.env.
export MODULO_RELEASE_SOURCE_REVISION=$source_revision
export MODULO_BACKEND_IMAGE=$backend_image
export MODULO_FRONTEND_IMAGE=$frontend_image
export NOESIS_IMAGE=$noesis_image
export PRAXIS_IMAGE=$praxis_image

"${compose[@]}" config --quiet || die "compose configuration is invalid"

if $check_only; then
  printf 'Release inputs valid for source %s\n' "$source_revision"
  printf '  backend:  %s\n' "$backend_image"
  printf '  frontend: %s\n' "$frontend_image"
  printf '  noesis:   %s\n' "$noesis_image"
  printf '  praxis:   %s\n' "$praxis_image"
  exit 0
fi

"${compose[@]}" pull "${services[@]}"
"${compose[@]}" up -d --no-build --remove-orphans

wait_for_runtime() {
  local service container running health
  for service in "${runtime_services[@]}"; do
    container=$("${compose[@]}" ps -q "$service")
    [[ -n $container ]] || die "service has no container: $service"
    for _ in {1..60}; do
      running=$(docker inspect --format '{{.State.Running}}' "$container")
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")
      if [[ $running == true && ( $health == healthy || $health == none ) ]]; then
        break
      fi
      sleep 5
    done
    running=$(docker inspect --format '{{.State.Running}}' "$container")
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")
    [[ $running == true ]] || die "service is not running: $service"
    [[ $health == healthy || $health == none ]] || die "service is not healthy: $service ($health)"
  done
}

verify_release_identity() {
  local service container image_id container_image label
  for service in "${services[@]}"; do
    container=$("${compose[@]}" ps -q "$service")
    label=$(docker inspect --format '{{index .Config.Labels "com.modulo.source-revision"}}' "$container")
    [[ $label == "$source_revision" ]] || die "source label mismatch for $service: $label"
    case $service in
      backend) image=$backend_image ;;
      frontend) image=$frontend_image ;;
      noesis) image=$noesis_image ;;
      praxis) image=$praxis_image ;;
    esac
    image_id=$(docker image inspect "$image" --format '{{.Id}}')
    container_image=$(docker inspect --format '{{.Image}}' "$container")
    [[ $image_id == "$container_image" ]] || die "image mismatch for $service"
  done
}

wait_for_runtime
verify_release_identity

tmp_manifest=$(mktemp "${manifest_path}.tmp.XXXXXX")
trap 'rm -f -- "$tmp_manifest"' EXIT
jq -n \
  --arg source "$source_revision" \
  --arg deployed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg backend "$backend_image" \
  --arg frontend "$frontend_image" \
  --arg noesis "$noesis_image" \
  --arg praxis "$praxis_image" \
  '{format:"modulo.oracle.release.v1", sourceRevision:$source, deployedAt:$deployed_at, images:{backend:$backend, frontend:$frontend, noesis:$noesis, praxis:$praxis}}' \
  > "$tmp_manifest"
chmod 0644 "$tmp_manifest"
mv -f -- "$tmp_manifest" "$manifest_path"
trap - EXIT

printf 'Immutable Oracle release deployed and verified: %s\n' "$source_revision"
printf 'Manifest: %s\n' "$manifest_path"
