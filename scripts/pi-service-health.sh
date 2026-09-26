#!/usr/bin/env bash
set -u

STATE_DIR="${HOME}/.local/state/pi-service-health"
STATE_FILE="${STATE_DIR}/last.json"
mkdir -p "$STATE_DIR"

critical=(paperless-webserver paperless-postgres paperless-redis matrix-synapse matrix-postgres matrix-element mautrix-discord mautrix-whatsapp mautrix-signal mautrix-telegram uptime-kuma dockge)
healthy=0
total=${#critical[@]}
missing=()
unhealthy=()

for name in "${critical[@]}"; do
  if ! docker inspect "$name" >/dev/null 2>&1; then
    missing+=("$name")
    continue
  fi
  state="$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || true)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$name" 2>/dev/null || true)"
  if [[ "$state" == running && ( "$health" == healthy || "$health" == n/a || "$health" == starting ) ]]; then
    if [[ "$name" == mautrix-telegram ]] \
      && ! docker exec "$name" wget -T 3 -qO- http://127.0.0.1:29317/_matrix/mau/ready >/dev/null 2>&1; then
      unhealthy+=("$name:$state/readiness-failed")
    else
      healthy=$((healthy + 1))
    fi
  else
    unhealthy+=("$name:$state/$health")
  fi
done

overall="ok"
if (( healthy != total )); then overall="degraded"; fi
timestamp="$(date --iso-8601=seconds)"
umask 077
python3 - "$STATE_FILE" "$timestamp" "$overall" "$healthy" "$total" "${missing[*]-}" "${unhealthy[*]-}" <<'PY'
import json
import pathlib
import sys

path, timestamp, overall, healthy, total, missing, unhealthy = sys.argv[1:]
payload = {
    "timestamp": timestamp,
    "overall": overall,
    "healthy": int(healthy),
    "total": int(total),
    "missing": [x for x in missing.split() if x],
    "unhealthy": [x for x in unhealthy.split() if x],
}
pathlib.Path(path).write_text(json.dumps(payload, separators=(",", ":")) + "\n")
PY

if [[ "$overall" != ok ]]; then
  logger -t pi-service-health -- "state=$overall healthy=$healthy total=$total"
fi
