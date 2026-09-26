# Home network administration — 2026-09-21

Status: live hardening applied; project Active pending independent recovery custody and acceptance.
Owner: IK. Owning Area: Security, Identity & Access; network operations supports the daily checks.

## Current administration

- MikroTik `192.168.88.1`: `ik-netadmin` accepts the desktop Ed25519 SSH key. Password SSH is rejected; default `admin` remains disabled. SSH strong crypto is enabled, forwarding is disabled. SSH/WinBox accept only Trusted `192.168.88.0/24`. FTP, Telnet, HTTP(S), API and API-SSL remain disabled. MAC Telnet is disabled; MAC WinBox and discovery are restricted to the TRUSTED interface list (VLAN 10).
- OpenWrt `192.168.88.2`: root SSH accepts the desktop key only and binds to the logical `lan` interface, currently IPv4 `192.168.88.2:22`. No wildcard or IPv6 SSH listeners remain. HTTP is disabled; HTTPS listens only at `127.0.0.1:443`. This closes the previous guest/IoT IPv6 link-local management exposure caused by wildcard listeners and no AP host firewall.
- OpenWrt web access: run `ssh -N -L 127.0.0.1:8443:127.0.0.1:443 root@192.168.88.2` from the desktop, then open `https://127.0.0.1:8443/`. The local certificate is self-signed. The SSH key is the access gate; root SSH password authentication remains disabled.
- MikroTik command line: `ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes ik-netadmin@192.168.88.1` from the desktop. Laptop operation currently uses the desktop as the administration host; the laptop's own key is deliberately not enrolled by this change.
- Trusted is the existing administration trust zone; this work does not claim per-device isolation inside it. IoT, Guest, Infrastructure and WireGuard clients do not receive router/AP administration. A separate Management VLAN remains deferred under the network segmentation design. Review Trusted membership before admitting an ordinary/untrusted device.
- Monitoring retains the separate `modulo-monitor` identity with read/test/SSH only and desktop source restriction. Backup capture still uses the full administration identity; moving it to a separately tested backup role is a remaining least-privilege acceptance item.

## Evidence

- Fresh desktop SSH-key sessions succeeded against both devices after changes.
- Correct MikroTik password SSH was rejected (exit 255). Unenrolled laptop keys were rejected by both devices (exit 255).
- From Pi Infrastructure `10.10.20.10`, TCP probes to both devices on 22/80/443/8291 all failed to connect.
- AP listeners after service restart: `192.168.88.2:22` and `127.0.0.1:443` only. Direct network HTTPS failed; HTTPS over a fresh SSH tunnel succeeded.
- MikroTik health/event collectors executed successfully with their separate key after strong crypto was enabled.
- Fresh post-change gateway text/binary and AP archive/package backups passed the hourly monitor: mode 600, SHA-256 match, fresh. Latest at initial verification: `20260921200926`.
- Pi service acceptance passed with zero failures.
- Saved UCI and RouterOS configuration inspected. Devices were not rebooted or factory-reset in this change. Fresh guest/IoT physical-client tests, an independent recovery exercise, and a reboot persistence check are still required for final project acceptance.

## Backup and credential custody

Daily captures remain in the existing encrypted Cryptomator vault at:
`/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)` on the desktop.

The MikroTik capture script now uses key authentication without sudo/sshpass or temporary password-file dependencies. Existing pre-change backups are retained. The existing MikroTik password remains available for WinBox recovery; it is not recorded in Modulo. The AP backup contains authorized public keys, not the corresponding client private key, so recovery must include separately protected client-key custody.

The owner confirmed on 2026-09-21 that no independently custodied offline copy or recovery credential exists yet. A recovery staging directory in the encrypted vault is preparation only, not an offline backup. Do not mark the project Done on that basis.

## Offline handoff and exercise

1. Use an encrypted removable drive or independently accessible encrypted repository. Keep its unlock method outside the desktop and outside the sole vault being recovered. Never put passwords/private keys in Modulo.
2. Copy the staged network recovery directory, current protected configuration backups, this runbook, and the topology/addressing/recovery documents. Retain at least one known-good prior version.
3. On a separate clean machine, unlock the copy using only the independent recovery material. Verify the recorded SHA-256 checksums and list the AP archive without restoring onto the live AP.
4. Connect directly to a Trusted access port (MikroTik ether3/ether5), using a non-conflicting static `192.168.88.x/24` address if DHCP is unavailable. Test key login to both devices using the recovered key; test MikroTik WinBox fallback. Protect and remove the temporary key copy after the exercise.
5. If configuration is lost, retain the failed device and perform a version/hardware-compatible restore during a local maintenance window. Restore the gateway first, then the AP; verify VLANs, DHCP, DNS, Internet, admin access and denied access from untrusted zones. Do not factory-reset live devices merely to prove this checklist.
6. Record the media/custody reference, date, independent unlock result, both login results and checksum result. Disconnect and store the copy separately. Supply only references and results to Modulo.

## Operations and incident response

Daily gateway/AP capture and hourly integrity timers remain the operational controls. IK reviews failed services and the desktop `~/.local/state/mikrotik-event-monitor/events.jsonl`; the controlled denied-login tests must appear in device/collector logs. Alert delivery outside the desktop remains owned by the monitoring project and is not claimed here.

If an administration key or trusted endpoint is suspected compromised: isolate that endpoint, enter through the independently tested recovery path, remove the affected authorized key on both devices, rotate the MikroTik fallback password if exposed, install a replacement key, test allowed and denied access, recapture backups, and refresh the offline copy. Preserve event evidence without publishing secrets. Until independent recovery is tested, removing the sole desktop key risks lockout.

Review quarterly (next 2026-12-21), after firmware/configuration changes, and after any lost device or credential incident. Refresh protected exports after each material change. Final acceptance must review ordinary-device access and the backup account's privileges, exercise recovery/revocation, and repeat guest/IoT tests; these are explicit remaining work, not inferred passes.

References: https://openwrt.org/docs/guide-user/base-system/dropbear ; https://openwrt.org/docs/guide-user/services/webserver/uhttpd ; https://help.mikrotik.com/docs/spaces/ROS/pages/8978504/User
