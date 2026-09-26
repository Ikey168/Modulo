# MikroTik gateway acceptance — 2026-09-20

## Result

The MikroTik hEX S passed the controlled gateway acceptance exercise. It
remains the single observed IPv4 gateway, DHCP server, DNS forwarding point,
NTP authority, firewall and NAT boundary for the home network.

The exercise changed no routing, firewall, addressing or service policy. It
validated that the established configuration survives a restart and that the
documented rollback artifacts are current.

## Preconditions and rollback

- The desktop default route used `192.168.88.1` through the trusted wired LAN.
- The gateway health probe reported RouterOS 7.20.1 stable, one active DHCP
  server, an active WAN link and no interface drops or errors.
- A hide-sensitive text export and compatible binary backup were captured at
  `20260920214518` before the restart.
- Both pre-change artifacts and their SHA-256 sidecars were stored in the
  encrypted network-backup custody location and passed checksum verification.

## Controlled restart

- Restart requested: `2026-09-20T21:45:43+02:00`
- Gateway loss first observed: `2026-09-20T21:45:46+02:00`
- Gateway reachability restored: `2026-09-20T21:46:23+02:00`
- Observed interruption: 41 seconds from the restart request
- Post-restart uptime observation: 1 minute 16 seconds

The post-restart health probe reported the WAN link up, one DHCP authority,
three bound leases, no WAN drops or errors, and no degraded-health reasons.

## Acceptance checks

| Check | Evidence | Result |
| --- | --- | --- |
| Configuration persistence | RouterOS 7.20.1 and the expected gateway services returned after the controlled restart | Pass |
| LAN reachability | `192.168.88.1` returned and remained reachable from the desktop | Pass |
| DHCP renewal | The desktop disconnected and reconnected its wired interface, renewed `192.168.88.136/24`, and the router reported the lease as bound | Pass |
| Gateway and DNS assignment | The renewed client received `192.168.88.1` as gateway and DNS server | Pass |
| Local DNS | `router.home.arpa` resolved to `192.168.88.1` | Pass |
| Recursive DNS and egress | A public name resolved and outbound HTTPS completed | Pass |
| WAN management denial | An Oracle-hosted external probe found TCP 22, 80, 443, 8291, 8728 and 8729 unavailable on the observed public IPv4 path | Pass |
| Post-change export | A second hide-sensitive export and binary backup were captured at `20260920214805`; all four pre/post checksum sidecars verified | Pass |

## Operating review

The authoritative and deferred-state boundaries in `configuration.md` remain
accurate. VLAN filtering, WireGuard, delegated IPv6 and guest isolation are
separate projects and were not activated as part of this acceptance exercise.
The current untagged LAN remains the documented rollback baseline.

Repeat this acceptance sequence after a material gateway, firmware, firewall,
DHCP, DNS or physical-topology change. Capture a fresh rollback export before
the change, keep an independent client available, and do not treat a successful
restart alone as proof that DHCP, DNS, egress and WAN denial still work.
