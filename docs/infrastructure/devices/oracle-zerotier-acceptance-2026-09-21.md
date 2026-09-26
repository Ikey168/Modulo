# Oracle ZeroTier enrollment — 2026-09-21

## Result

The Oracle production host has joined the declared ZeroTier network at the
host level. The controller still requires owner authorization before assigning
an address.

| Field | Value |
| --- | --- |
| Canonical name | `prod-oracle` |
| Host | `modulo` / `141.147.5.114` |
| OS | Ubuntu 24.04, aarch64 |
| ZeroTier version | `1.16.2` |
| Node ID | `419271fdab` |
| Network | `88c5b1f339774e42` |
| Current state | `ACCESS_DENIED`; no assigned private address |

## Verified controls

- Enrollment used the protected production SSH path as `ubuntu`; no key was
  copied into the repository or exposed in Modulo.
- The official Ubuntu Noble repository was configured with the pinned
  ZeroTier signing-key fingerprint
  `74A5E9C458E1A431F1DA57A71657198823E52A61`.
- `zerotier-one` is enabled and active.
- The host joined network `88c5b1f339774e42`.
- ZeroTier managed addressing is enabled, while global routes, default-route
  replacement and DNS replacement are disabled.
- A second Ansible run converged with `changed=0`.
- Existing public SSH and production services were left unchanged.

## Owner action

In ZeroTier Central, authorize node `419271fdab` in network
`88c5b1f339774e42` and name it `prod-oracle`. After authorization, verify the
assigned private address and a key-based SSH session over ZeroTier. Do not
enable a production firewall restriction or retire public break-glass access
until that private path has been tested independently.
