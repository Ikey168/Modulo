# WireGuard inventory and recovery

Verified on 2026-09-20: an Oracle rendezvous now connects the CGNATed home
MikroTik to future individually revocable remote clients. The persistent site
link is active; no laptop or phone peer has been enrolled yet.

## Public inventory

| Peer | Tunnel address | Public key | Permitted routes | State |
| --- | --- | --- | --- | --- |
| Oracle relay | `10.10.250.1/24` | `DzxJnadZGSesa0jc8oIVFVWbTgRypb+mpB1UoVlkxCA=` | Relay endpoint; no direct home-management initiation | Active |
| MikroTik home site | `10.10.250.254/24` | `iHWs9UpapOQ7MKlpUpGVh6V5lPQ2cisF7LApG8xXYUQ=` | Infrastructure routes behind the site peer | Active |
| Laptop | reserved `10.10.250.2/32` | Not enrolled | DNS plus `10.10.20.0/24` only | Waiting for device import/test |
| Phone | reserved `10.10.250.3/32` | Not enrolled | DNS plus `10.10.20.0/24` only | Waiting for device import/test |

The one-time Netcup acceptance peer used `10.10.250.10/32`. Its revocation was
tested, then its relay peer, private key, configuration and MikroTik address
authorization were removed. It is not an active credential.

For every future device, record:

- owner and device label;
- public key only;
- assigned address and allowed routes;
- creation, rotation and revocation dates;
- safe reference to protected private configuration custody;
- last acceptance-test date.

Never place a private key or complete client configuration in this repository
or in ordinary Modulo task text.

## Architecture and policy

The MikroTik cannot accept assumed direct inbound traffic because its WAN
address is private. It therefore maintains a 25-second-keepalive WireGuard
session to the Oracle public endpoint on UDP 51820. OCI and the Oracle host
firewall expose only that UDP port for this service; the relay has no access to
RouterOS, Trusted, IoT, or Guest management paths.

Remote peers use a split tunnel. The initial allow set is:

- DNS and diagnostic ICMP to the MikroTik tunnel address
  `10.10.250.254`;
- Infrastructure `10.10.20.0/24`;
- no Trusted `192.168.88.0/24`, IoT `10.10.30.0/24`, Guest
  `10.10.40.0/24`, or default Internet route.

The Oracle relay drops other peer-to-peer forwarded traffic. The MikroTik
independently applies an explicit `wg: remote default deny` after the approved
Infrastructure rule. No NAT is used inside the tunnel, so home services see
the individually assigned remote-peer address.

## Enrolling a device

1. Generate the private key on the laptop or phone where possible. Keep the
   private configuration in that device's protected secret boundary.
2. Assign the reserved `/32`, add only its public key to the Oracle
   `wg-home` interface, and add the address to the MikroTik
   `WG_REMOTE_CLIENTS` list.
3. Configure endpoint `141.147.5.114:51820`, DNS `10.10.250.254`, and split
   routes `10.10.250.254/32,10.10.20.0/24`. Do not add a default route.
4. Test from mobile data or an unrelated network: handshake, local and public
   DNS, an approved Pi service, denial of RouterOS/Trusted/IoT/Guest, reconnect,
   and the device-specific sleep/roaming behavior.
5. Record only the public key, owner, assigned address, acceptance date and
   safe private-configuration custody reference here.

## Revocation and recovery

For a lost or retired device, first remove its public peer from Oracle, then
remove its address from `WG_REMOTE_CLIENTS`. Confirm that traffic stops before
deleting the protected device configuration. Other peer entries are not
changed. A replacement device always receives a new keypair.

The Oracle configuration lives at `/etc/wireguard/wg-home.conf`, mode 0600,
and `wg-quick@wg-home.service` is enabled. Its secret-bearing backup and SHA-256
sidecar are stored only in encrypted custody. Capture them with
`scripts/wireguard-relay-backup-capture.sh`; capture the MikroTik side with
`scripts/mikrotik-backup-capture.sh`.

Restore order:

1. restore the Oracle configuration and enable/start `wg-quick@wg-home`;
2. restore the MikroTik configuration or recreate `wg-home`, its address,
   Oracle peer and firewall/address-list policy;
3. confirm the site handshake before adding client peers;
4. add one client at a time and repeat positive and negative acceptance tests.

Stopping the Oracle service was verified to fail closed. After restart, the
home keepalive and external peer re-established the tunnel without exposing a
fallback management service. The MikroTik was also rebooted after deployment;
the interface, peer, policy and external DNS/Infrastructure access returned.

## Acceptance record

See [wireguard-acceptance-2026-09-20.md](wireguard-acceptance-2026-09-20.md).
