# IPv6 acceptance — 2026-09-20

## Result

IPv6 is not disabled in RouterOS, but the current ISP path supplies no usable
global IPv6 service. The home network therefore has no routed IPv6 path to
secure or expose. The safe state is fail-closed: no prefixes are invented, no
router advertisements are emitted for nonexistent networks, no NAT66 or
transition tunnel is enabled, and the existing IPv4/WireGuard policies remain
the reachable paths.

This closes the measurement and fallback/recovery work. Prefix allocation,
RouterOS PD, per-VLAN RA/DHCPv6, explicit dual-stack firewall rules, and
dual-stack service testing remain gated on a real delegated prefix or an
approved transition design.

## Measured state

| Surface | Evidence | Result |
| --- | --- | --- |
| MikroTik IPv6 stack | `disable-ipv6=no`, forwarding enabled | Stack retained; no global route |
| WAN `ether1` | Link-local only (`fe80::/64`) | No ISP global address |
| DHCPv6-PD | `/ipv6/dhcp-client` has no client/lease | No delegated prefix |
| IPv6 routing | Only loopback and link-local connected routes | No default IPv6 route |
| Trusted desktop | Link-local only on the physical LAN; no global address or IPv6 Internet | No home global path |
| Raspberry Pi | Link-local on `eth0`; Tailscale ULA is overlay-only | No ISP global path |
| OpenWrt AP | Link-local bridge/uplink addresses only | No IPv6 router or RA authority |

RouterOS still has its standard ICMPv6, neighbor-discovery and DHCPv6-PD
input allowances, plus default-deny handling for traffic not arriving from
the LAN. Since no global prefix exists, those rules cannot create an externally
reachable service. No IPv6 address was added to a VLAN, WireGuard, or service.

## Deliberate plan gate

When the ISP supplies a stable delegated prefix, use one `/64` per active
zone—Trusted, Infrastructure, IoT and Guest—and reserve a separate `/64` for
the WireGuard path if remote IPv6 is approved. The exact prefix remains a
provider value, not a placeholder stored in configuration. Use SLAAC/RA for
ordinary clients, add DHCPv6 only where a tested client requirement justifies
it, and advertise DNS deliberately per zone. Never use NAT66 as the security
boundary.

Before enabling advertisements, add explicit IPv6 input and forward policy
that mirrors the IPv4 trust model: required ICMPv6/ND and DHCPv6-PD, established
traffic, approved Trusted/Infrastructure egress, narrow IoT/Guest egress, and
default-deny inter-zone/WAN management. Validate Linux, Android, OpenWrt and
WireGuard behavior from real clients, including prefix renewal and reboot.

## Fallback and recovery

- IPv4 remains the only home Internet path; no application depends on an
  unavailable IPv6 address.
- WireGuard deliberately advertises no IPv6 route. Its IPv4 relay and home
  policies remain independent of this project.
- A future prefix change must be handled by updating the PD-derived VLAN
  addresses and RA state, then retesting DNS, services, firewall isolation and
  backups. Do not copy a stale delegated prefix into static records.
- The current RouterOS configuration is covered by the encrypted MikroTik
  export captured after the network/WireGuard changes. Restore the IPv4-only
  baseline if a future IPv6 rollout is rolled back.

## Acceptance evidence

- RouterOS returned no DHCPv6 client, no delegated prefix, no global address,
  and no default IPv6 route after the controlled gateway reboot.
- The desktop had no global IPv6 address and `curl -6` could not reach an
  external IPv6 endpoint.
- The Pi's only non-link-local IPv6 was a Tailscale ULA on its overlay; its
  Infrastructure Ethernet interface had no global IPv6 path.
- OpenWrt had only link-local addresses on its bridges and uplink, with no
  IPv6 forwarding or RA service acting as a second router.
- No NAT66, static transition tunnel, ULA LAN prefix, or IPv6 DNS advertisement
  was introduced.

Review after an ISP service change, a delegated prefix appearing, enabling
IPv6 on the remote-access path, or by 2026-12-20.
