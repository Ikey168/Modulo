#!/usr/bin/env bash
set -euo pipefail

# Metadata-only AP/Pi probe. It never reads wireless keys, credentials, or
# client content; the AP SSH command returns only health booleans.
umask 077
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/ap-pi-monitor"
state_path="$state_dir/last.json"
mkdir -p "$state_dir"

timestamp="$(date --iso-8601=seconds)"
ap_ping="down"
ap_ssh="down"
ap_lan="unknown"
ap_radios="unknown"
ap_uplink="unknown"
ap_uplink_errors="unknown"
pi_ping="down"
pi_services="unknown"
pi_storage="unknown"

if ping -c 1 -W 2 192.168.88.2 >/dev/null 2>&1; then ap_ping="up"; fi
if [[ "$ap_ping" == up ]]; then
  snapshot="$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
    root@192.168.88.2 \
    'lan=down; radios=down; uplink=unknown; errors=unknown; ubus call network.interface.lan status >/dev/null 2>&1 && lan=up; iwinfo radio0 info 2>/dev/null | grep -q "Mode: Master" && iwinfo radio1 info 2>/dev/null | grep -q "Mode: Master" && radios=up; ip link show br-trusted 2>/dev/null | grep -q "state UP" && ip link show eth0.10 2>/dev/null | grep -q "state UP" && uplink=up; rx=$(cat /sys/class/net/eth0/statistics/rx_errors 2>/dev/null || echo -1); tx=$(cat /sys/class/net/eth0/statistics/tx_errors 2>/dev/null || echo -1); [ "$rx" = 0 ] && [ "$tx" = 0 ] && errors=ok; printf "%s %s %s %s" "$lan" "$radios" "$uplink" "$errors"' 2>/dev/null || true)"
  read -r ap_lan ap_radios ap_uplink ap_uplink_errors <<<"$snapshot"
  if [[ -n "$snapshot" ]]; then ap_ssh="up"; fi
fi

if ping -c 1 -W 2 10.10.20.10 >/dev/null 2>&1; then pi_ping="up"; fi
if [[ "$pi_ping" == up ]]; then
  if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
      ik@10.10.20.10 \
      'test -r "$HOME/.local/state/pi-service-health/last.json" && grep -q '"'"'"overall":"ok"'"'"' "$HOME/.local/state/pi-service-health/last.json"' \
      >/dev/null 2>&1; then
    pi_services="ok"
  else
    pi_services="degraded"
  fi
  if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
      ik@10.10.20.10 \
      'df -P / | awk '"'"'NR == 2 {gsub(/%/, "", $5); exit ($5+0 > 90)}'"'"'' \
      >/dev/null 2>&1; then
    pi_storage="ok"
  else
    pi_storage="degraded"
  fi
fi

overall="ok"
for value in "$ap_ping" "$ap_ssh" "$ap_lan" "$ap_radios" "$ap_uplink" "$ap_uplink_errors" "$pi_ping" "$pi_services" "$pi_storage"; do
  if [[ "$value" != up && "$value" != ok ]]; then overall="degraded"; fi
done

printf '{"timestamp":"%s","overall":"%s","ap_ping":"%s","ap_ssh":"%s","ap_lan":"%s","ap_radios":"%s","ap_uplink":"%s","ap_uplink_errors":"%s","pi_ping":"%s","pi_services":"%s","pi_storage":"%s"}\n' \
  "$timestamp" "$overall" "$ap_ping" "$ap_ssh" "$ap_lan" "$ap_radios" "$ap_uplink" "$ap_uplink_errors" "$pi_ping" "$pi_services" "$pi_storage" >"$state_path"

if [[ "$overall" != ok ]]; then
  logger -t ap-pi-monitor -- "state=$overall ap=$ap_ping/$ap_ssh lan=$ap_lan radios=$ap_radios uplink=$ap_uplink errors=$ap_uplink_errors pi=$pi_ping services=$pi_services storage=$pi_storage"
  exit 1
fi
