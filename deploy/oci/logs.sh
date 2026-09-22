#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

usage() {
  cat >&2 <<'EOF'
Usage: logs.sh [--tail LINES] SERVICE

Retrieve a bounded, non-streaming diagnostic log excerpt for one Modulo OCI
service. LINES defaults to 100 and must be between 1 and 500.
EOF
}

tail_lines=100
if [ "${1:-}" = "--tail" ]; then
  [ "$#" -ge 2 ] || { usage; exit 2; }
  tail_lines=$2
  shift 2
fi

[ "$#" -eq 1 ] || { usage; exit 2; }
service=$1

case "$tail_lines" in
  ''|*[!0-9]*)
    printf '%s\n' 'logs.sh: LINES must be an integer between 1 and 500' >&2
    exit 2
    ;;
esac
[ "$tail_lines" -ge 1 ] && [ "$tail_lines" -le 500 ] || {
  printf '%s\n' 'logs.sh: LINES must be between 1 and 500' >&2
  exit 2
}

case "$service" in
  db|neo4j|keycloak|backend|frontend|noesis|praxis|caddy) ;;
  *)
    printf 'logs.sh: unsupported service: %s\n' "$service" >&2
    exit 2
    ;;
esac

container=$(docker compose -f compose.yml ps -q "$service")
[ -n "$container" ] || {
  printf 'logs.sh: service is not deployed: %s\n' "$service" >&2
  exit 1
}

exec docker compose -f compose.yml logs --no-color --tail="$tail_lines" "$service"
