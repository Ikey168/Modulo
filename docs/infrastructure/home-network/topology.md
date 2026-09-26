# Topology

```text
Internet / ISP
      |
MikroTik hEX S 192.168.88.1
  | ether2 trunk             | ether3       | ether4          | ether5
  | VLAN 10/30/40            | VLAN 10      | VLAN 20         | VLAN 10
  |                          |              |                 |
Archer C6/AP .2          desktop .136   Pi 10.10.20.10   laptop .254
  | Trusted SSIDs → VLAN 10
  | IoT SSID      → VLAN 30
  ` Guest SSID    → VLAN 40
```

The hEX is the only observed DHCP and routing authority. The Archer is a
VLAN-aware bridge and does not provide NAT, routing or DHCP. The Trusted and
Infrastructure access ports are untagged at the endpoint and classified by
their PVID. The AP uplink carries Trusted, IoT and Guest as tagged VLANs.

## Trust boundaries

- Trusted administrative devices may manage the gateway, AP, and Pi.
- The WAN must not expose RouterOS, LuCI, SSH, WinBox, or internal services.
- IoT and Guest cannot initiate traffic to Trusted, Infrastructure or router
  management. Guest has Internet access; IoT egress is limited to DNS/NTP at
  the router and HTTP(S) toward the Internet.
- ZeroTier is the current private overlay reference. Tailscale remains present
  until an owner-approved dependency-aware migration is completed.
