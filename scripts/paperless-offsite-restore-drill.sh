#!/usr/bin/env bash

# Verify the Paperless off-site Restic repository and perform an isolated,
# disposable application restore. No recovered service is exposed to the host
# network, and all temporary data is removed when the drill exits.

set -Eeuo pipefail

readonly DEFAULT_RECOVERY_DIR='/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.01 2FA & Recovery Codes (scans, PDFs)/Paperless'
readonly POSTGRES_IMAGE='docker.io/library/postgres@sha256:71e27bf60b70bded003791b5573f8b808365613f341df20ffcf0c1ed7bc13ddf'
readonly REDIS_IMAGE='docker.io/library/redis@sha256:3e0669e42d4fe421c9dea0ba5fbc04d336b80b4f32a6c7d25bee3a1d089288a1'
readonly PAPERLESS_IMAGE='ghcr.io/paperless-ngx/paperless-ngx@sha256:6c86cad803970ea782683a8e80e7403444c5bf3cf70de63b4d3c8e87500db92f'

usage() {
  cat <<'EOF'
Usage: paperless-offsite-restore-drill.sh [--recovery-dir DIR] [--known-hosts FILE]

The recovery directory must contain:
  Paperless-backup-recovery.txt
  Paperless-offsite-ed25519

Environment overrides:
  PAPERLESS_RECOVERY_DIR  Recovery bundle directory
  PAPERLESS_KNOWN_HOSTS   SSH known_hosts file
EOF
}

recovery_dir="${PAPERLESS_RECOVERY_DIR:-$DEFAULT_RECOVERY_DIR}"
known_hosts_file="${PAPERLESS_KNOWN_HOSTS:-$HOME/.ssh/known_hosts}"

while (($#)); do
  case "$1" in
    --recovery-dir)
      [[ $# -ge 2 ]] || { printf 'Missing value for --recovery-dir\n' >&2; exit 2; }
      recovery_dir="$2"
      shift 2
      ;;
    --known-hosts)
      [[ $# -ge 2 ]] || { printf 'Missing value for --known-hosts\n' >&2; exit 2; }
      known_hosts_file="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for required_command in docker restic ssh sha256sum; do
  command -v "$required_command" >/dev/null || {
    printf 'Required command not found: %s\n' "$required_command" >&2
    exit 1
  }
done

readonly recovery_file="$recovery_dir/Paperless-backup-recovery.txt"
readonly key_source="$recovery_dir/Paperless-offsite-ed25519"
[[ -r "$recovery_file" ]] || { printf 'Recovery instructions are not readable\n' >&2; exit 1; }
[[ -r "$key_source" ]] || { printf 'Off-site SSH key is not readable\n' >&2; exit 1; }
[[ -r "$known_hosts_file" ]] || { printf 'SSH known_hosts file is not readable\n' >&2; exit 1; }

phase='initialization'
temp_root="$(mktemp -d /tmp/records-dr-clean.XXXXXX)"
suffix="$(basename "$temp_root" | tr -cd '[:alnum:]')"
network_name="records-dr-net-${suffix}"
db_container="records-dr-db-${suffix}"
broker_container="records-dr-redis-${suffix}"
web_container="records-dr-web-${suffix}"
key_link="$temp_root/offsite-key"
restore_dir="$temp_root/restored"
drill_started="$(date +%s)"

cleanup() {
  local exit_code=$?
  trap - EXIT
  docker rm -f "$web_container" "$broker_container" "$db_container" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
  unset RESTIC_PASSWORD POSTGRES_PASSWORD PAPERLESS_DBPASS PAPERLESS_SECRET_KEY

  if [[ "$temp_root" == /tmp/records-dr-clean.* && -d "$temp_root" ]]; then
    docker run --rm -v "$temp_root:/cleanup" --entrypoint /bin/sh "$POSTGRES_IMAGE" \
      -c 'find /cleanup -mindepth 1 -delete' >/dev/null 2>&1 || true
    find "$temp_root" -mindepth 1 -delete >/dev/null 2>&1 || true
    rmdir "$temp_root" >/dev/null 2>&1 || true
  fi

  if ((exit_code != 0)); then
    printf 'DRILL_RESULT=failed\nFAILED_PHASE=%s\n' "$phase" >&2
  fi
  exit "$exit_code"
}
trap cleanup EXIT
trap 'printf "FAILED_LINE=%s\n" "$LINENO" >&2' ERR

read_recovery_value() {
  local label="$1"
  sed -n "s/^${label}: //p" "$recovery_file" | tail -n 1 | tr -d '\r'
}

read_env_value() {
  local variable_name="$1"
  sed -n "s/^${variable_name}=//p" "$env_file" \
    | tail -n 1 \
    | tr -d '\r' \
    | sed -e 's/^"//' -e 's/"$//'
}

run_restic() {
  restic -o "sftp.command=ssh -i $key_link -o IdentitiesOnly=yes -o UserKnownHostsFile=$known_hosts_file -o StrictHostKeyChecking=yes paperless-backup@141.147.5.114 -s sftp" "$@"
}

run_restic_with_retry() {
  local attempt
  for attempt in 1 2 3; do
    if run_restic "$@"; then
      return 0
    fi
    printf 'Restic attempt %s failed; retrying\n' "$attempt" >&2
  done
  return 1
}

printf 'PHASE=repository_verification\n'
phase='repository_verification'
ln -s "$key_source" "$key_link"
export RESTIC_REPOSITORY="$(read_recovery_value 'Off-site restic repository')"
export RESTIC_PASSWORD="$(read_recovery_value 'Off-site restic password')"
[[ "$RESTIC_REPOSITORY" == sftp:* ]] || { printf 'Unexpected repository type\n' >&2; exit 1; }
[[ -n "$RESTIC_PASSWORD" ]] || { printf 'Off-site repository password is empty\n' >&2; exit 1; }

snapshot_id="$(run_restic_with_retry snapshots --latest 1 --json | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["short_id"])')"
run_restic_with_retry check --read-data
printf 'SNAPSHOT_ID=%s\n' "$snapshot_id"
printf 'RESTIC_CHECK=ok\n'

printf 'PHASE=offsite_restore\n'
phase='offsite_restore'
mkdir "$restore_dir"
run_restic_with_retry restore latest --target "$restore_dir"

manifest_file="$(find "$restore_dir" -type f -name manifest.json -print -quit)"
dump_file="$(find "$restore_dir" -type f -name postgresql.dump -print -quit)"
env_file="$(find "$restore_dir" -type f -name paperless.env -print -quit)"
checksum_file="$(find "$restore_dir" -type f -name SHA256SUMS -print -quit)"
[[ -n "$manifest_file" && -n "$dump_file" && -n "$env_file" && -n "$checksum_file" ]] || {
  printf 'Restored backup is missing a required artifact\n' >&2
  exit 1
}

checksum_count="$(wc -l <"$checksum_file" | tr -d ' ')"
(cd "$(dirname "$checksum_file")" && sha256sum --quiet -c "$(basename "$checksum_file")")
export_dir="$(dirname "$manifest_file")"
restored_file_count="$(find "$restore_dir" -type f | wc -l | tr -d ' ')"
printf 'OFFSITE_RESTORE=ok\n'
printf 'RESTORED_FILES=%s\n' "$restored_file_count"
printf 'CHECKSUMS_VERIFIED=%s\n' "$checksum_count"

postgres_user="$(read_env_value POSTGRES_USER)"
postgres_user="${postgres_user:-paperless}"
postgres_source_db="$(read_env_value POSTGRES_DB)"
postgres_source_db="${postgres_source_db:-paperless}"
export POSTGRES_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
[[ -n "$POSTGRES_PASSWORD" ]] || { printf 'Database password is empty\n' >&2; exit 1; }
export PAPERLESS_DBPASS="$POSTGRES_PASSWORD"
export PAPERLESS_SECRET_KEY="$(read_env_value PAPERLESS_SECRET_KEY)"
PAPERLESS_SECRET_KEY="${PAPERLESS_SECRET_KEY:-records-dr-isolated-temporary-key}"

printf 'PHASE=isolated_runtime\n'
phase='isolated_runtime'
docker network create --internal "$network_name" >/dev/null
printf 'ISOLATED_DOCKER_NETWORK=created\n'
docker run -d --name "$db_container" --network "$network_name" --network-alias db \
  -e POSTGRES_USER="$postgres_user" \
  -e POSTGRES_PASSWORD \
  -e POSTGRES_DB="$postgres_source_db" \
  -v "$dump_file:/restore/postgresql.dump:ro" \
  "$POSTGRES_IMAGE" >/dev/null
printf 'DATABASE_CONTAINER=started\n'

database_ready=0
for _ in $(seq 1 120); do
  if docker logs "$db_container" 2>&1 | grep -q 'PostgreSQL init process complete' \
    && docker exec "$db_container" pg_isready -U "$postgres_user" -d "$postgres_source_db" >/dev/null 2>&1; then
    database_ready=1
    break
  fi
  docker inspect -f '{{.State.Running}}' "$db_container" 2>/dev/null | grep -qx true || {
    printf 'Database container exited during startup\n' >&2
    docker logs "$db_container" 2>&1 | sed -E '/(password|secret|token|key)/Id' | tail -30 >&2
    exit 1
  }
  sleep 1
done
((database_ready == 1)) || { printf 'Database readiness timed out\n' >&2; exit 1; }
docker exec "$db_container" pg_isready -U "$postgres_user" -d "$postgres_source_db" >/dev/null
printf 'ISOLATED_NETWORK=ok\n'

printf 'PHASE=database_restore\n'
phase='database_restore'
dump_check_db='paperless_dump_check'
docker exec "$db_container" createdb -U "$postgres_user" "$dump_check_db"
docker exec "$db_container" pg_restore -U "$postgres_user" --no-owner --no-privileges \
  -d "$dump_check_db" /restore/postgresql.dump
dump_table_count="$(docker exec "$db_container" psql -U "$postgres_user" -d "$dump_check_db" -Atqc \
  "select count(*) from pg_tables where schemaname='public';")"
dump_document_count="$(docker exec "$db_container" psql -U "$postgres_user" -d "$dump_check_db" -Atqc \
  'select count(*) from documents_document;')"
((dump_table_count > 0))
printf 'PG_RESTORE=ok\n'
printf 'PG_PUBLIC_TABLES=%s\n' "$dump_table_count"
printf 'PG_DOCUMENTS=%s\n' "$dump_document_count"

printf 'PHASE=fresh_paperless_import\n'
phase='fresh_paperless_import'
import_db='paperless_import_check'
docker exec "$db_container" createdb -U "$postgres_user" "$import_db"
docker run -d --name "$broker_container" --network "$network_name" --network-alias broker \
  "$REDIS_IMAGE" >/dev/null
docker run -d --name "$web_container" --network "$network_name" \
  -e PAPERLESS_REDIS=redis://broker:6379 \
  -e PAPERLESS_DBHOST=db \
  -e PAPERLESS_DBNAME="$import_db" \
  -e PAPERLESS_DBUSER="$postgres_user" \
  -e PAPERLESS_DBPASS \
  -e PAPERLESS_SECRET_KEY \
  -e PAPERLESS_URL=http://paperless.invalid \
  -e PAPERLESS_TIME_ZONE=Europe/Berlin \
  --tmpfs /usr/src/paperless/data \
  --tmpfs /usr/src/paperless/media \
  -v "$export_dir:/usr/src/paperless/export:ro" \
  "$PAPERLESS_IMAGE" >/dev/null

paperless_ready=0
for _ in $(seq 1 180); do
  if docker exec "$web_container" curl -fsS --max-time 2 http://localhost:8000/ >/dev/null 2>&1; then
    paperless_ready=1
    break
  fi
  docker inspect -f '{{.State.Running}}' "$web_container" 2>/dev/null | grep -qx true || {
    printf 'Paperless container exited during startup\n' >&2
    docker logs "$web_container" 2>&1 | sed -E '/(password|secret|token|key)/Id' | tail -50 >&2
    exit 1
  }
  sleep 1
done
((paperless_ready == 1)) || { printf 'Paperless readiness timed out\n' >&2; exit 1; }
printf 'PAPERLESS_READY=ok\n'

import_log="$temp_root/import.log"
if ! docker exec "$web_container" document_importer /usr/src/paperless/export --no-progress-bar >"$import_log" 2>&1; then
  printf 'Document import failed; sanitized tail follows\n' >&2
  sed -E '/(password|secret|token|key)/Id' "$import_log" | tail -40 >&2
  exit 1
fi
printf 'DOCUMENT_IMPORT=ok\n'

printf 'PHASE=verification\n'
phase='verification'
import_document_count="$(docker exec "$web_container" python3 manage.py shell -c \
  'from documents.models import Document; print(Document.objects.count())' 2>/dev/null | tail -n 1 | tr -d '\r')"
import_user_count="$(docker exec "$web_container" python3 manage.py shell -c \
  'from django.contrib.auth import get_user_model; print(get_user_model().objects.exclude(username__in=["consumer","AnonymousUser"]).count())' \
  2>/dev/null | tail -n 1 | tr -d '\r')"
[[ "$import_document_count" =~ ^[0-9]+$ && "$import_user_count" =~ ^[0-9]+$ ]]
[[ "$import_document_count" -eq "$dump_document_count" ]]

access_control_tables=(
  auth_user
  auth_group
  auth_user_groups
  auth_user_user_permissions
  guardian_userobjectpermission
  guardian_groupobjectpermission
)
access_control_row_count=0
for access_control_table in "${access_control_tables[@]}"; do
  source_rows="$(docker exec "$db_container" psql -U "$postgres_user" -d "$dump_check_db" -Atqc \
    "select count(*) from ${access_control_table};")"
  imported_rows="$(docker exec "$db_container" psql -U "$postgres_user" -d "$import_db" -Atqc \
    "select count(*) from ${access_control_table};")"
  [[ "$source_rows" =~ ^[0-9]+$ && "$imported_rows" =~ ^[0-9]+$ ]]
  [[ "$source_rows" -eq "$imported_rows" ]]
  access_control_row_count="$((access_control_row_count + source_rows))"
done

published_port_bindings="$(docker inspect "$web_container" "$db_container" "$broker_container" \
  --format '{{json .HostConfig.PortBindings}}' | grep -vcE '^null$|^\{\}$' || true)"
[[ "$published_port_bindings" -eq 0 ]]

drill_elapsed="$(( $(date +%s) - drill_started ))"
printf 'IMPORTED_DOCUMENTS=%s\n' "$import_document_count"
printf 'IMPORTED_USERS=%s\n' "$import_user_count"
printf 'ACCESS_CONTROL_TABLES_MATCHED=%s\n' "${#access_control_tables[@]}"
printf 'ACCESS_CONTROL_ROWS_MATCHED=%s\n' "$access_control_row_count"
printf 'PUBLISHED_PORT_BINDINGS=%s\n' "$published_port_bindings"
printf 'ELAPSED_SECONDS=%s\n' "$drill_elapsed"
printf 'DRILL_RESULT=passed\n'
