# OpenWrt access-point acceptance — 2026-09-20

## Result

The TP-Link Archer C6 v2 running OpenWrt 24.10.5 is accepted for its current
role as the untagged home Wi-Fi access point. It bridges wireless clients to
the MikroTik-controlled LAN and does not provide routing, NAT, DHCP, DNS or a
second firewall authority.

VLAN trunking, IoT/Guest SSIDs and their isolation are not part of this
acceptance. Those controls remain in the `Segment the Home Network` project,
where both ends of the trunk and the MikroTik firewall can be changed and
tested together.

## Configuration and security review

| Control | Verified state |
| --- | --- |
| Management | Static `192.168.88.2/24` on the trusted untagged LAN |
| Ethernet | 1 Gb/s full-duplex backhaul through MikroTik `ether2`; zero RX/TX errors |
| Router services | No masquerade rules; `dnsmasq`, `odhcpd` and OpenWrt firewall services stopped |
| DHCP authority | MikroTik remains the sole observed authority; OpenWrt LAN DHCP is ignored |
| Wi-Fi security | WPA3-SAE on both trusted SSIDs; WPS disabled; SSIDs broadcast |
| Regulatory policy | `DE` configured on both radios and retained after reboot |
| 2.4 GHz | Channel 6, HT20, driver-default regulatory power |
| 5 GHz | Channel 36, VHT40, driver-default regulatory power |

The 2.4 GHz channel is intentionally 20 MHz. An anonymous local scan found a
dense radio environment; among the non-overlapping 2.4 GHz choices, channel 6
had materially weaker competing transmitters than channels 1 and 11. Channel
36 remains a conservative non-DFS 5 GHz compatibility choice. No client or
network identifiers were retained from the scan.

## Client and performance evidence

A temporary WPA3 client profile on the desktop's 2.4 GHz adapter received
`192.168.88.127/24` with gateway and DNS `192.168.88.1` from MikroTik. The
profile and its locally stored credential were removed after testing.

- 20 packets to the wired Raspberry Pi: 0% loss, 4.8 ms average latency,
  22.5 ms maximum during the pre-reboot test.
- Sustained client-to-Pi transfer: 17.6 Mb/s.
- Sustained Pi-to-client transfer: 32.1 Mb/s.
- Loaded client link: -23 dBm signal, 78 Mb/s transmit link rate.
- A separate associated 2.4 GHz client showed a strong -29 dBm average signal
  and a 144.4 Mb/s bidirectional link rate during observation.

The available desktop adapter is 2.4 GHz-only, so this record makes no invented
5 GHz throughput claim and no room-by-room coverage claim. Both AP radios were
operational before and after restart. The existing user-confirmed household
Wi-Fi service plus the measured loss, latency and throughput support retaining
the AP for current use.

## Restart and recovery acceptance

- A fresh `sysupgrade -b` archive and installed-package manifest were captured
  before the policy change.
- Restart requested: `2026-09-20T21:57:17+02:00`.
- AP loss first observed: `2026-09-20T21:57:22+02:00`.
- SSH and management reachability restored: `2026-09-20T21:58:18+02:00`.
- Observed interruption: 61 seconds from the restart request.
- After restart, both radios, the bridge and Ethernet backhaul were healthy;
  the client renewed through MikroTik and reached the gateway with 0% loss.
- A fresh post-restart archive and package manifest were captured, with the
  archive checksum stored alongside it in encrypted custody.

## Replacement and next-review triggers

Keep the Archer while current devices remain stable. Reconsider placement or
replace it only when measured evidence shows one of these conditions:

- repeated disconnects or packet loss on normal clients;
- inadequate signal in an actually used room;
- insufficient throughput for a concrete household workload;
- failure to carry the VLAN trunk or isolate Guest/IoT traffic when the
  segmentation project is implemented;
- firmware support or security updates end.

Review after segmentation, a material firmware/radio change, a reported
coverage problem, or by 2026-12-20—whichever occurs first.
