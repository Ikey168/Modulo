#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

strict=false
if [ "${1:-}" = "--strict" ]; then
	strict=true
	elif [ "$#" -gt 0 ]; then
	printf '%s\n' 'usage: status.sh [--strict]' >&2
	exit 2
fi

# Compose reads deploy/oci/.env automatically. Keep this status helper usable
# from a shell or systemd without requiring the secret-bearing environment file
# to be sourced into the caller.
modulo_url=${MODULO_URL:-}
if [ -z "$modulo_url" ] && [ -f .env ]; then
  modulo_url=$(sed -n 's/^MODULO_URL=//p' .env | head -n 1)
fi

docker compose -f compose.yml ps
printf '\nModulo API health:\n'
if [ -n "$modulo_url" ]; then
  if $strict; then
    curl -fsS --max-time 10 "$modulo_url/api/health"
  else
    curl -fsS --max-time 10 "$modulo_url/api/health" || true
  fi
else
  printf '%s\n' 'MODULO_URL is not configured; skipping public health probe.'
fi
printf '\n\nNoesis (localhost only):\n'
if $strict; then
  curl -fsS --max-time 10 http://127.0.0.1:8012/health
else
  curl -fsS --max-time 10 http://127.0.0.1:8012/health || true
fi
printf '\n'

if $strict; then
  for service in db neo4j keycloak backend frontend noesis praxis caddy; do
    container=$(docker compose -f compose.yml ps -q "$service")
    [ -n "$container" ] || { printf 'missing container: %s\n' "$service" >&2; exit 1; }
    state=$(docker inspect --format '{{.State.Status}}' "$container")
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")
    [ "$state" = running ] || { printf 'service is not running: %s\n' "$service" >&2; exit 1; }
    case "$health" in
      healthy|none) ;;
      *) printf 'service is not healthy: %s (%s)\n' "$service" "$health" >&2; exit 1 ;;
    esac
  done

  [ -f deployment-manifest.json ] || {
    printf '%s\n' 'strict status requires deployment-manifest.json from release.sh' >&2
    exit 1
  }
  manifest_revision=$(jq -er '.sourceRevision' deployment-manifest.json)
  [ "$manifest_revision" != unmanaged ] || {
    printf '%s\n' 'strict status rejects an unmanaged release' >&2
    exit 1
  }
  for service in backend frontend noesis praxis; do
    container=$(docker compose -f compose.yml ps -q "$service")
    label=$(docker inspect --format '{{index .Config.Labels "com.modulo.source-revision"}}' "$container")
    [ "$label" = "$manifest_revision" ] || {
      printf 'source revision mismatch: %s\n' "$service" >&2
      exit 1
    }
    expected=$(jq -er ".images.$service" deployment-manifest.json)
    expected_id=$(docker image inspect "$expected" --format '{{.Id}}')
    running_id=$(docker inspect --format '{{.Image}}' "$container")
    [ "$expected_id" = "$running_id" ] || {
      printf 'image digest mismatch: %s\n' "$service" >&2
      exit 1
    }
  done
  printf '%s\n' 'Strict release identity: verified'
fi
