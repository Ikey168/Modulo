# Device inventory verification — 2026-09-20

## Result

The six-device role model, trust boundaries, lifecycle ownership, state
authorities and rebuild procedures are implemented as non-secret versioned
artifacts. Structural validation passes. Full project acceptance does not pass
because four devices lack complete runtime evidence and the two verified hosts
retain documented state/recovery gaps.

## Live evidence

| Device | Evidence | Result |
| --- | --- | --- |
| Desktop | Local OS, kernel, architecture, firewall, SSH service, LAN and ZeroTier inspection | Fedora 44/x86_64; firewall active; inbound SSH disabled; `desktop` on LAN and ZeroTier |
| Desktop | Repository authority audit under the active workspace roots | 25 repositories; 18 have dirty worktrees. `audit-targets/citrea-hp` and `audit-targets/cronos-zkevm` have no configured remote and contain modified/generated analysis state, so endpoint-disposability is not accepted |
| Laptop | MikroTik DHCP observation and direct reachability probe | `ik-note` observed on the LAN; device was asleep/unreachable and SSH was unavailable during review |
| Phone | MikroTik DHCP class observation | Android client observed; physical-device controls, backup/export state and ZeroTier remain owner evidence |
| Pi 5 | Key-based live inspection over the trusted LAN | Debian 13/aarch64; `pi5`; LAN and ZeroTier verified; declared private services running |
| Pi 5 | SSH policy and negative paths | readable effective configuration explicitly enables public keys and disables password, keyboard-interactive and root login; password-only and root-key attempts from the desktop were denied |
| Netcup | Local SSH/config and prior evidence review | no verified host profile, runtime, private-network membership or provider lifecycle evidence |
| Oracle | Key-based live host, SSH, process, package and container inspection | Ubuntu 24.04/aarch64; public-key authentication enabled; password, keyboard-interactive and root login disabled; no development or agent toolchain found; only the Modulo/Noesis production stack and its Keycloak, Neo4j, Praxis and Caddy dependencies are running |
| Oracle | Private-network inspection | ZeroTier is absent; the required private-network membership is not implemented |

No password, private key, token, recovery code, private-network credential,
device unlock material or provider credential was copied into these artifacts.

## Automated checks

The structural validator passed with exactly six unique IDs, canonical names and
target roles. Negative tests correctly rejected a duplicate canonical name and
a private-key field. Strict evidence mode correctly failed with six warnings;
this is the intended acceptance behavior while any inventory gap remains.

## Recovery and operations review

- Owner: account owner.
- Cadence: quarterly and after device replacement, role, network, authority or
  access changes.
- Rollback: inventory/documentation changes are versioned and do not reconfigure
  a device. Runtime changes require a device-specific rollback and maintenance
  decision.
- Failure handling: preserve state, revoke a lost identity when appropriate,
  rebuild from the role profile, restore only from named authorities, and retire
  old access after acceptance.
- Monitoring: service hosts retain their existing health/backup monitors;
  endpoints require periodic inventory and update review rather than permanent
  content collection.

## Acceptance blockers

1. Wake and inspect the laptop; verify OS, encryption, ZeroTier, SSH, update and
   backup/sync state.
2. Inspect the physical phone; verify update, protection, ZeroTier if retained,
   exports/backups and recovery-factor custody.
3. Establish and verify the Netcup development host/access profile, then prove a
   disposable rebuild and representative Modulo/Noesis development workflow.
4. Add Oracle to the selected private network under its permanent logical name,
   then exercise a protected immutable-image release through the documented
   CI/CD promotion path and an independently authenticated off-host restore.
5. Classify the desktop's two no-remote repositories and dirty working state.
6. Complete the Pi service-specific clean recovery gates.
