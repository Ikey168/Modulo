#!/usr/bin/env bash
set -u

# Small, dependency-light home-network probe. It intentionally records only
# reachability and timing metadata; it never stores credentials or payloads.

STATE_DIR="${HOME}/.local/state/home-network-monitor"
STATE_FILE="${STATE_DIR}/last.json"
mkdir -p "$STATE_DIR"

timestamp="$(date --iso-8601=seconds)"
router="down"
ap="down"
pi="up"
dns="down"
internet="down"

if ping -c 1 -W 2 192.168.88.1 >/dev/null 2>&1; then router="up"; fi
if ping -c 1 -W 2 192.168.88.2 >/dev/null 2>&1; then ap="up"; fi
if command -v dig >/dev/null 2>&1; then
  if dig +short +time=2 +tries=1 @192.168.88.1 example.com A | grep -q .; then dns="up"; fi
elif command -v python3 >/dev/null 2>&1; then
  # Minimal direct DNS probe so the check remains independent of a local
  # resolver override (for example, a VPN agent's resolv.conf integration).
  if python3 - <<'PY'
import socket, struct
name = b"\x07example\x03com\x00"
packet = struct.pack("!HHHHHH", 0x4d4d, 0x0100, 1, 0, 0, 0)
packet += name + struct.pack("!HH", 1, 1)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(2)
sock.sendto(packet, ("192.168.88.1", 53))
data, _ = sock.recvfrom(512)
if len(data) < 12 or struct.unpack("!H", data[2:4])[0] & 0x8000 == 0:
    raise SystemExit(1)
PY
  then dns="up"; fi
fi
if curl --silent --show-error --fail --connect-timeout 3 --max-time 5 https://example.com >/dev/null 2>&1; then internet="up"; fi

overall="ok"
if [[ "$router" != up || "$ap" != up || "$dns" != up || "$internet" != up ]]; then
  overall="degraded"
fi

umask 077
printf '{"timestamp":"%s","overall":"%s","router":"%s","ap":"%s","pi":"%s","dns":"%s","internet":"%s"}\n' \
  "$timestamp" "$overall" "$router" "$ap" "$pi" "$dns" "$internet" >"$STATE_FILE"

if [[ "$overall" != ok ]]; then
  logger -t home-network-monitor -- "state=$overall router=$router ap=$ap dns=$dns internet=$internet"
fi
