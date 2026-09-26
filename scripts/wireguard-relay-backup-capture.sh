#!/usr/bin/env bash
set -euo pipefail

# Capture the secret-bearing Oracle WireGuard relay configuration directly
# into the mounted Cryptomator vault. Nothing from the configuration is
# printed or stored in the repository.
umask 077

oracle_host="141.147.5.114"
oracle_user="ubuntu"
oracle_identity="/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/Production-Access-Custody/modulo-oracle-20260920"
vault_dir="/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)"
stamp="$(date +%Y%m%d%H%M%S)"
archive_name="wireguard-oracle-relay-${stamp}.conf"
tmp_dir="$(mktemp -d /tmp/modulo-wireguard-backup.XXXXXX)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

test -r "$oracle_identity"
test -d "$vault_dir"

ssh -i "$oracle_identity" -o BatchMode=yes -o ConnectTimeout=8 \
  "$oracle_user@$oracle_host" \
  'sudo -n cat /etc/wireguard/wg-home.conf' >"$tmp_dir/$archive_name"

grep -q '^PrivateKey = ' "$tmp_dir/$archive_name"
grep -q '^# MikroTik home site$' "$tmp_dir/$archive_name"
if grep -q 'Temporary Netcup acceptance peer' "$tmp_dir/$archive_name"; then
  echo "refusing to archive a configuration containing the temporary acceptance peer" >&2
  exit 1
fi

install -m 600 "$tmp_dir/$archive_name" "$vault_dir/$archive_name"
sha256sum "$vault_dir/$archive_name" >"$vault_dir/$archive_name.sha256"
chmod 600 "$vault_dir/$archive_name.sha256"

printf 'stored=%s\n' "$vault_dir/$archive_name"
