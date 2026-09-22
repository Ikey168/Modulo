#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
failures=0

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; failures=$((failures + 1)); }

if hostname -f 2>/dev/null | grep -Fxq 'v2202609388785525256.ultrasrv.de'; then pass 'canonical hostname'; else fail 'canonical hostname'; fi
if [ -r /etc/os-release ] && . /etc/os-release && [ "$ID" = debian ] && [ "${VERSION_ID%%.*}" = 13 ]; then pass 'Debian 13'; else fail 'Debian 13'; fi

for command_name in docker git gh jq tmux mvn java python3; do
  if command -v "$command_name" >/dev/null 2>&1; then pass "command $command_name"; else fail "command $command_name"; fi
done

for unit in ssh docker zerotier-one unattended-upgrades; do
  if systemctl is-active --quiet "$unit"; then pass "service $unit active"; else fail "service $unit active"; fi
done
for timer in dev-netcup-health.timer dev-netcup-docker-prune.timer; do
  if systemctl is-enabled --quiet "$timer" && systemctl is-active --quiet "$timer"; then pass "timer $timer enabled/active"; else fail "timer $timer enabled/active"; fi
done
if systemctl is-enabled --quiet netcup-ssh-zerotier-firewall.service \
  && systemctl is-active --quiet netcup-ssh-zerotier-firewall.service; then
  pass 'ZeroTier-only SSH firewall enabled/active'
else
  fail 'ZeroTier-only SSH firewall enabled/active'
fi

zerotier_networks=''
if [ -x /usr/sbin/zerotier-cli ]; then
  zerotier_networks="$(/usr/sbin/zerotier-cli -j listnetworks 2>/dev/null || sudo -n /usr/sbin/zerotier-cli -j listnetworks 2>/dev/null || true)"
fi
if printf '%s\n' "$zerotier_networks" \
  | jq -e --arg id 88c5b1f339774e42 --arg address 10.165.78.189 \
    '.[] | select(.nwid == $id and .status == "OK" and (.assignedAddresses | any(startswith($address))))' >/dev/null 2>&1; then
  pass 'ZeroTier network authorized and addressed'
else
  fail 'ZeroTier network authorized and addressed'
fi

if command -v sudo >/dev/null 2>&1 && sudo -n sshd -T 2>/dev/null | \
  awk '$1 == "passwordauthentication" {p=$2} $1 == "kbdinteractiveauthentication" {k=$2} $1 == "permitrootlogin" {r=$2} END {exit !(p == "no" && k == "no" && r == "no")}'; then
  pass 'SSH password/kbd-interactive/root login disabled'
else
  fail 'SSH hardening'
fi

firewall_rules=''
if command -v sudo >/dev/null 2>&1; then
  firewall_rules="$(sudo -n /usr/sbin/nft list table inet netcup_admin 2>/dev/null || true)"
fi
if printf '%s\n' "$firewall_rules" \
  | grep -Fq 'iifname "ztpp6mnpl3" tcp dport 22 accept' \
  && printf '%s\n' "$firewall_rules" | grep -Fq 'tcp dport 22 drop'; then
  pass 'SSH administration restricted to ZeroTier'
else
  fail 'SSH administration restricted to ZeroTier'
fi

health_json="$(cat /var/lib/dev-netcup-health/last.json 2>/dev/null || sudo -n cat /var/lib/dev-netcup-health/last.json 2>/dev/null || true)"
if printf '%s\n' "$health_json" | jq -e '.healthy == true and .zerotierNetwork == "OK" and .services.adminFirewall == "active" and .rootDiskPercent < 90' >/dev/null 2>&1; then
  pass 'health evidence is healthy'
else
  fail 'health evidence is healthy'
fi

if [ "$failures" -eq 0 ]; then
  printf 'Netcup baseline verification passed.\n'
else
  printf '%s check(s) failed.\n' "$failures" >&2
  exit 1
fi
