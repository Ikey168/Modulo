#!/usr/bin/env bash
set -u

STATE_DIR="${HOME}/.local/state/paperless-backup-monitor"
STATE_FILE="${STATE_DIR}/last.json"
STATUS_FILE="/opt/stacks/paperless/status/last-backup.json"
MAX_AGE_SECONDS=$((26 * 60 * 60))
mkdir -p "$STATE_DIR"

status="missing"
age_seconds=-1
if [[ -r "$STATUS_FILE" ]]; then
  status="$(python3 - "$STATUS_FILE" <<'PY'
import json, sys
try:
    payload = json.load(open(sys.argv[1], encoding="utf-8"))
    print(payload.get("status", "unknown"))
except Exception:
    print("invalid")
PY
)"
  age_seconds="$(python3 - "$STATUS_FILE" <<'PY'
import datetime as dt, json, sys
try:
    value = json.load(open(sys.argv[1], encoding="utf-8")).get("completed_at")
    stamp = dt.datetime.fromisoformat(value)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
    print(max(0, int((dt.datetime.now(dt.timezone.utc) - stamp.astimezone(dt.timezone.utc)).total_seconds())))
except Exception:
    print(-1)
PY
)"
fi

available_kb="$(df -Pk /opt/stacks/paperless 2>/dev/null | awk 'NR==2 {print $4}')"
[[ "$available_kb" =~ ^[0-9]+$ ]] || available_kb=-1
overall="ok"
if [[ "$status" != "ok" || "$age_seconds" -lt 0 || "$age_seconds" -gt "$MAX_AGE_SECONDS" || "$available_kb" -lt 1048576 ]]; then
  overall="degraded"
fi

timestamp="$(date --iso-8601=seconds)"
umask 077
printf '{"timestamp":"%s","overall":"%s","backup_status":"%s","age_seconds":%s,"available_kb":%s}\n' \
  "$timestamp" "$overall" "$status" "$age_seconds" "$available_kb" >"$STATE_FILE"

if [[ "$overall" != ok ]]; then
  logger -t paperless-backup-monitor -- "state=$overall backup_status=$status age_seconds=$age_seconds available_kb=$available_kb"
fi
