#!/usr/bin/env bash
set -euo pipefail
umask 077

vault_root=${MATRIX_BACKUP_ROOT:-"$HOME/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/30_Infrastructure Backups/Matrix"}
state_root=${MATRIX_BACKUP_STATE_ROOT:-"$HOME/.local/state/matrix-backup-monitor"}
max_age_seconds=${MATRIX_BACKUP_MAX_AGE_SECONDS:-129600}
mkdir -p "$state_root"
chmod 700 "$state_root"

status=ok
reason=healthy
latest=''
age_seconds=-1

if [[ ! -d "$vault_root" ]]; then
  status=failed
  reason=vault_unavailable
else
  latest=$(find "$vault_root" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -printf '%f\n' | sort | tail -1)
  if [[ -z "$latest" ]]; then
    status=failed
    reason=backup_missing
  else
    latest_path="$vault_root/$latest"
    age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest_path") ))
    if ! (cd "$latest_path" && sha256sum -c SHA256SUMS >/dev/null); then
      status=failed
      reason=checksum_failed
    elif find "$latest_path" -maxdepth 1 -type f -size 0 | grep -q .; then
      status=failed
      reason=empty_component
    elif (( age_seconds > max_age_seconds )); then
      status=failed
      reason=stale
    fi
  fi
fi

jq -n \
  --arg checked_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg status "$status" \
  --arg reason "$reason" \
  --arg latest "$latest" \
  --argjson age_seconds "$age_seconds" \
  '{checked_at:$checked_at,status:$status,reason:$reason,latest:$latest,age_seconds:$age_seconds}' \
  >"$state_root/last.json.tmp"
mv "$state_root/last.json.tmp" "$state_root/last.json"
chmod 600 "$state_root/last.json"
logger -t matrix-backup-monitor -- "status=$status reason=$reason age_seconds=$age_seconds"
[[ "$status" == ok ]]
