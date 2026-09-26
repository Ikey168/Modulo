#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
action=${1:-}
[[ $action == adopt || $action == migrate || $action == validate ]] || { echo 'Usage: schema.sh adopt|migrate|validate' >&2; exit 2; }
# Uses the configured backend database credentials without exposing them on the CLI.
# For a release image, export both image digests before calling this script.
compose=(docker compose -f compose.yml)
if [[ -n ${MODULO_BACKEND_IMAGE:-} ]]; then compose+=(-f compose.release.yml); fi
"${compose[@]}" run --rm --no-deps --entrypoint java backend \
  -Dloader.main=com.modulo.migration.SchemaMigrationTool \
  -cp /home/springuser/app/app.jar org.springframework.boot.loader.PropertiesLauncher "$action"
