# Evidence records

The consolidated log of dated acceptance tests, verifications and recovery
drills for the owner's infrastructure and for local Modulo verification runs.
Each section records the date, scope, the checks or commands run, the results,
and any gates left open. Newest first; records from the same day are ordered by
their approximate run time. It is for the owner and reviewers who need to know
what has actually been proven, as opposed to what the design pages intend.

Records are append-only history: do not rewrite a past result when the system
changes; add a new record. Current state and procedures live in
[devices.md](devices.md), [home-network.md](home-network.md),
[data-lifecycle.md](data-lifecycle.md) and [recovery.md](recovery.md). Use the
[evidence-record fields](recovery.md#evidence-record) for new recovery entries.
No record contains credentials, private keys, tokens, recovery codes, message
bodies or document contents.

| Date | Record | Outcome |
| --- | --- | --- |
| 2026-09-22 | [Netcup clean development environment](#netcup-clean-development-environment-2026-09-22) | accepted; 4 repository follow-ups |
| 2026-09-22 | [Clean workstation bootstrap](#clean-workstation-bootstrap-2026-09-22) | accepted for CLI baseline; 8 parity gaps |
| 2026-09-21 | [Home-network administration hardening](#home-network-administration-hardening-2026-09-21) | applied; final acceptance open |
| 2026-09-21 | [Finance evidence review](#finance-evidence-review-2026-09-21) | tool accepted; 2 hash mismatches under review |
| 2026-09-21 | [Home-network monitoring](#home-network-monitoring-2026-09-21) | baseline healthy; NET-MON-06/07/08 open |
| 2026-09-21 | [Network backup custody check](#network-backup-custody-check-2026-09-21) | pass; NET-REC-07 open |
| 2026-09-21 | [Netcup access](#netcup-access-2026-09-21) | partial; ZeroTier authorization open |
| 2026-09-21 | [Oracle ZeroTier enrollment](#oracle-zerotier-enrollment-2026-09-21) | joined; controller authorization open |
| 2026-09-20 | [Device inventory verification](#device-inventory-verification-2026-09-20) | structure passes; strict evidence fails |
| 2026-09-20 | [Network recovery tabletop](#network-recovery-tabletop-2026-09-20) | pass (tabletop only) |
| 2026-09-20 | [IPv6](#ipv6-2026-09-20) | fail-closed state accepted; rollout gated |
| 2026-09-20 | [WireGuard relay](#wireguard-relay-2026-09-20) | pass; laptop/phone enrollment open |
| 2026-09-20 | [DNS and service discovery](#dns-and-service-discovery-2026-09-20) | pass |
| 2026-09-20 | [Network segmentation](#network-segmentation-2026-09-20) | pass |
| 2026-09-20 | [OpenWrt access point](#openwrt-access-point-2026-09-20) | pass |
| 2026-09-20 | [MikroTik gateway](#mikrotik-gateway-2026-09-20) | pass |
| 2026-09-20 | [Communication systems](#communication-systems-2026-09-20) | deployed; protocol gates open |
| 2026-09-20 | [Noesis research routing pilots](#noesis-research-routing-pilots-2026-09-20) | pass |
| 2026-09-20 | [Paperless off-site restore drill](#paperless-off-site-restore-drill-2026-09-20) | pass; 3 custody/alert gates open |
| 2026-09-09 | [Workspace connections verification](#workspace-connections-verification-2026-09-09) | pass (local) |
| 2026-09-08 | [Project workspaces verification](#project-workspaces-verification-2026-09-08) | pass (local) |
| 2026-09-08 | [Workspace tools verification](#workspace-tools-verification-2026-09-08) | pass (local) |
| 2026-09-07 | [Modulo verification repair](#modulo-verification-repair-2026-09-07) | pass (local); coverage targets not met |

## Netcup clean development environment (2026-09-22)

**Scope.** Bounded Modulo development environment on `dev-netcup` (Debian 13,
8 CPUs, 16 GB RAM), unprivileged developer `ik`, clean checkout
`/home/ik/Development/Modulo`. Delivered by PR #520, bootstrap merge `264ed531`
on protected `main`. This corrects an earlier disposable-Ubuntu exercise that did
not satisfy the Netcup target. Administration: source-restricted, key-only root
break-glass over the private network; no passwordless sudo for `ik`. No
production credentials or authoritative personal data were copied.

**Checks and results.**

1. `infra/personal/playbooks/development-server.yml` installed missing shell
   tools and reconciled Docker, SSH, ZeroTier, health, firewall and
   backup-boundary state; a follow-up apply added Debian's `rustup`. Final full
   apply: `ok=46`, `changed=0`, `failed=0`, `unreachable=0`.
2. `scripts/verify-netcup-development.py`: `accepted: true`,
   `cleanCheckout: true`, no failures. SSH public-key-only; break-glass path
   available; Docker, SSH, ZeroTier, private-SSH firewall and both maintenance
   timers active and enabled; health report healthy, 3% root disk, ZeroTier
   network state `OK`.
3. `.mise.toml` installed Java 17.0.20.1, Node 22.23.2, npm 10.9.8, Python
   3.14.7; the Rust example manifest installed Rust 1.94.1 and
   `wasm32-unknown-unknown`.
4. `npm ci` succeeded. Frontend gate: typecheck, boundary lint, 596 tests and the
   production build pass; the build uses a temporary output directory and leaves
   the checkout clean.
5. Full Maven reactor: `BUILD SUCCESS` in 17:37, 799 tests, 0 failures, 0 errors,
   3 skipped, including Docker/Testcontainers integration tests and the JaCoCo
   gate.
6. Both WASM examples rebuilt byte-for-byte. The Rust task must run from the
   example directory so Cargo finds its nested `.cargo/config.toml`; running from
   the repository root produced a false fixture mismatch.

**Follow-ups (repository work, not host blockers).**

| ID | Item |
| --- | --- |
| NETCUP-DEV-GAP-01 | `mise run check-frontend-strict-lint` reports 121 existing findings (69 errors, 52 warnings). Fix in a code-quality project; do not weaken lint. |
| NETCUP-DEV-GAP-02 | Root `npm audit`: 102 findings (27 low, 36 moderate, 31 high, 8 critical). |
| NETCUP-DEV-GAP-03 | Legacy worktrees `/home/ik/ChatGPT/Modulo` and `/home/ik/ChatGPT/Noesis` hold owner changes and were left untouched; reconcile or archive only in an owner-reviewed cleanup. New work starts from `/home/ik/Development/Modulo`. |
| NETCUP-DEV-GAP-04 | `zsh`, `fzf`, `zoxide`, `batcat` installed; Starship, Delta, an editor launcher and a `bat` alias are not. Decide whether they belong in shared dotfiles. |

## Clean workstation bootstrap (2026-09-22)

**Scope.** Bounded CLI workstation baseline from `infra/personal`, on a fresh
`ubuntu:24.04` systemd container with OpenSSH; no host home, dotfiles, package
cache, credentials or checkout mounted. Access via an ephemeral Ed25519 key on a
loopback-only SSH port. Implementation commit
`63c5d77b16361e5e60c512e32a156fba52cc121b` on branch `codex/bootstrap-clean-dev`.
Does not claim full desktop/laptop parity.

**Checks and results.**

1. The first dry run failed: pristine Ubuntu lacked `python3-apt`. The
   idempotent `prepare-workstation.yml` stage now installs only Python and the
   distribution bindings Ansible needs.
2. The repaired dry run had no failed or unreachable hosts.
3. `workstation.yml` installed the baseline and shared CLI.
4. Second runs: preparation `changed=0`; workstation `changed=0`, `failed=0`,
   `unreachable=0`.
5. A fresh clone resolved to the implementation commit.
6. `scripts/verify-workstation-bootstrap.py --project /home/dev/Modulo
   --expect-sshd-hardening` passed: `package.json` and `pom.xml` found, required
   CLI present, role marker and external backup-secret boundary present, SSH
   password/keyboard-interactive/root login off, public-key on.
7. A new SSH session as unprivileged `dev` succeeded; `sudo -n true` failed after
   the temporary bootstrap sudo grant was removed.

**Observed matrix.**

| Capability | Laptop (`ik-note`, Ubuntu 24.04) | Desktop (Fedora 44) | Clean target |
| --- | --- | --- | --- |
| Required baseline CLI | missing ShellCheck | missing `fzf` | pass |
| User tool manager | `mise`, `uv` present | `mise`, `uv` missing | missing by design |
| Optional shell tools | `bat`, `zoxide`, Starship | `bat` only | `batcat`, `zoxide` |
| Project runtimes | Node 24, Java 21; no Maven | Node 22, Java 25, Maven 3.9 | not host-global |
| Project declarations | `package.json`, `pom.xml` | untracked `.mise.toml`, `package.json`, `pom.xml` | `package.json`, `pom.xml` |
| Private SSH aliases | verifier passes `oracle`, `netcup`, `pi5`, `desktop` | fall through to public defaults, allow password/keyboard auth | key-only loopback SSH passes |
| Role/backup markers | missing | role marker only | pass |

**Parity gaps.**

| ID | Item |
| --- | --- |
| DEVBOOT-GAP-01 | Baseline and verifier were untracked in the desktop worktree; closes when the branch merges. |
| DEVBOOT-GAP-02 | Controller bootstrap depends on `uv` (laptop only); add a pinned, verified install or document it as an external prerequisite. |
| DEVBOOT-GAP-03 | Laptop's `mise`, `fzf`, `bat`, `zoxide`, Starship and transfer guard are local files, not declarations; move non-secret user config into a reviewed role or dotfiles. |
| DEVBOOT-GAP-04 | Host CLI parity incomplete (ShellCheck, `fzf`; differing Git, GitHub CLI, CMake, GCC, Ninja, ripgrep, Node, Java versions); real hosts not yet reconciled. |
| DEVBOOT-GAP-05 | No versioned mise manifest at the time; desktop's untracked `.mise.toml` was not authoritative until reviewed and accepted with the Java/JaCoCo toolchain. |
| DEVBOOT-GAP-06 | Desktop SSH aliases `oracle`, `netcup`, `pi5`, `laptop` are not hardened; version non-secret alias templates, keep keys external. |
| DEVBOOT-GAP-07 | Laptop lacks role and backup-boundary markers; its verifier lives only in `~/.local/bin`. |
| DEVBOOT-GAP-08 | Neither workstation exposes the `code` CLI; decide whether editor launchers belong in the baseline. |

The container target, ephemeral key and test image are disposable; recreate by
running preparation, dry run, apply and the verifier in that order.

## Home-network administration hardening (2026-09-21)

**Scope.** Live hardening of MikroTik and OpenWrt administration (current state
in [home-network.md](home-network.md#administration)). Devices were not rebooted
or factory-reset.

**Checks and results.**

- Fresh desktop SSH-key sessions succeeded against both devices after the change.
- Correct MikroTik password SSH was rejected (exit 255); unenrolled laptop keys
  were rejected by both devices (exit 255).
- From Pi Infrastructure `10.10.20.10`, TCP 22/80/443/8291 to both devices all
  failed to connect.
- AP listeners after restart: only `192.168.88.2:22` and `127.0.0.1:443`. Direct
  HTTPS failed; HTTPS over a fresh SSH tunnel succeeded. This closed a previous
  guest/IoT IPv6 link-local management exposure (wildcard listeners, no AP host
  firewall).
- MikroTik health/event collectors ran with their separate key after strong
  crypto was enabled.
- Post-change gateway text/binary and AP archive/package backups passed the
  hourly monitor (mode 600, SHA-256 match, fresh); latest at verification
  `20260921200926`.
- Pi service acceptance: zero failures.
- Saved UCI and RouterOS configuration inspected.

**Open.** The owner confirmed no independently custodied offline copy or
recovery credential exists (NET-REC-07). Final acceptance still needs fresh
guest/IoT physical-client tests, an independent recovery/revocation exercise, a
reboot persistence check, review of ordinary-device access and the backup
account's privileges. Next review 2026-12-21.

## Finance evidence review (2026-09-21)

**Scope.** [`scripts/finance-evidence-audit.py`](../../scripts/finance-evidence-audit.py),
a standard-library tool that checks finance-classified Paperless documents for
unreadable originals, missing/mismatched original hashes, identical originals
and absent retention metadata. Live runtime `/home/ik/scripts/records-intake` on
the Pi, reading the existing Paperless container. It never changes originals,
hashes, metadata or retention. It writes an atomic mode-0600 queue at
`/home/ik/records-intake/state/finance-evidence-review.json` containing only safe
document IDs, issue categories and supplied safe references, with stable IDs
across runs. File readability does not claim correct PDF rendering or OCR.
Access stays limited to the Pi account; no public service.

**Commands.**

```sh
python3 -m unittest -v scripts/test_finance_evidence_audit.py
systemctl --user status finance-evidence-review.timer finance-evidence-review.service
cat /home/ik/records-intake/state/finance-evidence-review.json
```

`finance-evidence-review.timer` runs daily with persistent catch-up. An expected
document inventory is not fabricated: without one the queue contains
`expected-evidence-inventory-not-configured`, never a green completeness result.
Supply a protected JSON array via `--expectations PATH`, for example
`[{"reference":"safe-statement-ref","paperlessId":123}]`, optionally with a
`sha256` for the exact original; configure it only after the owner supplies
authoritative safe references. A failed run leaves the last queue unchanged, so
check `checkedAt` and service status first. No external alert destination is
assumed.

**Results.**

- The script and 11 tests passed on the desktop and the Pi; an actual read-only
  Pi run completed. Bank/broker/statement coverage is not accepted.
- Two stored-original-hash mismatches: Paperless IDs 2 and 3. Do not overwrite
  hashes to pass the check; first establish whether they are fixture hashes,
  original/transformation differences or changed originals. Both have retention
  dates and rule versions but no finance-domain link.
- The off-site restore drill ran independently on the desktop: snapshot
  `cd347821`, 4 snapshots/14 packs checked, 180 files restored, all 179 manifest
  checksums verified, 3 documents imported, 6 access-control tables matched
  (57 rows), no host ports, 63 seconds, temporary containers/files removed. This
  confirms backup transport/runtime recovery, not that stored-original hashes are
  correct or that permissions are semantically equivalent because counts match.
- No full repository acceptance run; frontend/backend and real-source financial
  acceptance are not claimed.

## Home-network monitoring (2026-09-21)

**Scope.** Metadata-only acceptance of the desktop probe timers at 00:24 CEST.

**Results.**

- Timers active: 1-minute path probe; 5-minute MikroTik health, event and AP/Pi
  probes; hourly backup-integrity probe.
- Path: router, AP, DNS and Internet `up`.
- MikroTik RouterOS 7.20.1: WAN up, 4 enabled DHCP servers, 5 bound leases, 1
  WireGuard interface and 1 peer, zero WAN drops/errors.
- AP/Pi: AP management, LAN, radios, uplink, Pi reachability, services and
  storage healthy; Pi service probe 12 of 12 critical containers healthy.
- Backups: MikroTik export/binary and OpenWrt archive/manifest present, mode 600,
  fresh, checksum-matching.
- Uptime Kuma on `pi5` runs, but its 26-monitor database is not an accepted
  inventory: it targets the old Pi SSH address `192.168.88.135` and legacy
  `.zt`/Caddy targets that return timeouts, 502s or inaccessible group results.

**Open.** NET-MON-06 (external alert route), NET-MON-07 (controlled failure
cases after the route exists), NET-MON-08 (Uptime Kuma reconciliation,
retention/backup, cadence). Local probes keep running meanwhile.

## Network backup custody check (2026-09-21)

The hourly `network-backup-monitor.timer` completed at 00:17 CEST. The newest
MikroTik text export and binary backup and the newest OpenWrt archive and package
manifest were present, mode 600, within the 30-hour freshness window and SHA-256
verified; the timer was scheduled for its next run. Does not close NET-REC-07:
the vault is the primary custody location, but an independently custodied
offline copy and physical recovery reference still need owner action.

## Netcup access (2026-09-21)

**Scope.** `dev-netcup`: provider hostname `v2202609388785525256.ultrasrv.de`
(resolves to the observed IPv4; a trailing `1` in the originally pasted evidence
was a citation marker), `185.162.249.37/22`,
`2a03:4000:1a:36b:b438:5cff:fe84:c4f3`, Debian 13 (trixie) x86_64, named
administrator `ik` (UID 1000).

**Results.**

- Key-based SSH as `ik` works; effective `passwordauthentication no`,
  `kbdinteractiveauthentication no`, `pubkeyauthentication yes`,
  `permitrootlogin no`.
- Live RSA, ECDSA and ED25519 host keys match the provider fingerprints (listed
  in [devices.md](devices.md#current-observed-state)).
- Docker active; `dev-netcup-health.timer` enabled and active. Docker logs
  bounded; a weekly timer removes unused artifacts older than seven days without
  pruning volumes.
- The Ansible profile installs the toolchain, signed ZeroTier repository,
  automatic security updates, backup boundary and local monitoring; a repeat
  apply shows no drift. The local `dev` SSH alias connects as `ik` with the
  dedicated host key.
- Modulo: TypeScript check, 591 frontend tests and a strict production build
  passed; a bounded backend run passed 170 tests in 28 classes with
  Docker-backed PostgreSQL Testcontainers.
- Noesis: private local workspace initialized, all required doctor checks
  passed, quickstart document ingested as `upload:6bc4778f7288`, cited answer
  returned from the local domain.
- Controlled reboot: named-user SSH, Docker, ZeroTier, unattended upgrades, both
  maintenance timers, the Noesis warehouse and cited answers survived; root SSH
  still denied; no pending OS upgrades.
- ZeroTier installed and online, but the network reports `ACCESS_DENIED` with no
  address. This is an authorization gate, not a reason to give the server a
  home-network role.

**Open.** At this time the automation account had key-only `NOPASSWD: ALL` sudo
for non-interactive Ansible (removed by the 2026-09-22 record). Authorize
ZeroTier, verify private SSH, enable the staged ZeroTier-only SSH policy; run a
provider destroy/rebuild in a maintenance window. Customer numbers, account
email, SCP identifiers, order/contract IDs and provider passwords stay out of
the repository.

## Oracle ZeroTier enrollment (2026-09-21)

**Scope.** `prod-oracle` (host `modulo`, `141.147.5.114`, Ubuntu 24.04 aarch64),
enrolled over the protected production SSH path as `ubuntu`; no key copied into
the repository or Modulo.

**Results.** ZeroTier `1.16.2` from the official Ubuntu Noble repository with
pinned signing-key fingerprint `74A5E9C458E1A431F1DA57A71657198823E52A61`;
`zerotier-one` enabled and active; node `419271fdab` joined network
`88c5b1f339774e42`. Managed addressing on; global routes, default-route and DNS
replacement off. A second Ansible run converged with `changed=0`. Public SSH and
production services unchanged. State: `ACCESS_DENIED`, no private address.

**Open.** Authorize and name the node in ZeroTier Central, then verify the
private address and SSH (see [devices.md](devices.md#open-gaps)).

## Device inventory verification (2026-09-20)

**Scope.** The six-device model, trust boundaries, lifecycle ownership, state
authorities and rebuild procedures as versioned non-secret artifacts.

| Device | Evidence | Result |
| --- | --- | --- |
| Desktop | local OS, kernel, architecture, firewall, SSH, LAN and ZeroTier inspection | Fedora 44/x86_64; firewall active; inbound SSH disabled; `desktop` on LAN and ZeroTier |
| Desktop | repository authority audit of active workspace roots | 25 repositories, 18 dirty; `audit-targets/citrea-hp` and `audit-targets/cronos-zkevm` have no remote and hold modified/generated analysis state, so endpoint disposability is not accepted |
| Laptop | MikroTik DHCP observation and reachability probe | `ik-note` seen on LAN; asleep/unreachable, SSH unavailable |
| Phone | MikroTik DHCP class observation | Android client seen; physical controls, backup/export and ZeroTier are owner evidence |
| Pi 5 | key-based live inspection over trusted LAN | Debian 13/aarch64; `pi5`; LAN and ZeroTier verified; declared private services running |
| Pi 5 | SSH policy and negative paths | public keys on; password, keyboard-interactive and root login off; password-only and root-key attempts from the desktop denied |
| Netcup | local SSH/config and prior evidence | no verified host profile, runtime, private-network membership or provider lifecycle evidence (superseded by the 2026-09-21 record) |
| Oracle | key-based host, SSH, process, package and container inspection | Ubuntu 24.04/aarch64; public-key auth on; password, keyboard-interactive and root login off; no development or agent toolchain; only the Modulo/Noesis stack with Keycloak, Neo4j, Praxis and Caddy |
| Oracle | private-network inspection | ZeroTier absent (superseded by the 2026-09-21 enrollment) |

**Automated checks.** `scripts/verify-device-inventory.py` passed with six unique
IDs, canonical names and roles. Negative tests rejected a duplicate canonical
name and a private-key field. Strict evidence mode failed with six warnings, as
intended while gaps remain.

**Blockers recorded.** Wake and inspect the laptop; inspect the phone; establish
and verify Netcup and prove a disposable rebuild; add Oracle to the private
network and exercise a protected immutable-image release and off-host restore;
classify the desktop's no-remote repositories and dirty state; complete the Pi
service-specific recovery gates.

## Network recovery tabletop (2026-09-20)

The newest MikroTik export and binary backup and the newest OpenWrt archive and
package manifest were re-hashed successfully. The OpenWrt archive passed a
gzip/tar integrity listing and contains the expected `/etc/config` files. The
RouterOS export is non-empty, identifies RouterOS 7.20.1/E60iUGS, and contains
interface, bridge, IP, DHCP, DNS, firewall, user and system sections. The
recovery order was walked through without applying configuration to a live
device. This is a tabletop pass, not an isolated spare-hardware restore; the
independent offline copy and physical recovery reference remain open. Next drill
due by 2026-12-20.

## IPv6 (2026-09-20)

**Scope.** Measure the ISP IPv6 service and confirm a fail-closed state.

| Surface | Evidence | Result |
| --- | --- | --- |
| MikroTik stack | `disable-ipv6=no`, forwarding on | stack kept; no global route |
| WAN `ether1` | link-local only (`fe80::/64`) | no ISP global address |
| DHCPv6-PD | `/ipv6/dhcp-client` has no client/lease | no delegated prefix |
| Routing | only loopback and link-local routes | no default route |
| Desktop | link-local only; `curl -6` to an external endpoint failed | no home global path |
| Pi | link-local on `eth0`; only non-link-local address is a Tailscale ULA on the overlay | no ISP global path |
| OpenWrt | link-local only on bridges/uplink; no IPv6 forwarding or RA | no second router |

Checked after the controlled gateway reboot. No NAT66, static tunnel, ULA LAN
prefix or IPv6 DNS advertisement was introduced. Rollout remains gated on a real
delegated prefix. Review by 2026-12-20.

## WireGuard relay (2026-09-20)

**Scope.** Oracle `wg-home` (`10.10.250.1/24`, UDP 51820) as rendezvous and
restricted relay; MikroTik `wg-home` (`10.10.250.254/24`) as home site. Tested
from a temporary peer on an unrelated Netcup network. No private key was created
for the laptop or phone.

**Results.**

- Home peer established through the ISP's upstream NAT with 25 s keepalive;
  Oracle could not initiate management access to the MikroTik.
- The temporary Netcup peer (public `185.162.249.37`, tunnel `10.10.250.10`)
  connected independently of the home network.
- Through `10.10.250.254` it resolved `router.home.arpa`, `pi.home.arpa`,
  `paperless.home.arpa` and a public name; `paperless.home.arpa` returned
  `10.10.20.10`; ICMP and TCP/22 to the Pi succeeded at about 20 ms RTT.
- A do-not-fragment ICMP payload of 1392 bytes (1420-byte packet) passed,
  matching the tunnel MTU.
- Trusted, IoT, Guest and RouterOS SSH attempts failed; the Oracle drop counter
  recorded them. With a controlled temporary relay exception, a
  Trusted-destination probe reached the MikroTik, whose `wg: remote default deny`
  counter went from 0 to 2.
- Client restart re-established access. Stopping the Oracle service failed
  closed; after restart both handshakes, Pi access and DNS recovered.
- MikroTik reboot: 32 s interruption; interface, site peer, five policy rules,
  external Pi access and DNS returned.
- Removing the Netcup peer from Oracle stopped its traffic immediately; its
  config/key, Oracle peer and MikroTik `10.10.250.10` authorization were then
  deleted; the site peer stayed up.
- The test host has native IPv6, but the tunnel advertises no IPv6 route.

**Open.** Laptop (`10.10.250.2/32`) and phone (`10.10.250.3/32`, over mobile
data and Wi-Fi roaming) enrollment with their own keypairs. Review by
2026-12-20.

## DNS and service discovery (2026-09-20)

**Scope.** Resolver policy per zone, `home.arpa` naming, isolation and failover
(policy in [home-network.md](home-network.md#dns-and-naming)).

**Results.**

- Trusted queried `192.168.88.1` for `router.home.arpa`, `pi.home.arpa`,
  `paperless.home.arpa` and a public name: all answered.
- The Pi queried `10.10.20.1` for the same: each `NOERROR` with at least one
  answer.
- A real IoT client (`10.10.30.100/24`) received only `1.1.1.1` and `9.9.9.9`;
  both answered, `10.10.30.1` and `8.8.8.8` timed out, HTTPS returned 200. A real
  Guest client (`10.10.40.100/24`) gave the same result.
- An Oracle-hosted probe got no DNS response from the home public IPv4 on UDP or
  TCP 53.
- With the primary resolver replaced by unreachable `192.0.2.1`, public queries
  still succeeded via the secondary. With only that address configured, local
  names resolved and public queries failed. Restoring `1.1.1.1,9.9.9.9` restored
  public resolution.
- Final RouterOS state: no dynamic upstream, no DoH server, no mDNS repeat
  interfaces.
- The legacy `dnssec-failed.org` probe returned an address through all tested
  public resolvers, so it was not a valid DNSSEC discriminator and no DNSSEC
  behaviour is claimed.

## Network segmentation (2026-09-20)

**Scope.** Four trust zones on the MikroTik with an explicit tagged trunk to the
AP (design in [home-network.md](home-network.md#trust-zones-and-firewall)).

**Results.**

- A temporary tagged management path reached both devices before bridge VLAN
  filtering was enabled.
- A real Trusted wireless client got `192.168.88.127/24` after the trusted SSIDs
  moved to VLAN 10.
- The Pi renewed onto Infrastructure as `10.10.20.10`, resolved DNS, reached
  HTTPS and stayed reachable from Trusted.
- Real IoT (`10.10.30.100/24`) and Guest (`10.10.40.100/24`) clients: approved
  public DNS and HTTPS worked; router DNS/SSH, alternate classic DNS, Trusted and
  Infrastructure unreachable.
- An Infrastructure-initiated attempt toward Trusted was denied and increased
  the MikroTik default-deny counter.
- A tagged VLAN 30 frame sent through the desktop Trusted access port was
  rejected.
- Trusted DNS, Internet and Infrastructure access passed with zero loss to the
  Pi. Router/AP administration worked from Trusted and failed from
  Infrastructure, IoT and Guest. Pi and service DNS records resolve to
  `10.10.20.10`.
- OpenWrt initially accepted SSH `none` authentication (root had no password and
  no key). The desktop public key was installed, Dropbear password/root-password
  auth disabled, `none` rejected, and a forced public-key-only login succeeded
  after restarting Dropbear; included in the final recovery archive.
- IoT/Guest WPA credentials generated independently and stored in the desktop
  Secret Service (`modulo-home-network`). A two-client Guest peer test was not
  possible (only one client); hostapd isolation and routed denial were verified.
- Restarts: AP restart at 2026-09-20T23:05:23+02:00, management back in 68 s
  with three bridges and five radio interfaces; gateway restart at
  23:06:43+02:00, back in 38 s with bridge filtering, five VLAN rows, four DHCP
  servers and the segmented rules intact. Post-reboot IoT/Guest clients got
  leases, reached HTTPS and could not reach router SSH. Health probes passed
  after updating expectations. Fresh MikroTik and OpenWrt artifacts were captured
  before cutover and after; OpenWrt checksum sidecars verified.

Review after the first real IoT device, IPv6 or WireGuard enablement, a
topology/firewall change, or by 2026-12-20.

## OpenWrt access point (2026-09-20)

**Scope.** TP-Link Archer C6 v2, OpenWrt 24.10.5, as untagged Wi-Fi AP bridging
to the MikroTik LAN (VLANs were added later by segmentation).

**Results.**

| Control | Verified state |
| --- | --- |
| Management | static `192.168.88.2/24` |
| Ethernet | 1 Gb/s full duplex via MikroTik `ether2`; zero RX/TX errors |
| Router services | no masquerade; `dnsmasq`, `odhcpd` and firewall stopped |
| DHCP | MikroTik is sole authority; OpenWrt LAN DHCP ignored |
| Wi-Fi | WPA3-SAE on trusted SSIDs; WPS off; SSIDs broadcast |
| Regulatory | `DE` on both radios, kept after reboot |
| Radios | 2.4 GHz ch 6 HT20; 5 GHz ch 36 VHT40; default power |

- Temporary WPA3 profile on the desktop's 2.4 GHz-only adapter got
  `192.168.88.127/24` from MikroTik; profile and credential removed afterwards.
- 20 pings to the wired Pi: 0% loss, 4.8 ms average, 22.5 ms max. Client-to-Pi
  17.6 Mb/s, Pi-to-client 32.1 Mb/s. Loaded link -23 dBm, 78 Mb/s TX rate. A
  separate client showed -29 dBm average and 144.4 Mb/s both ways. No 5 GHz
  throughput or room-by-room coverage is claimed.
- Restart requested 21:57:17+02:00, loss seen 21:57:22, SSH/management back
  21:58:18 (61 s). Radios, bridge and backhaul healthy; client renewed with 0%
  loss. `sysupgrade -b` archive and package manifest captured before and after,
  archive checksum stored in encrypted custody.

## MikroTik gateway (2026-09-20)

**Scope.** Controlled restart of the hEX S; no routing, firewall, addressing or
service policy changed. Preconditions: desktop default route via `192.168.88.1`;
health probe showed RouterOS 7.20.1, one DHCP server, WAN up, no drops/errors;
hide-sensitive export and binary backup `20260920214518` captured and
checksum-verified in encrypted custody.

**Restart.** Requested 2026-09-20T21:45:43+02:00, loss seen 21:45:46, reachable
21:46:23 (41 s); uptime 1 min 16 s at observation. Post-restart: WAN up, one DHCP
authority, three bound leases, no drops or degraded-health reasons.

| Check | Evidence | Result |
| --- | --- | --- |
| Configuration persistence | RouterOS 7.20.1 and gateway services returned | pass |
| LAN reachability | `192.168.88.1` reachable from the desktop | pass |
| DHCP renewal | desktop reconnected, renewed `192.168.88.136/24`, lease bound | pass |
| Gateway/DNS assignment | client got `192.168.88.1` for both | pass |
| Local DNS | `router.home.arpa` resolved to `192.168.88.1` | pass |
| Recursive DNS and egress | public name resolved, HTTPS completed | pass |
| WAN management denial | Oracle probe found TCP 22, 80, 443, 8291, 8728, 8729 unavailable on the public IPv4 path | pass |
| Post-change export | export and binary `20260920214805`; all four pre/post sidecars verified | pass |

## Communication systems (2026-09-20)

**Scope.** Matrix/Synapse and four Mautrix bridges on the Pi (design in
[README.md](README.md#communication-systems-matrix-on-the-pi)). No message
content was inspected.

**Results.**

- All 12 critical Pi services healthy; all four Mautrix containers running.
- One active account each for WhatsApp, Signal and Telegram; portal and
  cryptographic state persisted.
- Telegram received inbound Megolm sessions with no decrypt/key-share errors in
  the final 30-minute window.
- First protected backup `20260920T200648Z`; checksum and freshness monitor
  passed. Isolated restore drill: dump loaded into a temporary PostgreSQL 16
  container with no network and tmpfs-only storage; non-empty schemas in
  `synapse` and all four Mautrix databases; container removed.

Establishes deployment, pairing, encrypted bridge operation, supervision and
Pi-local persistence, not every protocol feature. Open: native-client
coexistence, all media/reaction variants, Signal portal creation, controlled
Internet-outage test.

## Noesis research routing pilots (2026-09-20)

| Intent | Exercise | Result |
| --- | --- | --- |
| Public-source verification | Ingested Mozilla's official Firefox policy reference by URL; asked which fields configure custom search engines and aliases | answered from `web:c32cf8a382d0275104bda9c7` with the original URL and an extractive citation |
| Multi-source comparison | Ingested the Noesis CLI guide and CLI contract; asked whether sync executes queued source-pack jobs or starts paid acquisition | two consistent cited passages from `upload:74acbcb87a57` and `upload:3dbbaa1bbfed` |
| Evidence portability | Exported the comparison answer without private evidence and verified it offline | bundle `sha256:7d83b68fa0829384a2b84d17ada461db77c1de09f29703db78a7a7e0713b3e44` valid, two evidence objects, no warnings |
| Insufficient evidence | Narrow privacy question with a higher relevance threshold | refused with `insufficient_evidence` |
| Monitoring handoff | Created and polled a public topic watch for Firefox enterprise-policy changes | lifecycle and opaque cursor worked; zero events reported explicitly; watch soft-deleted with audit history kept |

Verified bundle:
`/home/ik/ChatGPT/Noesis/artifacts/browse-route-2026-09-20/sync-safety.answer.bundle.json`.

## Paperless off-site restore drill (2026-09-20)

**Scope.** Independently authenticated off-site Paperless backup and a clean
application-level restore, run from the desktop without the Pi, its local Restic
repository or a Pi login. Procedure:
[recovery.md](recovery.md#paperless).

**Command.**

```sh
./scripts/paperless-offsite-restore-drill.sh
```

**Steps exercised.** Read repository location and password from the separately
held encrypted recovery bundle; authenticate with the separately stored SSH key
and pinned `known_hosts` (destination account is SFTP-only; an interactive shell
was denied); full Restic data read and restore of the latest snapshot to a
disposable directory; verify the SHA-256 manifest; restore
`deployment/postgresql.dump` into a new database and inspect schema and document
count; start fresh pinned PostgreSQL, Redis and Paperless on an internal-only
network and import the exporter bundle; compare document and access-control
data; remove containers, network, databases, recovered files and in-memory
secret values. The source repository was only read; cleanup found no
`records-dr-*` containers, networks or restore directories.

| Check | Result |
| --- | --- |
| Off-site authentication | passed with the recovery bundle and pinned host key |
| Repository integrity | 3 snapshots, 12 packs, full `restic check --read-data`, no errors |
| Snapshot restored | `84c472a9`, created 2026-09-20 01:44:46 UTC |
| Restored artifacts | 177 files; all 176 `SHA256SUMS` entries matched |
| PostgreSQL restore | 72 public tables, 3 document rows into a clean database |
| Fresh Paperless import | 3 documents, 2 non-system users |
| Access-control parity | row counts matched across 6 user/group/permission/object-permission tables (14 rows) |
| Network isolation | internal-only Docker network; 0 host port bindings |
| Recovery time | 63 s for the automated drill on a 19.012 MiB snapshot (excludes replacement host, public DNS and user-led cutover) |
| Recovery-point age | about 15 h 57 min at final verification, within the 24 h RPO |

**Task disposition.**

| Task | State |
| --- | --- |
| REC-DR-04 | complete: independent off-site authentication, encryption, retention history, integrity, forced-SFTP isolation, recovery without the Pi |
| REC-DR-06 | partial: backup key, Restic password, deployment config, database credential and pinned host identity worked from the bundle; password-manager and cloud-provider account recovery need an owner-led lockout exercise |
| REC-DR-07 | partial: backup and monitor timers active, age/status/capacity probe healthy; no external notification/escalation destination accepted |
| REC-DR-09 | complete for technical clean-host recovery |
| REC-DR-10 | cadence and procedure established (quarterly, first by 2026-12-20, and after material backup, credential, Paperless, database or network changes); open until the gates below close |

**Open gates.**

1. A separately custodied offline medium or immutable/object-locked copy, with
   tested rotation and expiry.
2. An owner-led password-manager and off-site-provider account-recovery exercise
   without an already unlocked session.
3. An external alert destination and escalation path for backup monitor
   failures.

These need physical custody, external account recovery or a named notification
destination and were not substituted with weaker local checks.

## Workspace connections verification (2026-09-09)

**Scope.** Local verification of search, document capture, references and
offline notes (feature: [workspace](../features/workspace.md)). Not deployed.

**Results.**

- Frontend unit suite: 112 suites, 1,117 tests passed; later focused checks
  passed 16 tests (cache changes, search, provenance, account draft isolation,
  service worker).
- Chromium smoke: 31 scenarios passed in the full run; the remaining
  semantic-search navigation scenario had an invalid fixture runbook state and
  passed after the fixture was fixed. All 32 scenarios, including six new
  connection workflows, have passed.
- Backend: 12 focused tests passed (local workspace ranking, remote-provider
  exclusion, input bounds, UTF-8 extraction, a real PDF extraction through
  Poppler, existing note semantic search).
- Strict production build, lint and boundary checks passed (95 baseline
  findings); pack asset sync and whitespace checks passed.
- Backend ran on Java 25 with `-Djacoco.skip=true` (the JaCoCo version cannot
  instrument Java 25; a bundled Java 21 lacked `java.net.http`). No coverage
  claimed; compilation still targets Java 17.

**Limits.** Browser tests used fixture identity and API responses; production
IdP, live attachment storage and remote embeddings were not exercised. Service
worker tests confirmed API/external requests are not intercepted, runtime config
has an offline fallback, and only already-loaded same-origin assets are
precached; expired-auth offline login is not supported. Plain-text and PDF
extraction exercised; Tesseract OCR (in the backend Dockerfile with Poppler) and
a container build were not. Scanned PDFs need OCR before import. Build output in
`.verification/workspace-gaps-build`.

## Project workspaces verification (2026-09-08)

**Scope.** Account-scoped projects with linked notes, source-note checklist
tasks, decisions, procedures, run history and evidence; Notes membership panel;
archive/delete; project capsule export/import with resumable record remapping.
Uses existing note and plugin-state APIs; no backend changes; not deployed.

| Check | Result |
| --- | --- |
| Frontend unit suite | 109 suites, 1,105 tests passed |
| Chromium smoke suite | 24 tests passed |
| Additional targeted integration tests | 2 passed |
| Strict TypeScript and production build | passed |
| Lint and boundary checks | passed against baseline (95 findings) |
| Pack asset sync, whitespace | passed |

Seven project browser tests cover task persistence, full capsule round trip,
archive/delete, stale note updates, mobile navigation, the membership panel, and
resuming an interrupted plugin-state import without duplicates. Screenshots:
`.verification/project-workspaces-desktop.png`,
`.verification/project-workspaces-mobile.png`; build in
`.verification/project-workspaces-build`. Browser checks used fixture auth and
API responses. Imported execution receipts stay historical and cannot resume.

## Workspace tools verification (2026-09-08)

**Scope.** Seven Workspace Tools plugins plus the extended Decision Journal,
available individually or via `pack-workspace-tools`. Changes covered: view,
loader, fence-renderer, editor-action and pack registration; runbooks wired to
the authenticated manual Blueprint endpoint (request IDs kept, progress blocked
until server-confirmed success); account-scoped Decision Journal; hardened tool
store (malformed/deleted records, unsupported schemas, account switches,
concurrent writes) with recovery export and acknowledged import progress; fix
for a StrictMode/Web Lock race that forked cache identity and hid unsynced
edits; folder-scan fixes; retained failed attachment uploads for retry;
checkpoint and capsule import validation with ID mappings and 100-note property
batching; history removal/export controls; view remount on account change.

**Commands.**

```sh
npm run test:run --workspace=frontend -- --maxWorkers=2
npm run lint:ci --workspace=frontend
npm run lint:boundary:ci --workspace=frontend
npm run build:strict --workspace=frontend -- --outDir ../.verification/workspace-tools-build
(cd frontend && npx playwright test --config playwright.smoke.config.ts)
(cd backend && mvn -B test -Dtest=ManualBlueprintControllerTest,BlueprintInterpreterServiceTest,WorkflowRunServiceTest,AttachmentServiceTest)
python3 scripts/sync-pack-assets.py --check
git diff --check
```

**Results.** Vitest 108 suites, 1,096 tests; after the final regression, 37
focused tests (10 workspace-state-host tests). Backend targeted run 46 tests
(PostgreSQL workflow state, interpreter/manual endpoint, attachments; manual
requests keep owned note context, reject foreign resources and non-manual
triggers, and do not rerun an existing request). Chromium smoke 19 tests
including 15 Workspace Tools journeys. Strict build, lint baseline (95
findings), boundary check, whitespace and pack sync pass. Backend used Java 17.
File-system handles and upload responses were fixtures; microphone hardware,
real directory permissions, IdP login and external storage were not exercised.

## Modulo verification repair (2026-09-07)

**Scope.** Uncommitted working tree on `fix/plugin-state-contract` based on
`ddab6f07`. Repairs: `owner_id`/`blueprint_name` added to the H2 test schema
(their absence caused 151 context errors); shared approval canonicalization
module, signature vectors and verifier tests restored from `origin/main`; Trust
Center validation made fail-closed for absent, throwing, unknown, partial,
failed, unavailable or stale verifier evidence (seven new negative tests); React
effect/lint fixes without expanding the baseline; boundary-lint config loads the
React Refresh plugin (restriction unchanged); workspace browser fixture rebuilt
around the account-scoped installation/state contract. No commit, push or
deployment.

**Commands** (Java 17, Docker, Playwright Chromium, from the repo root):

```sh
(cd backend && mvn -B verify \
  -Dlogging.level.root=WARN \
  -Dlogging.level.org.springframework=WARN \
  -Dlogging.level.org.hibernate=WARN)
npm run typecheck --workspace=frontend
npm run lint:ci --workspace=frontend
npm run lint:boundary:ci --workspace=frontend
npm run test:run --workspace=frontend -- --maxWorkers=2
npm run build:strict --workspace=frontend
(cd frontend && npx playwright test --config playwright.smoke.config.ts --workers=1)
(cd frontend && npx playwright test tests/audit-pack-onboarding.spec.ts \
  --project=chromium --project='Mobile Chrome' --workers=1)
node --test shared/approval/verification.test.mjs scripts/test-audit-report.mjs
python3 scripts/test-evidence-bundle.py
python3 scripts/sync-pack-assets.py --check
git diff --check
```

| Check | Result |
| --- | --- |
| Backend `mvn -B verify` (Java 17) | exit 0; 112 suites, 778 tests: 776 passed, 2 skipped |
| Frontend TypeScript | passed |
| Frontend unit tests | 1,062 passed |
| Strict production build | passed |
| Baseline-aware lint | 0 new, 95 existing findings |
| Boundary lint and negative probe | passed; forbidden import rejected by `no-restricted-imports` |
| Workspace Chromium smoke | 2 passed |
| Audit onboarding desktop/mobile Chromium | 4 passed |
| Node approval/report verification | 3 passed |
| Python evidence-bundle test | 1 passed |
| Pack schema/example sync, `git diff --check` | passed |

**Limits.** Default Maven verify does not enforce coverage: JaCoCo reported
instruction 56% (target 85%), branch 47% (80%), line 55% (85%), 134 missed
classes (max 3) with `haltOnFailure=false`; the `ci` profile was not run.
`UserControllerTest` and `BlockchainServiceIntegrationTest` stayed disabled, as
did other POM exclusions. Browser journeys used local API/identity fixtures, not
live OIDC. Staging soak, physical Pi/arm64, remote providers and live OCI
artifacts were not verified. Evidence was saved locally in
`.verification/2026-09-07-fixes/` (`summary.json`, backend logs and Surefire
reports, frontend and Playwright JSON, `boundary-negative-probe.json`,
`changed-source-sha256.json` for the 19 changed files); it does not replace CI
artifacts.
