#!/usr/bin/env bash
# Real dump/restore round-trip, completely isolated from configured deployments.
set -Eeuo pipefail
work=$(mktemp -d)
source_container="modulo-backup-fixture-$$"
cleanup() { docker rm -fv "$source_container" >/dev/null 2>&1 || true; rm -rf -- "$work"; }
trap cleanup EXIT
docker run -d --name "$source_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=backup_fixture -e POSTGRES_DB=modulodb postgres:16.10-alpine >/dev/null
for ((i=0;i<60;i++)); do
  if docker exec "$source_container" pg_isready -h 127.0.0.1 -U backup_fixture >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$source_container" psql -X -U backup_fixture -d modulodb -v ON_ERROR_STOP=1 -c "CREATE SCHEMA application; CREATE TABLE application.notes(note_id BIGINT PRIMARY KEY, content TEXT); INSERT INTO application.notes VALUES (1,'restore fixture'); CREATE TABLE public.plugin_registry(id BIGINT);"
docker exec "$source_container" pg_dumpall -U backup_fixture | gzip > "$work/postgres.sql.gz"
printf 'archive fixture' > "$work/data"
for name in neo4j noesis; do tar -C "$work" -czf "$work/$name-data.tar.gz" data; done
(cd "$work" && sha256sum postgres.sql.gz neo4j-data.tar.gz noesis-data.tar.gz > SHA256SUMS)
touch "$work/VERIFIED"
"$(dirname "$0")/../restore-drill.sh" "$work"
# A damaged dump must be rejected before it can be treated as restorable.
printf 'damage' >> "$work/postgres.sql.gz"
if "$(dirname "$0")/../restore-drill.sh" "$work"; then echo 'Corrupt snapshot was accepted' >&2; exit 1; fi
echo 'Real restore and corruption-rejection checks passed.'
