# Home-network configuration record

This directory is the versioned, non-secret documentation index for the home
network. It records topology, addressing, trust boundaries, recovery pointers,
and the custody locations of configuration artifacts. Passwords, private keys,
wireless secrets, ISP credentials, and binary configuration contents do not
belong here.

## Authoritative components

| Component | Role | Management reference |
| --- | --- | --- |
| MikroTik hEX S | gateway, firewall, DHCP, DNS and NTP authority | `192.168.88.1` |
| TP-Link Archer C6 / OpenWrt | wired-backhaul access point | `192.168.88.2` |
| Raspberry Pi 5 | local services and records host | `10.10.20.10` |
| Desktop | engineering workstation | `192.168.88.136` |
| Laptop | trusted wired client | `192.168.88.254` |

The live network uses Trusted VLAN 10, Infrastructure VLAN 20, IoT VLAN 30 and
Guest VLAN 40. The existing `192.168.88.0/24` addressing was retained for the
Trusted VLAN to avoid needless endpoint renumbering. WireGuard, IPv6 and
power-resilience remain separate projects.

## Documents

- [topology.md](topology.md) — physical and logical layout
- [addressing.md](addressing.md) — safe addresses and planned network ranges
- [configuration.md](configuration.md) — verified ports, services and live/deferred boundaries
- [monitoring.md](monitoring.md) — probes, cadence, state and credential boundary
- [monitoring-acceptance-2026-09-21.md](monitoring-acceptance-2026-09-21.md) — live probe baseline and dashboard acceptance gates
- [recovery.md](recovery.md) — backup custody and recovery procedure
- [wireguard.md](wireguard.md) — public peer inventory and activation template
- [wireguard-acceptance-2026-09-20.md](wireguard-acceptance-2026-09-20.md) — relay, policy, failure and revocation evidence
- [ipv6-acceptance-2026-09-20.md](ipv6-acceptance-2026-09-20.md) — ISP measurement, fail-closed fallback and IPv6 rollout gate
- [gateway-acceptance-2026-09-20.md](gateway-acceptance-2026-09-20.md) — controlled reboot and gateway acceptance evidence
- [openwrt-ap-acceptance-2026-09-20.md](openwrt-ap-acceptance-2026-09-20.md) — AP policy, client measurements and restart acceptance
- [segmentation-acceptance-2026-09-20.md](segmentation-acceptance-2026-09-20.md) — VLAN, firewall and reboot acceptance evidence
- [dns-acceptance-2026-09-20.md](dns-acceptance-2026-09-20.md) — local naming, resolver policy, isolation and failover evidence

## Review and change control

Review after every material topology or firewall change and at least quarterly.
Changes must be copy-first, reversible, and accompanied by a fresh hide-sensitive
RouterOS export and OpenWrt archive. The encrypted artifacts and their checksums
are tracked in Modulo Knowledge Notes #145 and #150; this repository contains
only their safe references.
