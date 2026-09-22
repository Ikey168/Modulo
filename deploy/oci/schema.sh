#!/usr/bin/env bash
set -Eeuo pipefail

# Static deployment contract checks. This command is intentionally read-only.

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"
compose=(docker compose -f compose.yml)

command -v docker >/dev/null 2>&1 || { echo 'docker is required' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo 'docker compose is required' >&2; exit 1; }
# CI checks out no secret-bearing .env. Shell variables override Compose's
# optional local .env and provide harmless placeholders for interpolation.
export MODULO_SITE="${MODULO_SITE:-modulo.example.invalid}"
export MODULO_URL="${MODULO_URL:-https://modulo.example.invalid}"
export NOESIS_SITE="${NOESIS_SITE:-noesis.example.invalid}"
export PRAXIS_SITE="${PRAXIS_SITE:-praxis.example.invalid}"
export NOESIS_CONTEXT="${NOESIS_CONTEXT:-/tmp/noesis}"
export PRAXIS_CONTEXT="${PRAXIS_CONTEXT:-/tmp/praxis}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-schema-only}"
export KEYCLOAK_DB_PASSWORD="${KEYCLOAK_DB_PASSWORD:-schema-only}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-schema-only}"
export KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-schema-only}"
export KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-schema-only}"
export MODULO_SECURITY_JWT_SECRET="${MODULO_SECURITY_JWT_SECRET:-schema-only}"
export MODULO_SECURITY_API_KEY="${MODULO_SECURITY_API_KEY:-schema-only}"
export MODULO_SECURITY_ENCRYPTION_KEY="${MODULO_SECURITY_ENCRYPTION_KEY:-schema-only}"
export NOESIS_JWT_SECRET="${NOESIS_JWT_SECRET:-schema-only}"
export NOESIS_API_KEY_SALT="${NOESIS_API_KEY_SALT:-schema-only}"
export PRAXIS_API_TOKEN="${PRAXIS_API_TOKEN:-schema-only}"
"${compose[@]}" config --quiet

services=$("${compose[@]}" config --services)
for required in caddy frontend backend keycloak db neo4j noesis praxis; do
  grep -qx "$required" <<<"$services" || {
    echo "missing compose service: $required" >&2
    exit 1
  }
done

grep -q 'noesis_data:/data' compose.yml
grep -q 'noesis_models:/models-cache' compose.yml
grep -q 'com.modulo.source-revision' compose.yml
grep -q 'sha256' release.sh
grep -q 'release.sh' rollback.sh
grep -q 'OFFSITE_COMPLETE' backup.sh
python3 "$script_dir/../../scripts/verify-noesis-lifecycle.py"
python3 "$script_dir/../../scripts/verify-personal-infra.py"
python3 "$script_dir/../../scripts/verify-repository-contract.py"
python3 "$script_dir/../../scripts/verify-device-inventory.py"
python3 "$script_dir/../../scripts/verify-data-inventory.py"
printf 'Oracle deployment schema verified\n'
