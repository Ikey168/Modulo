#!/usr/bin/env bash
set -euo pipefail

# Capture a restorable OpenWrt configuration into the already-mounted
# Cryptomator vault.  The archive is deliberately never opened or sent to
# Modulo; only its checksum and custody path are safe to record there.
umask 077

lock_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
mkdir -p "$lock_dir"
exec 9>"$lock_dir/openwrt-backup-capture.lock"
flock -n 9 || exit 0

router_host="root@192.168.88.2"
vault_dir="/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)"
stamp="$(date +%Y%m%d%H%M%S)"
remote_path="/tmp/openwrt-archer-c6-backup-${stamp}.tgz"
local_tmp="$(mktemp /tmp/openwrt-archer-c6-backup.XXXXXX.tgz)"
packages_tmp="$(mktemp /tmp/openwrt-archer-c6-packages.XXXXXX.txt)"
trap 'rm -f "$local_tmp" "$packages_tmp"' EXIT

test -d "$vault_dir"

ssh -o BatchMode=yes -o ConnectTimeout=8 "$router_host" \
  "umask 077; sysupgrade -b '$remote_path' >/dev/null 2>&1; test -s '$remote_path'"
scp -O -q -o BatchMode=yes "$router_host:$remote_path" "$local_tmp"
chmod 600 "$local_tmp"
ssh -o BatchMode=yes -o ConnectTimeout=8 "$router_host" "opkg list-installed" > "$packages_tmp"
chmod 600 "$packages_tmp"

archive_name="openwrt-archer-c6-backup-${stamp}.tgz"
checksum_name="${archive_name}.sha256"
packages_name="openwrt-archer-c6-packages-${stamp}.txt"
archive_path="$vault_dir/$archive_name"
checksum_path="$vault_dir/$checksum_name"
packages_path="$vault_dir/$packages_name"
checksum="$(sha256sum "$local_tmp" | awk '{print $1}')"

install -m 600 "$local_tmp" "$archive_path"
printf '%s  %s\n' "$checksum" "$archive_name" > "$checksum_path"
chmod 600 "$checksum_path"
install -m 600 "$packages_tmp" "$packages_path"

# Remove the remote copy's contents without deleting an unrelated path.  The
# AP has no sftp server and the generated copy is root-owned mode 600.
ssh -o BatchMode=yes -o ConnectTimeout=8 "$router_host" ": > '$remote_path'"

printf 'stored=%s\nsha256=%s\n' "$archive_path" "$checksum"
