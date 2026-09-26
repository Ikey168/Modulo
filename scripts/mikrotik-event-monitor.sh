#!/usr/bin/env bash
set -euo pipefail

# Copy only actionable RouterOS ring-buffer events to the desktop. Routine DHCP
# churn and this collector's own login/logout noise are deliberately excluded.
umask 077

router_host="${MIKROTIK_MONITOR_HOST:-192.168.88.1}"
router_user="${MIKROTIK_MONITOR_USER:-modulo-monitor}"
identity_file="${MIKROTIK_MONITOR_KEY:-$HOME/.local/share/modulo/network-monitor/id_ed25519}"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mikrotik-event-monitor"
events_path="$state_dir/events.jsonl"
summary_path="$state_dir/last.json"
mkdir -p "$state_dir"

snapshot="$(ssh \
  -i "$identity_file" \
  -o IdentitiesOnly=yes \
  -o BatchMode=yes \
  -o ConnectTimeout=5 \
  "$router_user@$router_host" \
  '/log print without-paging where topics~"account|system|interface|dhcp|wireguard|warning|error|critical"' \
  2>/dev/null)"

python3 - "$events_path" "$summary_path" "$snapshot" <<'PY'
import hashlib
import json
import os
import pathlib
import re
import sys
import tempfile
import time

events_path = pathlib.Path(sys.argv[1])
summary_path = pathlib.Path(sys.argv[2])
raw = sys.argv[3]
mac = re.compile(r"(?i)\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b")

def useful(line):
    lower = line.lower()
    if "user modulo-monitor logged " in lower:
        return False
    if "dhcp,info" in lower and not any(word in lower for word in (
        "fail", "error", "warning", "conflict", "declin", "exhaust",
    )):
        return False
    return bool(line.strip())

existing = []
seen = set()
if events_path.is_file():
    existing = events_path.read_text(encoding="utf-8").splitlines()[-2000:]
    for line in existing:
        try:
            seen.add(json.loads(line)["id"])
        except (ValueError, KeyError, TypeError):
            continue

added = []
for source in raw.splitlines():
    line = source.strip()
    if not useful(line):
        continue
    line = mac.sub("[mac-redacted]", line)
    event_id = hashlib.sha256(line.encode("utf-8")).hexdigest()[:24]
    if event_id in seen:
        continue
    seen.add(event_id)
    added.append(json.dumps({"id": event_id, "event": line}, separators=(",", ":")))

combined = (existing + added)[-2000:]
with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=events_path.parent,
                                 prefix=".events.", delete=False) as handle:
    os.chmod(handle.fileno(), 0o600)
    if combined:
        handle.write("\n".join(combined) + "\n")
    handle.flush()
    os.fsync(handle.fileno())
    temporary = pathlib.Path(handle.name)
os.replace(temporary, events_path)

summary = {
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "overall": "ok",
    "retained_events": len(combined),
    "new_events": len(added),
    "retention_limit": 2000,
}
with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=summary_path.parent,
                                 prefix=".last.", delete=False) as handle:
    os.chmod(handle.fileno(), 0o600)
    json.dump(summary, handle, separators=(",", ":"))
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
    temporary = pathlib.Path(handle.name)
os.replace(temporary, summary_path)
print(json.dumps(summary, separators=(",", ":")))
PY

