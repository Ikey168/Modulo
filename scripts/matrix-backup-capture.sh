#!/usr/bin/env bash
set -euo pipefail
umask 077

ssh_target=${MATRIX_SSH_TARGET:-pi}
vault_root=${MATRIX_BACKUP_ROOT:-"$HOME/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/30_Infrastructure Backups/Matrix"}
stamp=$(date -u +%Y%m%dT%H%M%SZ)

if [[ ! -d "$HOME/.local/share/Cryptomator/mnt/Vault_ImportantDocs" ]]; then
  printf '%s\n' 'Cryptomator recovery vault is not mounted; refusing to create an unprotected backup.' >&2
  exit 1
fi

mkdir -p "$vault_root"
chmod 700 "$vault_root"
staging=$(mktemp -d "$vault_root/.capture-$stamp.XXXXXX")
cleanup() {
  if [[ -d "$staging" && "$staging" == "$vault_root"/.capture-* ]]; then
    find "$staging" -depth -delete
  fi
}
trap cleanup EXIT

ssh -o BatchMode=yes -o ConnectTimeout=10 "$ssh_target" \
  'docker exec matrix-postgres sh -c '\''pg_dumpall -U "$POSTGRES_USER" -d "dbname=$POSTGRES_DB" --clean --if-exists'\''' |
  gzip -9 >"$staging/postgres.sql.gz"

ssh -o BatchMode=yes "$ssh_target" \
  'tar -C /opt/stacks/matrix -czf - compose.yml .env config.yaml postgres/init element/config.json' \
  >"$staging/host-config.tar.gz"

ssh -o BatchMode=yes "$ssh_target" \
  'docker exec matrix-synapse tar -C /data -czf - homeserver.yaml matrix.lan.signing.key appservices media_store' \
  >"$staging/synapse-data.tar.gz"

for bridge in discord whatsapp signal telegram; do
  ssh -o BatchMode=yes "$ssh_target" \
    "docker exec mautrix-$bridge tar -C /data -czf - config.yaml registration.yaml" \
    >"$staging/mautrix-$bridge-config.tar.gz"
done

(
  cd "$staging"
  sha256sum postgres.sql.gz host-config.tar.gz synapse-data.tar.gz \
    mautrix-*-config.tar.gz >SHA256SUMS
)

jq -n \
  --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg source "$ssh_target" \
  --arg scope 'Synapse/PostgreSQL, media, Element config, and Mautrix configuration; message contents are not exported separately' \
  '{schema_version:1,captured_at:$captured_at,source:$source,scope:$scope,encrypted_custody:true}' \
  >"$staging/metadata.json"

final="$vault_root/$stamp"
mv "$staging" "$final"
chmod 700 "$final"
trap - EXIT
printf '%s\n' "$final"
