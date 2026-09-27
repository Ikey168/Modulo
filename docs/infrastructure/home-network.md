# Home network

The versioned, non-secret record of the home network: topology, addressing,
trust zones, live configuration, administration, WireGuard remote access,
monitoring, and backup/recovery. It is for the owner when changing, operating or
restoring the network. Passwords, private keys, Wi-Fi secrets, ISP credentials
and configuration exports never belong here; their custody references and
checksums are tracked in Modulo Knowledge notes #145 (OpenWrt) and #150
(MikroTik). Acceptance evidence for everything below is in
[records.md](records.md).

## Components

| Device | Role | Address | Software |
| --- | --- | --- | --- |
| MikroTik hEX S (`E60iUGS`) | only IPv4 gateway, firewall/NAT, DHCP, DNS forwarder and NTP authority | `192.168.88.1` | RouterOS/RouterBOOT 7.20.1 stable |
| TP-Link Archer C6 v2 | Layer-2 VLAN-aware access point; no routing, NAT, DHCP, DNS or firewall | `192.168.88.2` | OpenWrt 24.10.5 |
| Raspberry Pi 5 (`pi5` / `home-pi`) | local services and records host | `10.10.20.10` | Debian 13 (see [devices](devices.md)) |
| Desktop | administration and monitoring host | `192.168.88.136` | Fedora workstation |
| Laptop | trusted wired client | `192.168.88.254` | see [devices](devices.md) |

## Topology

```text
Internet / ISP (CGNAT upstream)
      |
MikroTik hEX S 192.168.88.1  (ether1 WAN)
  | ether2 trunk             | ether3       | ether4          | ether5
  | VLAN 10/30/40 tagged     | VLAN 10      | VLAN 20         | VLAN 10
  |                          |              |                 |
Archer C6 AP .2          desktop .136   Pi 10.10.20.10   laptop .254
  | Trusted SSIDs -> VLAN 10
  | IoT SSID      -> VLAN 30
  ` Guest SSID    -> VLAN 40
```

| hEX S port | Role |
| --- | --- |
| `ether1` | ISP handoff/WAN, DHCP client (`172.29.2.201/30`, upstream gateway `172.29.2.202`) |
| `ether2` | Archer C6 tagged trunk for VLANs 10, 30, 40 |
| `ether3` | Desktop, untagged Trusted (PVID 10) |
| `ether4` | Raspberry Pi 5, untagged Infrastructure (PVID 20) |
| `ether5` | Laptop, untagged Trusted (PVID 10) |
| `sfp1` | Unused |

All copper ports linked at 1 Gbit/s full duplex at verification. Bridge VLAN
filtering is active with five explicit rows (the four zones plus the AP's native
rollback VLAN). Ingress filtering is on for every LAN port; endpoint access ports
accept only untagged or priority-tagged frames and reject tagged ones.

On the Archer, the switch tags VLANs 10, 30 and 40 on the uplink and CPU port;
separate `br-trusted`, `br-iot` and `br-guest` bridges bind each Ethernet VLAN to
its wireless interfaces. OpenWrt has a static LAN address, LAN DHCP ignored, no
DNS listener, and `dnsmasq`, `odhcpd` and its firewall service disabled.

## Addressing

| VLAN | Zone | Network / gateway | DNS handed out | Fixed references |
| --- | --- | --- | --- | --- |
| 10 | Trusted clients and administration | `192.168.88.0/24`, `192.168.88.1` | `192.168.88.1` | AP `.2`, desktop `.136`, laptop `.254` |
| 20 | Infrastructure and local services | `10.10.20.0/24`, `10.10.20.1` | `10.10.20.1` | Pi `10.10.20.10` |
| 30 | IoT | `10.10.30.0/24`, `10.10.30.1` | `1.1.1.1`, `9.9.9.9` | dynamic pool `.100`-`.199` |
| 40 | Guest | `10.10.40.0/24`, `10.10.40.1` | `1.1.1.1`, `9.9.9.9` | dynamic pool `.100`-`.199` |
| — | WireGuard | `10.10.250.0/24` | `10.10.250.254` | see [WireGuard](#wireguard-remote-access) |

VLAN 10 deliberately keeps the former trusted-LAN subnet: renumbering would have
added outage and dependency risk without improving the boundary. A separate
Management VLAN 99 is deferred.

Private overlay (ZeroTier) addresses: Pi `10.165.78.10`, desktop
`10.165.78.30`. ZeroTier is the current private overlay; Tailscale remains
present until an owner-approved, dependency-aware migration is completed.

## Trust zones and firewall

| Source | Allowed new traffic | Denied new traffic |
| --- | --- | --- |
| Trusted | Infrastructure and Internet; router/AP management | IoT/Guest unless an explicit need is approved |
| Infrastructure | Internet; router DNS/DHCP and diagnostic ICMP | initiating to Trusted; router management |
| IoT | router DHCP/NTP; approved public DNS; Internet HTTP(S) | Trusted, Infrastructure, Guest, router management, alternate classic DNS |
| Guest | router DHCP; approved public DNS and Internet | all local zones, router management, alternate classic DNS |
| WAN | nothing | RouterOS, LuCI, SSH, WinBox and all internal services |

Established/related replies are allowed; invalid traffic and every other new
flow from a segmented interface are dropped. IPv4 egress is masqueraded. The
public IPv4 is upstream of the hEX (CGNAT), so direct inbound service is never
assumed. Trusted is the administrative zone; there is no per-device isolation
inside it, so review Trusted membership before admitting an ordinary device.

## DNS and naming

- Trusted and Infrastructure use their zone gateway as resolver. The hEX
  forwards public queries only to `1.1.1.1` and `9.9.9.9`; ISP-supplied dynamic
  DNS is disabled, and there is no DoH server.
- IoT and Guest get `1.1.1.1` and `9.9.9.9` directly; classic UDP/TCP 53 to other
  resolvers is dropped. DoH/DoT is not intercepted, so this is a classic-DNS
  control, not complete resolver enforcement. Router DNS is not exposed to IoT,
  Guest or WAN.
- `home.arpa` is the canonical local suffix. The router holds A records for the
  gateway, AP, Pi, endpoints and Pi-hosted services (`router.home.arpa`,
  `ap-main.home.arpa`, `pi.home.arpa`, `paperless.home.arpa`, ...; service
  aliases resolve to `10.10.20.10`). `.lan` names remain as compatibility
  aliases until bookmarks and configurations migrate.
- No mDNS reflector (MikroTik mDNS repeat interfaces are empty; no cross-VLAN
  discovery need exists) and no AdGuard Home or network-wide filtering. Revisit
  only with a concrete requirement.
- DNSSEC validation is not claimed.
- Remote-client DNS belongs to WireGuard.

After any resolver-policy change, re-run one Trusted, Infrastructure, IoT, Guest
and WAN-negative test, and capture a fresh MikroTik export after any DNS, DHCP
or firewall change.

## Wireless

| Setting | Value |
| --- | --- |
| Regulatory domain | `DE` on both radios |
| 2.4 GHz | channel 6, HT20 (chosen after a local scan showed weaker competition than 1 and 11) |
| 5 GHz | channel 36, VHT40 (conservative non-DFS choice) |
| Transmit power | driver regulatory default |
| Trusted SSIDs | WPA3-SAE, VLAN 10 |
| IoT / Guest SSIDs | WPA2/WPA3 compatibility, VLAN 30 / 40, client isolation enabled |
| WPS | disabled; SSIDs broadcast |

IoT and Guest credentials are unique and stored in the desktop Secret Service
under the `modulo-home-network` service boundary, never in PARA, docs, shell
output or task records. A two-client Guest peer-isolation check is due when a
second real Guest client is first enrolled.

Keep the Archer while devices remain stable. Reconsider placement or replace it
only on measured evidence: repeated disconnects/loss on normal clients,
inadequate signal in a used room, insufficient throughput for a concrete
workload, failure to carry the VLAN trunk or isolate Guest/IoT, or end of
firmware/security updates.

## IPv6

RouterOS keeps its IPv6 stack (`disable-ipv6=no`, forwarding on), but the ISP
supplies no global address, DHCPv6-PD lease, delegated prefix or default route.
The network is deliberately fail-closed: no invented prefixes, no RA for
nonexistent networks, no NAT66, transition tunnel, ULA LAN prefix or IPv6 DNS
advertisement. IPv4 is the only home Internet path and WireGuard advertises no
IPv6 route. Standard ICMPv6/ND/DHCPv6-PD input allowances and default-deny for
non-LAN traffic remain.

When a stable delegated prefix appears:

1. Use one `/64` per active zone (Trusted, Infrastructure, IoT, Guest) and
   reserve one for WireGuard if remote IPv6 is approved. The prefix is a provider
   value; never store a placeholder or a stale prefix in static records.
2. Before enabling advertisements, add IPv6 input/forward policy mirroring the
   IPv4 model: required ICMPv6/ND and DHCPv6-PD, established traffic, approved
   Trusted/Infrastructure egress, narrow IoT/Guest egress, default-deny
   inter-zone and WAN management. Never use NAT66 as the security boundary.
3. Use SLAAC/RA for clients; add DHCPv6 only for a tested requirement; advertise
   DNS deliberately per zone.
4. Validate Linux, Android, OpenWrt and WireGuard from real clients, including
   prefix renewal and reboot.
5. On a later prefix change, update PD-derived addresses and RA state, then
   retest DNS, services, isolation and backups. To roll back, restore the
   IPv4-only baseline from the MikroTik export.

## Administration

Only the desktop administers the network devices; the laptop's own key is
deliberately not enrolled.

| Device | Access |
| --- | --- |
| MikroTik | `ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes ik-netadmin@192.168.88.1`. Key-only (password SSH rejected); default `admin` disabled; strong crypto on; SSH forwarding off. SSH/WinBox accept only `192.168.88.0/24`. FTP, Telnet, WebFig/HTTP(S), API, API-SSL and MAC Telnet disabled; MAC WinBox and discovery limited to the TRUSTED interface list. The MikroTik password is kept (not in Modulo) for WinBox recovery. |
| OpenWrt | Root SSH with the desktop key only, bound to the `lan` interface (`192.168.88.2:22`); no wildcard or IPv6 listeners; password, root-password, keyboard-interactive and `none` auth disabled. HTTP off; HTTPS only on `127.0.0.1:443`. Web UI: `ssh -N -L 127.0.0.1:8443:127.0.0.1:443 root@192.168.88.2`, then open `https://127.0.0.1:8443/` (self-signed). |
| Monitoring | Separate RouterOS account `modulo-monitor`, restricted to the desktop address and a group with only SSH, read and test policies. Its key is `~/.local/share/modulo/network-monitor/id_ed25519` (mode 600, outside PARA). |

Backup capture still uses the full administration identity; moving it to a
separately tested backup role is an open least-privilege item. IoT, Guest,
Infrastructure and WireGuard clients never receive router/AP administration.

### Suspected compromise of an admin key or trusted endpoint

1. Isolate the endpoint.
2. Enter through the independently tested recovery path.
3. Remove the affected authorized key on both devices; rotate the MikroTik
   fallback password if it may be exposed.
4. Install a replacement key and test allowed and denied access.
5. Recapture backups and refresh the offline copy.
6. Preserve event evidence without publishing secrets.

Until independent recovery is tested, removing the sole desktop key risks
lockout. For broader incidents use [incident response](../security/incident-response.md).

## WireGuard remote access

The MikroTik's WAN address is private, so it keeps an outbound session (25 s
keepalive) to an Oracle rendezvous on UDP 51820. OCI and the Oracle host
firewall expose only that port for this service. The relay has no access to
RouterOS, Trusted, IoT or Guest management.

| Peer | Tunnel address | Public key | Permitted routes | State |
| --- | --- | --- | --- | --- |
| Oracle relay (`wg-home`) | `10.10.250.1/24` | `DzxJnadZGSesa0jc8oIVFVWbTgRypb+mpB1UoVlkxCA=` | relay endpoint; cannot initiate home management | active |
| MikroTik home site (`wg-home`) | `10.10.250.254/24` | `iHWs9UpapOQ7MKlpUpGVh6V5lPQ2cisF7LApG8xXYUQ=` | Infrastructure behind the site peer | active |
| Laptop | reserved `10.10.250.2/32` | not enrolled | DNS plus `10.10.20.0/24` | waiting for device import/test |
| Phone | reserved `10.10.250.3/32` | not enrolled | DNS plus `10.10.20.0/24` | waiting for device import/test (mobile data and Wi-Fi roaming) |

The one-time Netcup acceptance peer (`10.10.250.10/32`) was revoked; its relay
peer, private key, configuration and MikroTik authorization were removed.

Policy: remote peers use a split tunnel allowing only DNS and diagnostic ICMP to
`10.10.250.254` and Infrastructure `10.10.20.0/24`; no Trusted, IoT, Guest or
default Internet route. The Oracle relay drops other forwarded peer traffic; the
MikroTik independently applies `wg: remote default deny` after the Infrastructure
rule. No NAT inside the tunnel, so home services see each peer's own address.
The tunnel MTU is 1420.

### Enrolling a device

1. Generate the private key on the device where possible and keep its config in
   that device's protected secret boundary.
2. Assign the reserved `/32`; add only its public key to Oracle `wg-home` and the
   address to the MikroTik `WG_REMOTE_CLIENTS` address list.
3. Configure endpoint `141.147.5.114:51820`, DNS `10.10.250.254`, allowed IPs
   `10.10.250.254/32,10.10.20.0/24`. No default route.
4. Test from mobile data or an unrelated network: handshake, local and public
   DNS, an approved Pi service, denial of RouterOS/Trusted/IoT/Guest, reconnect,
   sleep/roaming behaviour.
5. Record in the table above only: owner and device label, public key, address
   and routes, creation/rotation/revocation dates, safe custody reference for the
   private configuration, and last acceptance date. Never record a private key or
   full client config here or in ordinary Modulo task text.

### Revoking a device

Remove its peer from Oracle first, then its address from `WG_REMOTE_CLIENTS`.
Confirm traffic stops before deleting the protected device configuration. Leave
other peers unchanged. A replacement device always gets a new keypair.

### Restoring WireGuard

Oracle config: `/etc/wireguard/wg-home.conf` (mode 0600) with
`wg-quick@wg-home.service` enabled. Capture it with
[`scripts/wireguard-relay-backup-capture.sh`](../../scripts/wireguard-relay-backup-capture.sh)
(secret-bearing backup plus SHA-256 sidecar, encrypted custody only); the
MikroTik side is covered by the MikroTik capture.

1. Restore the Oracle configuration and enable/start `wg-quick@wg-home`.
2. Restore the MikroTik configuration, or recreate `wg-home`, its address, the
   Oracle peer and the firewall/address-list policy.
3. Confirm the site handshake before adding client peers.
4. Add one client at a time, repeating positive and negative tests.

Stopping the Oracle service fails closed; after restart the tunnel recovers
without any fallback management exposure.

## Monitoring

Metadata-only systemd user timers on the desktop. They never collect client
traffic, credentials, DNS query history or configuration contents.

| Check | Script | Cadence | State file | Covers |
| --- | --- | --- | --- | --- |
| Home-network path | [`home-network-monitor.sh`](../../scripts/home-network-monitor.sh) | 1 min | `~/.local/state/home-network-monitor/last.json` | gateway, AP, Pi, DNS, Internet reachability |
| MikroTik health | [`mikrotik-health-monitor.sh`](../../scripts/mikrotik-health-monitor.sh) | 5 min | `~/.local/state/mikrotik-health-monitor/last.json` | uptime, CPU, memory, storage, WAN counters/errors, DHCP, WireGuard |
| MikroTik events | [`mikrotik-event-monitor.sh`](../../scripts/mikrotik-event-monitor.sh) | 5 min | `~/.local/state/mikrotik-event-monitor/events.jsonl` | account, configuration, interface, DHCP-failure, VPN and severity events |
| AP/Pi health | [`ap-pi-monitor.sh`](../../scripts/ap-pi-monitor.sh) | 5 min | `~/.local/state/ap-pi-monitor/last.json` | AP bridge/radios/uplink, Pi services/storage |
| Backup integrity | [`network-backup-monitor.sh`](../../scripts/network-backup-monitor.sh) | 1 h | `~/.local/state/network-backup-monitor/last.json` | age, mode and checksum of gateway/AP backups |

The event collector keeps at most 2,000 deduplicated records, redacts MAC
addresses, excludes routine DHCP lease churn and its own SSH sessions. RouterOS
keeps the source ring buffer; the desktop copy survives ring rotation without
high-volume WAN-drop logging. Non-OK checks exit non-zero and log a concise
diagnostic. The owner reviews failed services and `events.jsonl`; controlled
denied-login tests must appear there.

Open monitoring gates:

- `NET-MON-06`: select and test an external, outage-resistant alert route
  (including recovery and deduplication). Until then a total home-site outage
  does not alert anyone.
- `NET-MON-07`: run controlled failure/tabletop cases once the route exists,
  without taking the live gateway or AP down unattended.
- `NET-MON-08`: reconcile Uptime Kuma on `pi5` (26 monitors, including stale
  targets such as the old Pi SSH address `192.168.88.135` and legacy `.zt`/Caddy
  targets), define its retention/backup and review cadence, and repeat
  acceptance.

## Backup and recovery

Secret-bearing network artifacts live only in the encrypted Cryptomator vault on
the desktop, at
`/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)`.
Modulo records only paths, version labels, timestamps and checksums. The repo
directories that once held MikroTik and OpenWrt placeholders intentionally held
no exports or archives.

| Artifact | Capture | Cadence |
| --- | --- | --- |
| MikroTik hide-sensitive `.rsc` export + binary `.backup` | [`scripts/mikrotik-backup-capture.sh`](../../scripts/mikrotik-backup-capture.sh) (key auth; no sudo/sshpass/password files) | daily, and after every material change |
| OpenWrt `sysupgrade -b` archive + installed-package manifest | [`scripts/openwrt-backup-capture.sh`](../../scripts/openwrt-backup-capture.sh) | daily, and after every material change |
| Freshness/mode/checksum | `network-backup-monitor.sh` | hourly while the vault is mounted |

Before any recovery attempt the latest artifacts must be mode `600`, within the
30-hour freshness window and SHA-256 verified. The AP backup contains authorized
public keys, not the desktop's private key, so recovery also needs the
separately protected admin key.

### Safe recovery order

1. Keep the current device and its last known-good state intact. Do not
   factory-reset a live device merely to prove the checklist.
2. Confirm the artifact timestamp, checksum and vault custody reference.
3. Restore only during a controlled local maintenance window, with a
   version/hardware-compatible artifact: gateway first, then AP.
4. From an independent client, re-check management reachability, VLANs, DHCP,
   DNS, Internet, AP bridge behaviour, admin access, and denied access from
   untrusted zones.
5. Record the result and keep the pre-change artifact for rollback.

If DHCP is unavailable, connect to a Trusted access port (MikroTik `ether3` or
`ether5`) with a non-conflicting static `192.168.88.x/24` address.

### Offline copy and handoff exercise (open gate NET-REC-07)

No independently custodied offline copy or recovery credential exists yet; a
staging directory inside the vault is preparation only. To close the gate:

1. Use an encrypted removable drive or independently accessible encrypted
   repository whose unlock method lives outside the desktop and outside the
   vault being recovered. Never put passwords or keys in Modulo.
2. Copy the staged network recovery directory, current protected configuration
   backups and this page. Keep at least one known-good prior version.
3. On a separate clean machine, unlock using only the independent recovery
   material, verify the SHA-256 checksums, and list the AP archive without
   restoring it.
4. Connect to a Trusted access port and test key login to both devices with the
   recovered key, plus MikroTik WinBox fallback. Protect and then remove the
   temporary key copy.
5. Record media/custody reference, date, independent-unlock result, both login
   results and checksum result. Disconnect and store the copy separately.

An isolated spare-hardware restore has not been performed; the tabletop drill
has.

## Change control and review

- Changes must be copy-first and reversible: capture a fresh hide-sensitive
  RouterOS export and OpenWrt archive before and after every material change,
  and keep an independent client available.
- A successful restart alone does not prove that DHCP, DNS, egress and WAN
  denial still work; re-run the gateway acceptance checks after gateway,
  firmware, firewall, DHCP, DNS or physical-topology changes.
- Reconcile this page after every network change. Review quarterly and after
  firmware, cutover, recovery, lost-device or credential events. Next reviews
  and the next tabletop or isolated-hardware drill were due by 2026-12-20
  (administration review 2026-12-21).
- Final administration acceptance still needs: fresh guest/IoT physical-client
  tests, an independent recovery/revocation exercise, a reboot persistence
  check, and review of ordinary-device access and the backup account's
  privileges.
- Review segmentation after adding the first real IoT device or enabling IPv6.
  Review WireGuard after any peer change, Oracle/RouterOS firewall change,
  endpoint move or key rotation.
