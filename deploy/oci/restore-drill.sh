#!/usr/bin/env bash
# Restores only into an isolated throwaway container; never touches the live DB.
set -Eeuo pipefail
umask 077
snapshot=$(realpath "${1:?Usage: restore-drill.sh SNAPSHOT_DIRECTORY}")
[[ -f $snapshot/VERIFIED || -f $snapshot/COMPLETE ]] || { echo 'Snapshot is incomplete' >&2; exit 1; }
(cd "$snapshot" && sha256sum -c SHA256SUMS)
for file in neo4j-data noesis-data; do tar -tzf "$snapshot/$file.tar.gz" >/dev/null; done
container="modulo-restore-drill-$$"
network=none
cleanup() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  [[ $network == none ]] || docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
if [[ -n ${MODULO_MIGRATION_IMAGE:-} ]]; then
  [[ $MODULO_MIGRATION_IMAGE =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'Migration image must use a digest' >&2; exit 1; }
  network="$container-network"
  docker network create --internal "$network" >/dev/null
fi
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "$container" --network "$network" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=drill_admin postgres:16.10-alpine >/dev/null
ready=false
for ((attempt=0;attempt<60;attempt++)); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U drill_admin >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
$ready || { echo 'Restore database did not become ready' >&2; exit 1; }
gzip -dc "$snapshot/postgres.sql.gz" | docker exec -i "$container" psql -X -U drill_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null
# pg_dumpall preserves database names; inspect the restored application, not postgres.
database=${POSTGRES_DB:-modulodb}
docker exec "$container" psql -X -U drill_admin -d "$database" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM application.notes;' -c 'SELECT count(*) FROM public.plugin_registry;'
if [[ -n ${MODULO_MIGRATION_IMAGE:-} ]]; then
  migrate=(docker run --rm --network "$network" --entrypoint java
    -e "SPRING_DATASOURCE_URL=jdbc:postgresql://$container:5432/$database"
    -e SPRING_DATASOURCE_USERNAME=drill_admin -e SPRING_DATASOURCE_PASSWORD=drill-local-trust
    "$MODULO_MIGRATION_IMAGE" -Dloader.main=com.modulo.migration.SchemaMigrationTool
    -cp /home/springuser/app/app.jar org.springframework.boot.loader.PropertiesLauncher)
  history=$(docker exec "$container" psql -XAt -U drill_admin -d "$database" -c "SELECT to_regclass('public.modulo_schema_history')")
  if [[ -z $history ]]; then "${migrate[@]}" adopt; fi
  "${migrate[@]}" migrate
  "${migrate[@]}" validate
fi
printf 'Restore drill passed for %s\n' "$snapshot"
