#!/usr/bin/env bash
set -euo pipefail

# Read-only RouterOS health collection. Authentication uses the dedicated
# modulo-monitor SSH key and a RouterOS group without write/policy privileges.
umask 077

router_host="${MIKROTIK_MONITOR_HOST:-192.168.88.1}"
router_user="${MIKROTIK_MONITOR_USER:-modulo-monitor}"
identity_file="${MIKROTIK_MONITOR_KEY:-$HOME/.local/share/modulo/network-monitor/id_ed25519}"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mikrotik-health-monitor"
state_path="$state_dir/last.json"
mkdir -p "$state_dir"

snapshot="$(ssh \
  -i "$identity_file" \
  -o IdentitiesOnly=yes \
  -o BatchMode=yes \
  -o ConnectTimeout=5 \
  "$router_user@$router_host" \
  ':put ("version=" . [/system resource get version]); :put ("uptime=" . [/system resource get uptime]); :put ("cpu_load=" . [/system resource get cpu-load]); :put ("free_memory=" . [/system resource get free-memory]); :put ("total_memory=" . [/system resource get total-memory]); :put ("free_hdd=" . [/system resource get free-hdd-space]); :put ("total_hdd=" . [/system resource get total-hdd-space]); :put ("wan_running=" . [/interface get ether1 running]); :put ("wan_rx_byte=" . [/interface get ether1 rx-byte]); :put ("wan_tx_byte=" . [/interface get ether1 tx-byte]); :put ("wan_rx_drop=" . [/interface get ether1 rx-drop]); :put ("wan_tx_drop=" . [/interface get ether1 tx-drop]); :put ("wan_rx_error=" . [/interface get ether1 rx-error]); :put ("wan_tx_error=" . [/interface get ether1 tx-error]); :put ("dhcp_servers=" . [:len [/ip dhcp-server find where disabled=no]]); :put ("bound_leases=" . [:len [/ip dhcp-server lease find where status="bound"]]); :put ("wg_interfaces=" . [:len [/interface wireguard find]]); :put ("wg_peers=" . [:len [/interface wireguard peers find]])' \
  2>/dev/null)"

python3 - "$state_path" "$snapshot" <<'PY'
import json
import os
import pathlib
import sys
import tempfile
import time

state_path = pathlib.Path(sys.argv[1])
raw = sys.argv[2]
fields = {}
for line in raw.splitlines():
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    fields[key.strip()] = value.strip()

required = {
    "version", "uptime", "cpu_load", "free_memory", "total_memory",
    "free_hdd", "total_hdd", "wan_running", "wan_rx_byte", "wan_tx_byte",
    "wan_rx_drop", "wan_tx_drop", "wan_rx_error", "wan_tx_error",
    "dhcp_servers", "bound_leases", "wg_interfaces", "wg_peers",
}
missing = sorted(required - fields.keys())
if missing:
    raise SystemExit("missing RouterOS fields: " + ",".join(missing))

numeric_names = required - {"version", "uptime", "wan_running"}
numbers = {name: int(fields[name]) for name in numeric_names}

previous = {}
if state_path.is_file():
    try:
        previous = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = {}

memory_free_pct = round(numbers["free_memory"] * 100 / max(1, numbers["total_memory"]), 1)
hdd_free_pct = round(numbers["free_hdd"] * 100 / max(1, numbers["total_hdd"]), 1)
reasons = []
if fields["wan_running"] != "true":
    reasons.append("wan_link_down")
if numbers["cpu_load"] >= 85:
    reasons.append("cpu_load_high")
if memory_free_pct < 10:
    reasons.append("memory_low")
if hdd_free_pct < 10:
    reasons.append("storage_low")
if numbers["dhcp_servers"] < 1:
    reasons.append("dhcp_server_missing")

for name in ("wan_rx_drop", "wan_tx_drop", "wan_rx_error", "wan_tx_error"):
    old_value = previous.get(name)
    if isinstance(old_value, int) and numbers[name] > old_value:
        reasons.append(name + "_increased")

payload = {
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "overall": "degraded" if reasons else "ok",
    "reasons": reasons,
    "version": fields["version"],
    "uptime": fields["uptime"],
    "cpu_load_pct": numbers["cpu_load"],
    "memory_free_pct": memory_free_pct,
    "hdd_free_pct": hdd_free_pct,
    "wan_running": fields["wan_running"] == "true",
    "wan_rx_byte": numbers["wan_rx_byte"],
    "wan_tx_byte": numbers["wan_tx_byte"],
    "wan_rx_drop": numbers["wan_rx_drop"],
    "wan_tx_drop": numbers["wan_tx_drop"],
    "wan_rx_error": numbers["wan_rx_error"],
    "wan_tx_error": numbers["wan_tx_error"],
    "dhcp_servers": numbers["dhcp_servers"],
    "bound_leases": numbers["bound_leases"],
    "wireguard": (
        "not_configured" if numbers["wg_interfaces"] == 0
        else {"interfaces": numbers["wg_interfaces"], "peers": numbers["wg_peers"]}
    ),
}

state_path.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=state_path.parent,
                                 prefix=".last.", delete=False) as handle:
    os.chmod(handle.fileno(), 0o600)
    json.dump(payload, handle, separators=(",", ":"))
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
    temporary = pathlib.Path(handle.name)
os.replace(temporary, state_path)
print(json.dumps(payload, separators=(",", ":")))
if reasons:
    raise SystemExit(1)
PY

