# Addressing

## Live networks

| VLAN | Purpose | Network / gateway | Current fixed references |
| --- | --- | --- | --- |
| 10 | Trusted clients and administration | `192.168.88.0/24`, gateway/DNS `192.168.88.1` | AP `.2`, desktop `.136`, laptop `.254` |
| 20 | Infrastructure and local services | `10.10.20.0/24`, gateway/DNS `10.10.20.1` | Raspberry Pi `10.10.20.10` |
| 30 | IoT devices | `10.10.30.0/24`, gateway `10.10.30.1`; DNS `1.1.1.1`, `9.9.9.9` | Dynamic pool `.100`–`.199` |
| 40 | Guest clients | `10.10.40.0/24`, gateway `10.10.40.1`; DNS `1.1.1.1`, `9.9.9.9` | Dynamic pool `.100`–`.199` |

VLAN 10 deliberately retained the former trusted-LAN subnet. This preserved
known management references and client leases while still adding an explicit
tag and trust boundary. The separate Management VLAN 99 remains deferred.

## Private overlay references

| Device | ZeroTier address |
| --- | --- |
| Pi 5 | `10.165.78.10` |
| Desktop | `10.165.78.30` |

Do not add credentials or private keys to this file. WireGuard
`10.10.250.0/24` remains a proposal until the remote-access project passes its
acceptance tests.
