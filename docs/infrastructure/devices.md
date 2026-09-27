# Devices

The owner's six devices: their roles, trust boundaries, current observed state,
open evidence gaps, and how to rebuild each one. This page is for the owner and
anyone performing a device replacement or quarterly review. It contains no
secrets; credentials, keys, recovery codes and unlock material live in the
password manager and encrypted recovery custody.

The human-facing authority is Modulo Knowledge note #51. The machine-checkable
inventory is [devices-inventory.json](devices-inventory.json). Both describe
exactly six devices and keep unknown runtime state explicit instead of treating a
target design as deployed.

## Role contract

| Inventory ID | Canonical name | Boundary | Role | State authority |
| --- | --- | --- | --- | --- |
| `desktop` | `desktop` | personal | physical engineering workstation | Git, managed records (Modulo/Paperless), encrypted recovery custody |
| `laptop` | `laptop` | personal | thin portable workstation | Git and managed personal-file services; no unique services |
| `phone` | `phone` | personal | communications, authentication and capture | application/cloud exports, password manager and offline recovery custody, Modulo capture after sync |
| `pi5` | `home-pi` | home infrastructure | always-on homeserver for records, communications and private services | versioned deployment definitions plus encrypted service backups |
| `netcup` | `dev-netcup` | development | canonical remote development compute | Git and reproducible disposable development services |
| `oracle` | `prod-oracle` | production | Modulo and Noesis production only | GitHub/CI, `deploy/oci` definitions, production databases and encrypted off-host backups |

Canonical names are stable identifiers. Current hostnames and addresses are
observations, not authorities; an address change does not create a new
inventory item.

## Boundaries

- Personal devices may initiate development access; they do not inherit
  unattended production administration.
- Netcup is development only. It must not hold production deploy credentials or
  authoritative personal state, and must not become a recovery dependency for
  Oracle.
- Oracle is production only. Interactive development, experiments, agent
  sandboxes and personal shell state are out of scope.
- The Pi is an always-on homeserver, not an experimental edge lab. Paperless,
  Matrix/bridges, monitoring and other private services are its workload;
  experimental firmware, disposable labs and hardware-development targets belong
  on the desktop bench.
- Secrets, private keys, recovery codes, device unlock material and provider
  credentials never belong in the inventory or the repository. Netcup customer
  numbers, account email, SCP identifiers, order/contract IDs and provider
  passwords stay in the protected provider/recovery record.

## Current observed state

Snapshot of [devices-inventory.json](devices-inventory.json) (`asOf` 2026-09-21).
Evidence behind these rows is in [records.md](records.md).

| Device | Current name | Platform | Network | Access | Evidence |
| --- | --- | --- | --- | --- | --- |
| desktop | `desktop` | Fedora 44, x86_64 | LAN `192.168.88.136`, ZeroTier `10.165.78.30` (verified) | local owner session; outbound key-based SSH; inbound SSH disabled | verified |
| laptop | `ik-note` | Linux target; version unverified | dynamic LAN, last `192.168.88.254`; ZeroTier unverified | local owner session; key-based SSH target; unreachable during review | partial |
| phone | `android-device` | Android; version unverified | dynamic Android DHCP client; ZeroTier unverified | physical owner access only | partial |
| pi5 | `pi5` | Debian 13, aarch64 | LAN `10.10.20.10`, ZeroTier `10.165.78.10` (verified) | key-based SSH over trusted LAN/private network; password, keyboard-interactive and root login disabled | verified |
| netcup | `v2202609388785525256.ultrasrv.de` | Debian 13, x86_64 | public `185.162.249.37/22`, `2a03:4000:1a:36b:b438:5cff:fe84:c4f3`; ZeroTier `ACCESS_DENIED`, no address | key-based SSH as named admin `ik`; root, password and keyboard-interactive login disabled | partial |
| oracle | `modulo-noesis-a1` | Ubuntu 24.04, aarch64 | public `141.147.5.114`; ZeroTier network `88c5b1f339774e42` joined as node `419271fdab`, no address until authorized | dedicated key-based production access plus protected release path; password, keyboard-interactive and root login disabled | partial |

Netcup SSH host-key fingerprints (they match the provider-supplied values):

| Type | Fingerprint |
| --- | --- |
| RSA | `SHA256:bt3bDG8xtPBv87gf1X4oo2ZrO/AQoCAeGo1yQgPS/6c` |
| ECDSA | `SHA256:OuHCcJpS7cjLKgwmhMDLlDjQnpjqGbuAy+8rnXD8ttE` |
| ED25519 | `SHA256:lzInG4zr0aX7rnYuMG7lqgwbMk2jYHiL4MaQt5c9JTk` |

### Open gaps

These are the acceptance blockers recorded in the inventory. Strict evidence
mode fails until all are closed.

| Device | Gap |
| --- | --- |
| desktop | Repository authority audit found 25 repositories, 18 with dirty worktrees. The no-remote audit workspaces `audit-targets/citrea-hp` and `audit-targets/cronos-zkevm` hold modified/generated test and analysis state; preserve or classify it before claiming endpoint disposability. |
| laptop | Verify OS, disk encryption, ZeroTier membership, SSH policy, patching, backup/sync coverage and absence of unique state while the device is awake. |
| phone | Verify OS/update state, screen and storage protection, ZeroTier membership, backup/export coverage and recovery-factor custody on the physical device. |
| pi5 | Complete service-specific recovery acceptance for Matrix and the remaining private services. |
| netcup | Authorize the host in the intended ZeroTier network, verify private SSH and ACL behaviour, then enable the staged default-deny policy exposing SSH only on ZeroTier. Complete a scheduled provider destroy/rebuild exercise. |
| oracle | In ZeroTier Central, authorize node `419271fdab` in network `88c5b1f339774e42` and name it `prod-oracle`; verify the private address and a key-based SSH session over it. Do not add a production firewall restriction or retire public break-glass access until the private path is tested independently. Exercise one protected immutable-image release through the CI/CD promotion path and a restore from an independently authenticated off-host backup. |

Workstation parity gaps from the bootstrap acceptance (DEVBOOT-GAP-02 to -08)
and Netcup development gaps (NETCUP-DEV-GAP-01 to -04) are listed in
[records.md](records.md).

## Validating the inventory

[`scripts/verify-device-inventory.py`](../../scripts/verify-device-inventory.py)
takes the inventory path as an argument. It checks `schemaVersion` 1, exactly the
six IDs, unique canonical names and roles, allowed trust boundaries and evidence
states, and rejects secret-bearing field names. Run it on every change:

```sh
python3 scripts/verify-device-inventory.py docs/infrastructure/devices-inventory.json
```

Strict evidence mode is the project acceptance gate. It deliberately fails until
all six devices are `verified` with no gaps:

```sh
python3 scripts/verify-device-inventory.py --strict-evidence \
  docs/infrastructure/devices-inventory.json
```

Evidence states: `verified` means a safe runtime check ran from an authorized
path; `partial` means the device or its service runtime was observed but one or
more host controls are untested; `blocked` means no authorized runtime or
control-plane evidence is available.

## Quarterly review

The account owner reviews the inventory quarterly and after any replacement or
role, network, access or authority change. Confirm that:

1. each device has one primary role and the correct trust boundary;
2. its canonical name is used by private networking, SSH, monitoring and
   deployment configuration where applicable;
3. administrative access is key/passkey-based and public password login is off;
4. irreplaceable state has a named authority outside the endpoint;
5. the rebuild path works without copying secrets into the repository;
6. stale devices, credentials, monitoring targets and backup jobs are retired
   only after replacement evidence and rollback readiness exist.

Record failures as gaps in the inventory and in note #51. A failed check never
triggers automatic reconfiguration, credential rotation, deletion or restore.
Service hosts keep their health/backup monitors; endpoints get periodic
inventory and update review rather than content collection.

## Rebuilding a device

Rebuilds restore roles, not disk images. Source, managed records, credentials
and service state come back from their named authorities. For whole-system
incidents start from [recovery.md](recovery.md).

### Common sequence

1. Declare the affected canonical device and freeze destructive cleanup.
2. Preserve recoverable working data and record the last known inventory state.
3. If loss or compromise is plausible, revoke or quarantine the device's
   sessions, keys and private-network membership.
4. Install the supported OS baseline from trusted media or the provider image.
5. Apply the role profile, patch fully, enable disk/storage protection where
   supported, and configure the local firewall.
6. Enroll a fresh device-specific ZeroTier identity and key-based access. Never
   clone a private machine identity from the failed device.
7. Restore source and managed state from their authorities, then run the
   device-specific acceptance below.
8. Retire the old inventory, network and access records only after acceptance
   and a rollback review.

The non-secret role profiles live in [`infra/personal`](../../infra/personal/README.md)
(Ansible playbooks `prepare-workstation.yml`, `workstation.yml`,
`development-server.yml`, `private-network.yml`). Verifiers:
[`scripts/verify-workstation-bootstrap.py`](../../scripts/verify-workstation-bootstrap.py)
and [`scripts/verify-netcup-development.py`](../../scripts/verify-netcup-development.py).

### Device profiles

| Device | Rebuild | Acceptance |
| --- | --- | --- |
| `desktop` | Fedora baseline, owner account, full-disk protection, firewall, development shell/tools and the physical-engineering profile. Enroll ZeroTier as `desktop`, clone repositories from remotes, restore only approved working data, reinstall hardware tooling from package/vendor sources. | Firewall active; inbound SSH disabled unless newly approved; correct ZeroTier identity; Git remotes present; representative USB/JTAG/audio workflows pass. |
| `laptop` | Same Linux family where practical, thin-workstation profile: browser, editor, Git, SSH, ZeroTier, light toolchains. Enroll as `laptop`; restore no services or unique databases. | Remote development via `dev-netcup` works; selected managed files available; disk protection and update policy verified; a local-loss review finds no unique project or personal state. |
| `phone` | Platform recovery/reset and owner-controlled account recovery. Re-enroll screen/storage protection, password manager, communication, authentication and capture apps from clean sources. Restore factors only from protected custody; regenerate consumed recovery material. | Owner verifies updates, backup/export coverage, ZeroTier if retained, lost-device controls and every critical authentication path on the physical device. |
| `home-pi` | Raspberry Pi OS/Debian on replacement storage, patch, owner account, key-only SSH, enroll as `home-pi`, homeserver profile. Recreate containers from versioned definitions. Restore Paperless, Matrix and other state only through their service runbooks and encrypted backups. No experimental firmware, hardware-debug targets or lab workloads. | Network/SSH controls pass; critical services healthy; backup freshness checks pass; at least one representative isolated restore succeeds. |
| `dev-netcup` | Supported Linux image from the provider control plane, patch, enroll as `dev-netcup`, dedicated non-production administrator, apply `development-server.yml`. Clone Modulo into the managed checkout root, trust and install `.mise.toml`, install the pinned Rust toolchain from the WASM example manifest, recreate development data from fixtures or documented imports. Run `scripts/verify-netcup-development.py` as root. Production credentials are forbidden. | Modulo/Noesis builds and tests run; agent work isolated; restart and update checks pass; a second apply reports zero changes; destroying the host loses no authoritative state. |
| `prod-oracle` | Approved OCI provisioning path, minimal production profile, enroll as `prod-oracle` if the private network is retained, deploy only through protected GitHub/CI workflows (see [deployment](../operations/deployment.md)). Restore production state from independently authenticated encrypted backups. Break-glass access stays separate from development identities. | Runtime limited to approved Modulo/Noesis dependencies; public password login denied; deployment approval and rollback work; health checks pass; a clean restore meets the recorded RPO/RTO. |

For the Netcup provider console: it is the independent recovery path for the
host. The named automation account had key-only `NOPASSWD: ALL` sudo during the
2026-09-21 access acceptance; the 2026-09-22 bootstrap acceptance records that
`ik` has no passwordless sudo and administration uses a source-restricted,
key-only root break-glass path over the private network.

### Failure exercises

- Quarterly: a non-destructive tabletop rebuild of one endpoint from this page.
- Annually: a clean rebuild or isolated restore of one Linux role.
- Record elapsed time, missing prerequisites, unauthorized dependencies and
  remediation owners in Modulo.
- Live production restores, network removal and device wipes require an
  explicit maintenance window.
