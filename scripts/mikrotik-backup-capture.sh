#!/usr/bin/env bash
set -euo pipefail

# Capture RouterOS exports/backups into the mounted Cryptomator vault. The
# desktop administration key authenticates the capture; no password file or
# privileged sshpass process is needed. Backup contents are never printed.
umask 077

lock_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "$lock_dir"
exec 9>"$lock_dir/mikrotik-backup-capture.lock"
flock -n 9 || exit 0

router_host="192.168.88.1"
router_user="ik-netadmin"
ssh_options=(-i "$HOME/.ssh/id_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8)
vault_dir="/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)"
stamp="$(date +%Y%m%d%H%M%S)"
remote_base="modulo-auto-${stamp}"
tmp_dir="$(mktemp -d /tmp/modulo-mikrotik-backup.XXXXXX)"
remote_created=0

cleanup() {
  if [ "$remote_created" -eq 1 ]; then
    ssh "${ssh_options[@]}" \
      "$router_user@$router_host" \
      "/file remove [find name~\"$remote_base\"]" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

test -d "$vault_dir"

remote_cmd="/export hide-sensitive file=$remote_base; /system backup save name=$remote_base"
ssh "${ssh_options[@]}" \
  "$router_user@$router_host" "$remote_cmd" >/dev/null
remote_created=1

for extension in rsc backup; do
  destination="$tmp_dir/${remote_base}.${extension}"
  scp -O -q "${ssh_options[@]}" \
    "$router_user@$router_host:${remote_base}.${extension}" "$destination"
  chmod 600 "$destination"
done

for extension in rsc backup; do
  archive_name="mikrotik-hEX-S-${remote_base}.${extension}"
  install -m 600 "$tmp_dir/${remote_base}.${extension}" "$vault_dir/$archive_name"
  sha256sum "$vault_dir/$archive_name" > "$vault_dir/$archive_name.sha256"
  chmod 600 "$vault_dir/$archive_name.sha256"
done

printf 'stored_base=%s\n' "$vault_dir/mikrotik-hEX-S-${remote_base}"
