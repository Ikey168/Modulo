#!/usr/bin/env bash
# Nightly backup for the Pi deployment (#386): live pg_dump, then retention
# pruning.
#
# Usage:  ./backup.sh [target-dir]      (default: /mnt/backup/modulo)
# Cron:   15 3 * * *  /home/pi/Modulo/deploy/pi/backup.sh >> /var/log/modulo-backup.log 2>&1
#
# GoBD note: these backups are what make the vault's retention promises real.
# Point the target at an external disk, and test a restore (see README).

set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="${1:-/mnt/backup/modulo}"
KEEP_DAYS="${KEEP_DAYS:-30}"
COMPOSE=(docker compose -f docker-compose.pi.yml)
STAMP="$(date +%Y%m%d-%H%M%S)"

# Load POSTGRES_* etc. for the dump commands.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

mkdir -p "$BACKUP_DIR"

echo "[$STAMP] postgres: live dump"
"${COMPOSE[@]}" exec -T db pg_dump -U "${POSTGRES_USER:-modulo}" "${POSTGRES_DB:-modulodb}" \
  | gzip > "$BACKUP_DIR/postgres-$STAMP.sql.gz"

echo "[$STAMP] pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name 'postgres-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

echo "[$STAMP] done:"
ls -lh "$BACKUP_DIR" | tail -5
