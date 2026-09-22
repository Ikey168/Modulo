# Current configuration record

Verified on 2026-09-20. This document intentionally excludes credentials,
private keys, Wi-Fi secrets, and full configuration exports.

## Devices and software

| Device | Role | Address | Software |
| --- | --- | --- | --- |
| MikroTik hEX S (`E60iUGS`) | IPv4 gateway, firewall, DHCP, DNS and NTP | `192.168.88.1` | RouterOS/RouterBOOT 7.20.1 stable |
| TP-Link Archer C6 v2 | Layer-2 access point | `192.168.88.2` | OpenWrt 24.10.5 |
| Raspberry Pi 5 | Local services | `10.10.20.10` | See service-specific operations records |
| Desktop | Administration and monitoring | `192.168.88.136` | Fedora workstation |
| Laptop | Trusted client | `192.168.88.254` | See endpoint inventory |

## Physical ports

| hEX S port | Current role |
| --- | --- |
| `ether1` | ISP handoff/WAN, DHCP client |
| `ether2` | Archer C6/OpenWrt tagged trunk for VLANs 10, 30 and 40 |
| `ether3` | Desktop, untagged Trusted access (PVID 10) |
| `ether4` | Raspberry Pi 5, untagged Infrastructure access (PVID 20) |
| `ether5` | Laptop, untagged Trusted access (PVID 10) |
| `sfp1` | Unused |

All five copper ports reported a 1 Gbit/s full-duplex link at verification.
Bridge VLAN filtering is active with five explicit rows: the four live zones
plus the AP's native rollback VLAN. Ingress filtering is enabled on every LAN
port; endpoint access ports reject tagged frames.

## Routing, DHCP and DNS

- The hEX S is the only observed IPv4 router and active DHCP server.
- Trusted retains `192.168.88.0/24`; Infrastructure, IoT and Guest use
  `10.10.20.0/24`, `10.10.30.0/24` and `10.10.40.0/24`. Each receives its own
  hEX gateway from a scoped DHCP server.
- Trusted and Infrastructure receive their zone gateway as DNS. The hEX
  forwards their public queries only to `1.1.1.1` and `9.9.9.9`; ISP-provided
  resolvers are disabled. Router DNS is not exposed to IoT, Guest, or WAN.
- IoT and Guest receive `1.1.1.1` and `9.9.9.9` directly. Classic UDP/TCP DNS
  to other Internet resolvers is dropped, while HTTPS remains available under
  each zone's normal egress policy. Encrypted DNS is not intercepted.
- Stable records verified include `router.home.arpa`, `ap-main.home.arpa`,
  `pi.home.arpa`, and service aliases such as `paperless.home.arpa`. Existing
  `.lan` names remain temporarily for compatibility; `.home.arpa` is the
  canonical local suffix.
- The trusted SSIDs map to VLAN 10. The IoT SSID maps to VLAN 30 and Guest maps
  to VLAN 40 on both radios where configured.
- Fixed/currently named address records include the Archer (`192.168.88.2`),
  Pi (`10.10.20.10`), desktop (`192.168.88.136`) and laptop
  (`192.168.88.254`).
- OpenWrt uses a static LAN address, has LAN DHCP ignored, has no DNS listener,
  and has `odhcpd` and the local firewall service disabled. It is not a second
  routing, DHCP, DNS, or firewall authority.

## Wireless baseline

- Both Archer C6 radios use the `DE` regulatory domain.
- The 2.4 GHz radio uses channel 6 at 20 MHz; the 5 GHz radio uses channel 36
  at 40 MHz. An anonymous local scan supported retaining these conservative,
  compatibility-oriented settings.
- Both current trusted SSIDs use WPA3-SAE. WPS is disabled, SSIDs are broadcast,
  and transmit power remains at the driver's regulatory default.
- The IoT and Guest credentials are unique and retained in the desktop Secret
  Service rather than PARA. Both use WPA2/WPA3 compatibility for client
  support; Guest and IoT wireless client isolation is enabled.
- OpenWrt SSH accepts the desktop administration key only. Empty-password,
  password and keyboard-interactive authentication are disabled; the key is
  included in the protected OpenWrt configuration backup.

## WAN and firewall intent

- `ether1` receives `172.29.2.201/30` with upstream gateway `172.29.2.202`.
- The observed public IPv4 is upstream of the hEX, so direct inbound service is
  not assumed. IPv6 remains enabled in RouterOS but the ISP currently supplies
  no global address, DHCPv6-PD lease, delegated prefix, or default IPv6 route.
  No NAT66, transition tunnel, ULA LAN prefix, or IPv6 RA/DNS advertisement is
  active.
- The live RouterOS baseline permits established/related traffic, drops invalid
  and unsolicited WAN traffic, restricts router management to the trusted LAN,
  and masquerades IPv4 egress.
- SSH and WinBox are the retained router administration paths. FTP, Telnet,
  WebFig/HTTP, API, and API-SSL are disabled.
- Trusted may initiate to Infrastructure and the Internet. Infrastructure may
  use router DNS and the Internet but cannot initiate to Trusted. Guest can use
  approved public DNS and the Internet but cannot reach local zones or router
  management. IoT can use approved public DNS, router NTP, and Internet
  HTTP(S), with other forwarding denied. Established replies are allowed; all
  other new segmented forwarding is dropped.

## Deferred configuration

IPv6 prefix delegation, per-zone RA/DHCPv6, mDNS reflection, network-wide
filtering and a separate Management VLAN are not active. The IPv6 stack is
retained but intentionally has no global path; its rollout is gated on a real
ISP prefix. Remote-client DNS belongs to the WireGuard project. Their project
plans must not be interpreted as live configuration.
