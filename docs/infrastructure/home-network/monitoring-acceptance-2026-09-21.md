# Home-network monitoring acceptance — 2026-09-21

This is a metadata-only acceptance receipt. It contains no credentials,
client traffic, DNS history, or service payloads.

## Healthy baseline

At 00:24 CEST on 2026-09-21, the desktop user timers were active for the
one-minute home-network probe, five-minute MikroTik health and event probes,
five-minute AP/Pi probe, and hourly backup-integrity probe. The current state
was:

- home-network path: router, AP, DNS and Internet all `up`;
- MikroTik RouterOS 7.20.1: WAN up, four enabled DHCP servers, five bound
  leases, one WireGuard interface and one peer, with zero WAN drops/errors;
- AP/Pi probe: AP management, LAN, radios, uplink, Pi reachability, services
  and storage all healthy;
- Pi service probe: 12 of 12 declared critical containers healthy;
- backup-integrity probe: MikroTik text export/binary backup and OpenWrt
  archive/package manifest present, mode `600`, fresh and checksum-matching.

## Dashboard reconciliation gate

Uptime Kuma is running healthy on `pi5`, but its existing 26-monitor database
is not an accepted current service inventory. The database/log evidence shows
the old Pi SSH target `192.168.88.135` and several legacy `.zt`/Caddy targets
returning timeouts, 502 responses, or inaccessible group results. The current
Pi management path is `10.10.20.10` (with ZeroTier addresses retained for
private access), so those targets need an owner-approved reconciliation or
explicit pause before dashboard acceptance.

No external, outage-resistant notification destination has been selected or
tested. A green local probe therefore does not prove that a total home-site
outage would alert the owner.

## Open gates

- `NET-MON-06`: select and test an external alert route, including recovery and
  deduplication behavior;
- `NET-MON-07`: run controlled failure/tabletop cases after the alert route is
  available, without taking the live gateway or AP down unattended;
- `NET-MON-08`: reconcile the Uptime Kuma targets, define retention/backup and
  review cadence, then repeat acceptance.

The minimal probes remain useful and continue running while these gates stay
`Waiting`.
