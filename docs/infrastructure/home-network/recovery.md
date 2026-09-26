# Recovery references

The encrypted Cryptomator vault is the custody location for secret-bearing
network artifacts. Modulo records only paths, version labels, timestamps, and
checksums.

## Artifacts

- MikroTik hEX S: daily hide-sensitive `.rsc` export and binary `.backup`,
  captured by `scripts/mikrotik-backup-capture.sh`.
- Archer C6/OpenWrt: daily `sysupgrade -b` archive plus installed-package
  manifest, captured by `scripts/openwrt-backup-capture.sh`.
- Freshness/checksum state: hourly metadata-only check by
  `scripts/network-backup-monitor.sh`.

See Knowledge Notes #145 and #150 for the current vault custody references,
seal/update dates, and checksums. The latest artifacts must be mode `600`,
younger than the monitor threshold, and checksum-verified before a recovery
attempt.

## Safe recovery order

1. Keep the current device and its last known-good state intact.
2. Confirm the artifact timestamp, checksum, and vault custody reference.
3. Restore the gateway/AP only during a controlled local maintenance window.
4. Re-check management reachability, DHCP, DNS, Internet access, and AP bridge
   behavior from an independent client.
5. Record the result and retain the pre-change artifact for rollback.

An independent offline copy remains an open custody gate; the safe tabletop
restore drill below has been completed. This document does not claim an
isolated spare-hardware restore.

## Tabletop validation — 2026-09-20

The newest MikroTik text export and binary backup and the newest OpenWrt archive
and package manifest were re-hashed successfully. The OpenWrt archive passed a
gzip/tar integrity listing and contains the expected `/etc/config` recovery
files. The RouterOS export is non-empty, identifies RouterOS 7.20.1/E60iUGS,
and contains the expected interface, bridge, IP, DHCP, DNS, firewall, user and
system sections.

The recovery sequence above was walked through without applying configuration
to a live device. This satisfies the safe tabletop path; it does not substitute
for an isolated spare-hardware restore. The remaining material custody gap is
an independent offline copy and physical recovery reference.

## Change and review cadence

- Capture fresh gateway and AP artifacts after every material change.
- Verify freshness and checksums hourly while the encrypted vault is mounted.
- Reconcile topology and configuration documents after every network change.
- Review the record quarterly and after firmware, cutover or recovery events.
- Run the next tabletop or isolated-hardware drill by 2026-12-20.

## Fresh custody check — 2026-09-21

The hourly `network-backup-monitor.timer` completed successfully at
00:17 CEST. The newest MikroTik text export and binary backup plus the newest
OpenWrt archive and package manifest were present, mode `600`, within the
30-hour freshness window, and SHA-256 verified. The desktop user timer is
active and scheduled for the next hourly run.

This refresh does not close `NET-REC-07`: the encrypted vault is the primary
custody location, but an independently custodied offline copy and physical
recovery reference still require the owner’s action.
