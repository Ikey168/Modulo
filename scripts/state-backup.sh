#!/bin/sh
# PostgreSQL custom-format backup and restore, including plugin state/schema history.
set -eu
: "${PGDATABASE:?Set PGDATABASE to the source or empty restore destination}"
if [ "$#" -ne 2 ]; then
  echo "Usage: PGDATABASE=db $0 backup|restore archive.dump" >&2
  exit 2
fi
case "$1" in
  backup)
    umask 077
    pg_dump --format=custom --no-owner --file="$2" --dbname="$PGDATABASE"
    pg_restore --list "$2" >/dev/null
    ;;
  restore)
    # Restore into an empty destination with API writers stopped. Failure rolls back the restore.
    pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$PGDATABASE" "$2"
    psql --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$PGDATABASE" <<'SQL'
BEGIN;
UPDATE plugin_state_storage SET generation=gen_random_uuid(), rotated_at=CURRENT_TIMESTAMP WHERE singleton=1;
-- A restored database must not revive previously revoked authority or old notifications.
UPDATE plugin_state_grants SET revoked=TRUE;
UPDATE plugin_state_events SET delivered_at=CURRENT_TIMESTAMP WHERE delivered_at IS NULL;
COMMIT;
SQL
    ;;
  *) echo "Expected backup or restore" >&2; exit 2 ;;
esac
