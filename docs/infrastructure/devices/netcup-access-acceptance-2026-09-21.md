# Netcup access acceptance — 2026-09-21

## Current identity

| Field | Value |
| --- | --- |
| Canonical name | `dev-netcup` |
| Provider hostname | `v2202609388785525256.ultrasrv.de` |
| IPv4 | `185.162.249.37/22` |
| IPv6 | `2a03:4000:1a:36b:b438:5cff:fe84:c4f3` |
| OS | Debian GNU/Linux 13 (trixie), x86_64 |
| Intended role | Disposable remote development/build/agent compute |
| Named administrator | `ik` |

The provider hostname resolves to the observed IPv4. A trailing `1` in the
original pasted evidence was a citation marker, not part of the hostname.

## Verified controls

- Key-based SSH as `ik` succeeds; `ik` has UID 1000.
- `passwordauthentication no`, `kbdinteractiveauthentication no`,
  `pubkeyauthentication yes`, and `permitrootlogin no` are effective.
- The live RSA, ECDSA and ED25519 host-key fingerprints match the provider
  fingerprints supplied for this server.
- Docker is active and the `dev-netcup-health.timer` is enabled and active.
- Docker logs are bounded and a weekly timer removes unused artifacts older
  than seven days without pruning volumes.
- The reproducible Ansible profile installs the development toolchain, signed
  ZeroTier repository, automatic security updates, backup boundary and local
  monitoring. A repeated apply reports no configuration drift.
- The local `dev` SSH alias connects as `ik` using the dedicated host key.
- Modulo passed TypeScript checking, 591 frontend tests and a strict production
  build. A bounded backend run passed 170 tests in 28 classes and exercised
  Docker-backed PostgreSQL Testcontainers.
- Noesis initialized a private local workspace, passed all required doctor
  checks, ingested its deterministic quickstart document as
  `upload:6bc4778f7288`, and returned a cited answer from the local domain.
- A controlled reboot completed successfully. Named-user SSH, Docker,
  ZeroTier, unattended upgrades, both maintenance timers, the Noesis warehouse
  and its cited-answer path all survived; direct root SSH remained denied and
  no operating-system upgrades were pending.
- Debian 13 and the x86_64 architecture match the supplied provisioning
  record.
- ZeroTier is installed and online, but the intended private network currently
  reports `ACCESS_DENIED` and has assigned no address. This is an authorization
  gate, not a reason to move the server into the home-network role.

## Remaining gates

The named automation account has key-only `NOPASSWD: ALL` sudo so the complete
Ansible profile can be reapplied non-interactively. The provider console is the
independent recovery path. Authorize the host in the intended ZeroTier network,
verify private SSH, then enable the staged default-deny policy that exposes SSH
only on ZeroTier. A provider destroy/rebuild exercise still requires an
explicit maintenance window. Production credentials and authoritative personal
state remain forbidden on this host.

Customer numbers, account email, SCP identifiers, order/contract IDs and any
provider password are intentionally not copied into tasks, inventory or this
repository. Keep them in the protected provider/recovery record.

See [rebuild.md](rebuild.md), the canonical Netcup project in Modulo, and
[inventory.json](inventory.json) for role and recovery ownership.
