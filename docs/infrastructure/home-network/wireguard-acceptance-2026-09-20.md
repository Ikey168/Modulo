# WireGuard relay acceptance — 2026-09-20

## Result

The CGNAT-compatible site tunnel and remote-access policy are operational.
Oracle is the public WireGuard rendezvous; the MikroTik maintains the outbound
home-site session. Device-independent routing, DNS, isolation, restart,
failure, revocation and MTU tests passed from a temporary peer on an unrelated
Netcup network.

Laptop and phone enrollment remain separate physical-device tasks. No private
client key was created or retained on their behalf.

## Deployed components

| Component | Address | Role |
| --- | --- | --- |
| Oracle `wg-home` | `10.10.250.1/24`, UDP 51820 | Public rendezvous and restricted peer relay |
| MikroTik `wg-home` | `10.10.250.254/24` | Home site, DNS endpoint and policy boundary |
| Laptop reservation | `10.10.250.2/32` | Not enrolled |
| Phone reservation | `10.10.250.3/32` | Not enrolled |

The Oracle systemd service is enabled. OCI and the host INPUT chain allow UDP
51820. Oracle's forward policy allows only the MikroTik tunnel DNS endpoint
and Infrastructure destination. The MikroTik permits approved remote-peer
addresses to use tunnel DNS and Infrastructure, followed by an explicit
WireGuard default deny. No tunnel NAT or full-tunnel Internet route exists.

## Acceptance evidence

- The home peer established through the ISP's upstream NAT with a 25-second
  keepalive. Oracle could not initiate management access to the MikroTik.
- A temporary Netcup peer on public IPv4 `185.162.249.37` established to the
  Oracle endpoint independently of the home network.
- The external peer resolved `router.home.arpa`, `pi.home.arpa`,
  `paperless.home.arpa`, and a public name through `10.10.250.254`.
- `paperless.home.arpa` returned `10.10.20.10`; ICMP and TCP/22 to the Pi
  succeeded with roughly 20 ms round-trip time during the run.
- A do-not-fragment ICMP payload of 1392 bytes (1420-byte IP packet) traversed
  the tunnel successfully, matching the configured WireGuard MTU.
- Trusted, IoT, Guest, and RouterOS SSH attempts failed. The Oracle relay drop
  counter recorded the normal denials. A controlled temporary relay exception
  sent a Trusted-destination probe to the MikroTik, whose independent
  `wg: remote default deny` counter increased from 0 to 2.
- Restarting the external client re-established access. Stopping the Oracle
  service made access fail closed; after restart, both handshakes, Pi access,
  and local DNS recovered.
- Rebooting the MikroTik caused a measured 32-second interruption. The
  WireGuard interface, site peer, five policy rules, external Pi access and DNS
  all returned.
- Removing the temporary Netcup peer from Oracle immediately stopped its
  traffic. Its configuration/private key, Oracle peer entry, and MikroTik
  `10.10.250.10` authorization were then deleted. The home site peer stayed
  active.

## IPv6 boundary

The external test host has native IPv6, but the home network has no approved
routed IPv6 prefix yet. This split tunnel therefore advertises no IPv6 route;
it neither claims nor silently provides home IPv6 access. IPv6 remote-access
acceptance belongs to the Proper IPv6 Networking project.

## Remaining device gates

- Import and test the laptop's own keypair and `10.10.250.2/32` profile.
- Import and test the phone's own keypair and `10.10.250.3/32` profile over
  mobile data and Wi-Fi roaming.

Review the relay and public-peer inventory after any peer change, Oracle or
RouterOS firewall change, endpoint move, key rotation, or by 2026-12-20.
