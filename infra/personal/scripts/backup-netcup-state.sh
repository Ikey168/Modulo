#!/bin/sh
set -eu
umask 077

usage() {
  printf 'Usage: NETCUP_BACKUP_DEST=/absolute/path %s\n' "$0" >&2
  exit 2
}

destination=${NETCUP_BACKUP_DEST:-}
[ -n "$destination" ] || usage
case "$destination" in
  /*) ;;
  *) printf 'NETCUP_BACKUP_DEST must be an absolute path\n' >&2; exit 2 ;;
esac
[ -d "$destination" ] || { printf 'backup destination does not exist: %s\n' "$destination" >&2; exit 2; }

case "$destination" in
  /home/ik/ChatGPT|/home/ik/ChatGPT/*)
    printf 'refusing to place an archive inside the source tree\n' >&2
    exit 2
    ;;
esac

archive="$destination/netcup-dev-state-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
set -- /home/ik/ChatGPT
[ -e /home/ik/.config/mise ] && set -- "$@" /home/ik/.config/mise
[ -e /home/ik/.config/git ] && set -- "$@" /home/ik/.config/git
[ -e /home/ik/.bashrc ] && set -- "$@" /home/ik/.bashrc
[ -e /home/ik/.profile ] && set -- "$@" /home/ik/.profile
tar -czf "$archive" \
  --warning=no-file-changed \
  --exclude='/home/ik/.ssh' \
  --exclude='/home/ik/.config/modulo-mcp' \
  --exclude='/home/ik/.codex' \
  --exclude='/home/ik/.claude' \
  --exclude='*/.env' \
  --exclude='*/.env.*' \
  --exclude='*/node_modules' \
  --exclude='*/.venv' \
  --exclude='*/target' \
  --exclude='*/dist' \
  --exclude='*/.cache' \
  --exclude='*/__pycache__' \
  --exclude='*secret*' \
  --exclude='*token*' \
  --exclude='*password*' \
  --exclude='*credential*' \
  --exclude='*/id_rsa*' \
  --exclude='*/id_ed25519*' \
  "$@" \
  /etc/ssh/sshd_config.d/60-personal-baseline.conf \
  /etc/netcup-admin/ssh-zerotier.nft \
  /etc/systemd/system/netcup-ssh-zerotier-firewall.service \
  /usr/local/sbin/netcup-ssh-zerotier-firewall \
  /etc/systemd/system/dev-netcup-health.service \
  /etc/systemd/system/dev-netcup-health.timer \
  /etc/systemd/system/dev-netcup-docker-prune.service \
  /etc/systemd/system/dev-netcup-docker-prune.timer \
  /usr/local/sbin/dev-netcup-health

sha256sum "$archive" > "$archive.sha256"
printf '%s\n' "$archive"
