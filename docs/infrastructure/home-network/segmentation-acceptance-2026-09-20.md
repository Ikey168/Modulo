# Home-network segmentation acceptance — 2026-09-20

## Result

The home network now has four active trust zones enforced by the MikroTik hEX S
and carried to the OpenWrt AP over an explicit tagged trunk. Positive access,
negative isolation, access-port tag rejection and reboot-persistence checks
passed.

Trusted VLAN 10 deliberately retains `192.168.88.0/24`. Renumbering trusted
clients would have added outage and dependency risk without improving the trust
boundary. Infrastructure, IoT and Guest use the planned `10.10.20.0/24`,
`10.10.30.0/24` and `10.10.40.0/24` networks.

## Live topology

| VLAN | Zone | Gateway / DNS | Attachment |
| --- | --- | --- | --- |
| 10 | Trusted | `192.168.88.1` | Desktop and laptop access ports; trusted AP SSIDs |
| 20 | Infrastructure | `10.10.20.1` | Raspberry Pi access port; Pi reservation `.10` |
| 30 | IoT | `10.10.30.1` / `1.1.1.1`, `9.9.9.9` | Tagged AP trunk and isolated IoT SSID |
| 40 | Guest | `10.10.40.1` / `1.1.1.1`, `9.9.9.9` | Tagged AP trunk and isolated Guest SSID |

MikroTik `ether2` carries VLANs 10, 30 and 40 to the Archer C6. `ether3` and
`ether5` are untagged Trusted access ports with PVID 10; `ether4` is an
untagged Infrastructure access port with PVID 20. Ingress filtering is enabled,
and endpoint access ports accept only untagged or priority-tagged frames.

The OpenWrt switch tags VLANs 10, 30 and 40 on the physical uplink and CPU
port. Separate `br-trusted`, `br-iot` and `br-guest` bridges bind the Ethernet
VLAN devices to their wireless interfaces. OpenWrt still provides no DHCP,
DNS, NAT, routing or firewall authority.

## Firewall policy

| Source | Allowed new traffic | Denied new traffic |
| --- | --- | --- |
| Trusted | Infrastructure and Internet; router/AP management | IoT/Guest unless a future explicit need is approved |
| Infrastructure | Internet; router DNS/DHCP and diagnostic ICMP | Trusted initiation and router management |
| IoT | Router DHCP/NTP; approved public DNS; Internet HTTP(S) | Trusted, Infrastructure, Guest, router management and alternate classic DNS |
| Guest | Router DHCP; approved public DNS and Internet | All local zones, router management and alternate classic DNS |

Established and related replies are allowed. Invalid traffic and every other
new flow from a segmented interface are dropped. IPv6 has no delegated prefix
or global path and remains owned by the IPv6 project.

## Credential and wireless controls

The IoT and Guest WPA credentials were generated independently and stored in
the desktop Secret Service under the `modulo-home-network` service boundary.
They are not present in PARA, documentation, shell output or task records.
OpenWrt's encrypted-custody backup contains the device configuration needed for
recovery.

Trusted uses WPA3-SAE. IoT and Guest use WPA2/WPA3 compatibility for practical
client support. WPS remains disabled. Wireless client isolation is enabled on
the IoT and Guest interfaces. A second simultaneous Guest client was not
available for a peer-to-peer runtime attempt; the hostapd isolation setting and
the routed zone-denial tests were verified, and a two-client peer check is due
when a second real Guest client is first enrolled.

The management review also found that OpenWrt initially accepted SSH `none`
authentication because root had no password and no authorized key. The desktop
administration public key is now installed explicitly, Dropbear password/root-
password authentication is disabled, `none` authentication is rejected, and a
forced public-key-only login succeeds. This was verified after restarting
Dropbear and is included in the final recovery archive.

## Acceptance evidence

- A temporary tagged management path reached both the MikroTik and OpenWrt
  before bridge VLAN filtering was enabled.
- A real Trusted wireless client received `192.168.88.127/24` from MikroTik
  after the trusted SSIDs moved to VLAN 10.
- The Raspberry Pi renewed onto Infrastructure as `10.10.20.10`, resolved DNS,
  reached HTTPS, and remained reachable from Trusted.
- A real IoT wireless client received `10.10.30.100/24`; approved public DNS
  and HTTPS worked, while router DNS/SSH, alternate classic DNS, Trusted and
  Infrastructure were unreachable.
- A real Guest wireless client received `10.10.40.100/24`; approved public DNS
  and HTTPS worked, while router DNS/SSH, alternate classic DNS, Trusted and
  Infrastructure were unreachable.
- An Infrastructure-initiated attempt toward Trusted was denied and increased
  the MikroTik default-deny counter.
- A tagged VLAN 30 frame sent through the desktop Trusted access port was
  rejected, demonstrating access-port ingress enforcement.
- Trusted DNS, Internet and Infrastructure access passed with zero packet loss
  to the Pi during the acceptance run.
- Router/AP administration succeeded from Trusted and failed from
  Infrastructure, IoT and Guest.
- Pi and service DNS records now resolve to `10.10.20.10`.

## Restart and recovery

Fresh MikroTik text/binary and OpenWrt configuration/package artifacts were
captured before cutover and again after the segmented configuration existed.
The OpenWrt archive checksum sidecars verified in encrypted custody.

- AP restart requested at `2026-09-20T23:05:23+02:00`; management returned in
  68 seconds with all three bridges and five radio interfaces active.
- Gateway restart requested at `2026-09-20T23:06:43+02:00`; reachability
  returned in 38 seconds with bridge filtering, five VLAN rows, four DHCP
  servers and the segmented firewall rules intact.
- Post-reboot real-client tests again obtained IoT and Guest leases, reached
  HTTPS and could not reach router SSH. The later DNS acceptance run changed
  those leases to the approved public resolvers and repeated the client tests.
- Home-network, MikroTik, and AP/Pi health probes all passed after addresses
  and bridge expectations were updated.

Review the policy after adding the first real IoT device, when enabling IPv6 or
WireGuard, after a topology/firewall change, or by 2026-12-20.
