#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
: "${MODULO_URL:?Export MODULO_URL}"
: "${MODULO_SMOKE_TOKEN_FILE:?Export a short-lived verification token file}"
state=${MODULO_RELEASE_STATE:-.releases}
mkdir -p "$state"
exec 9>"$state/lock"
flock -n 9 || { echo 'Another release is running' >&2; exit 1; }
mode=${1:-}
[[ $mode == deploy || $mode == rollback ]] || { echo 'Usage: release.sh deploy FRONTEND@sha256:DIGEST BACKEND@sha256:DIGEST | rollback' >&2; exit 2; }
if [[ $mode == rollback ]]; then
  [[ -f $state/previous ]] || { echo 'No previous verified release' >&2; exit 1; }
  mapfile -t images < "$state/previous"
else
  [[ $# == 3 ]] || exit 2
  images=("$2" "$3")
fi
for image in "${images[@]}"; do
  [[ $image =~ ^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$ ]] || { echo 'Images must use immutable sha256 digests' >&2; exit 1; }
done
((${#images[@]} == 2)) || exit 1
export MODULO_FRONTEND_IMAGE=${images[0]} MODULO_BACKEND_IMAGE=${images[1]}
compose=(docker compose -f compose.yml -f compose.release.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull frontend backend
if [[ $mode == deploy ]]; then
  result_file=$(mktemp)
  trap 'rm -f -- "$result_file"' EXIT
  BACKUP_RESULT_FILE="$result_file" ./backup.sh
  snapshot=$(cat "$result_file")
  MODULO_MIGRATION_IMAGE="$MODULO_BACKEND_IMAGE" ./restore-drill.sh "$snapshot"
fi
# This intentionally updates only app containers. Provision backing services first.
if ! "${compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 240 frontend backend || ! python3 verify-deployment.py; then
  echo 'Release failed verification; attempting previous verified application images.' >&2
  if [[ -f $state/current ]]; then
    mapfile -t previous < "$state/current"
    export MODULO_FRONTEND_IMAGE=${previous[0]} MODULO_BACKEND_IMAGE=${previous[1]}
    "${compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 240 frontend backend
    python3 verify-deployment.py
  fi
  exit 1
fi
[[ ! -f $state/current ]] || cp "$state/current" "$state/previous"
printf '%s\n' "${images[@]}" > "$state/current.new"
mv "$state/current.new" "$state/current"
echo 'Verified release recorded.'
