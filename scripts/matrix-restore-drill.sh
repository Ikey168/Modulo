#!/usr/bin/env bash
set -euo pipefail

ssh_target=${MATRIX_SSH_TARGET:-pi}
vault_root=${MATRIX_BACKUP_ROOT:-"$HOME/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/30_Infrastructure Backups/Matrix"}
backup=${1:-}
if [[ -z "$backup" ]]; then
  latest=$(find "$vault_root" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -printf '%f\n' | sort | tail -1)
  backup="$vault_root/$latest"
fi
[[ -d "$backup" ]] || { printf 'Backup not found: %s\n' "$backup" >&2; exit 1; }
(cd "$backup" && sha256sum -c SHA256SUMS >/dev/null)

drill_name="matrix-restore-drill-$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  ssh -o BatchMode=yes "$ssh_target" "docker rm -f '$drill_name' >/dev/null 2>&1 || true"
}
trap cleanup EXIT

ssh -o BatchMode=yes "$ssh_target" \
  "docker run -d --rm --name '$drill_name' --network none --tmpfs /var/lib/postgresql/data:rw,size=2g -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine" \
  >/dev/null

for _ in $(seq 1 30); do
  if ssh -o BatchMode=yes "$ssh_target" "docker exec '$drill_name' pg_isready -U postgres" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
ssh -o BatchMode=yes "$ssh_target" "docker exec '$drill_name' pg_isready -U postgres" >/dev/null

gzip -dc "$backup/postgres.sql.gz" |
  ssh -o BatchMode=yes "$ssh_target" "docker exec -i '$drill_name' psql -v ON_ERROR_STOP=1 -U postgres" \
  >/dev/null

database_count=$(ssh -o BatchMode=yes "$ssh_target" \
  "docker exec '$drill_name' psql -U postgres -Atc \"SELECT count(*) FROM pg_database WHERE datname IN ('synapse','mautrix_discord','mautrix_whatsapp','mautrix_signal','mautrix_telegram')\"")
[[ "$database_count" == 5 ]] || { printf 'Expected five communication databases, restored %s.\n' "$database_count" >&2; exit 1; }

for database in synapse mautrix_discord mautrix_whatsapp mautrix_signal mautrix_telegram; do
  table_count=$(ssh -o BatchMode=yes "$ssh_target" \
    "docker exec '$drill_name' psql -U postgres -d '$database' -Atc \"SELECT count(*) FROM pg_tables WHERE schemaname='public'\"")
  (( table_count > 0 )) || { printf 'No restored tables in %s.\n' "$database" >&2; exit 1; }
done

printf 'PASS: restored five communication databases from %s into isolated tmpfs and verified non-empty schemas.\n' "$(basename "$backup")"
