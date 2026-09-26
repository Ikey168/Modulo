# Device rebuild and replacement runbook

This runbook restores roles, not disk images. Source, managed records,
credentials and service state remain in their named authorities. Do not copy
secret values into this repository or Modulo.

## Common sequence

1. Declare the affected canonical device and freeze destructive cleanup.
2. Preserve recoverable working data and record the last known inventory state.
3. Revoke or quarantine the lost device's sessions, keys and private-network
   membership when loss or compromise is plausible.
4. Install the supported operating-system baseline from trusted media or the
   provider image.
5. Apply the role profile, patch fully, enable disk/storage protection where
   supported, and configure the local firewall.
6. Enroll a fresh device-specific ZeroTier identity and key-based access. Never
   clone a private machine identity from the failed device.
7. Restore source and managed state from their authorities, then run the
   device-specific checks below.
8. Retire the old inventory/network/access records only after acceptance and a
   rollback review.

## Device profiles

### `desktop`

Install the supported Fedora baseline, owner account, full-disk protection,
firewall, development shell/tools and the physical-engineering profile. Enroll
ZeroTier as `desktop`, clone active repositories from their remotes, restore only
approved working data, and reinstall hardware tooling from documented package
or vendor sources. Acceptance: firewall active, inbound SSH disabled unless a
new requirement is approved, ZeroTier identity correct, Git remotes present,
and representative USB/JTAG/audio workflows pass.

### `laptop`

Install the same Linux family where practical with the thin-workstation
profile: browser, editor, Git, SSH, ZeroTier and light local toolchains. Enroll
as `laptop`; do not restore services or unique databases. Acceptance: remote
development works through `dev-netcup`, selected managed files are available,
disk protection and update policy are verified, and a local-loss review finds
no unique project or personal state.

### `phone`

Use the platform's supported recovery/reset path and owner-controlled account
recovery. Re-enroll screen/storage protection, password manager, communication,
authentication and capture applications from clean sources. Restore factors
only from protected custody and regenerate consumed recovery material.
Acceptance requires the owner to verify updates, backup/export coverage,
ZeroTier if retained, lost-device controls and every critical authentication
path on the physical device.

### `home-pi`

Install Raspberry Pi OS/Debian on replacement storage, patch it, create the
owner account, enforce key-based SSH, enroll as `home-pi`, and apply the
homeserver profile. Recreate containers from versioned definitions. Restore
Paperless, Matrix and other state only through their service-specific runbooks
and encrypted backups. Do not deploy experimental firmware, hardware-debug
targets or disposable lab workloads to the homeserver.
Acceptance: network/SSH controls pass, critical services are healthy, backup
freshness checks pass, and at least a representative isolated restore succeeds.

### `dev-netcup`

Provision a supported Linux image from the provider control plane, patch it,
enroll as `dev-netcup`, configure a dedicated non-production administrator and
apply the development profile. Clone source from Git and recreate development
databases/services from fixtures or documented imports. Production credentials
are forbidden. Acceptance: Modulo/Noesis builds and tests run, agent work is
isolated, restart and update checks pass, and destroying the host loses no
authoritative state.

### `prod-oracle`

Provision through the approved OCI/provider path, apply the minimal production
profile, enroll as `prod-oracle` if the private-network design is retained, and
deploy only through protected GitHub/CI workflows. Restore production state
from independently authenticated encrypted backups. Break-glass access remains
separate from ordinary development identities. Acceptance: the runtime scope is
limited to approved Modulo/Noesis dependencies, public password login is
denied, deployment approval and rollback work, health checks pass, and a clean
restore meets the recorded RPO/RTO.

## Failure exercises

Quarterly, select one endpoint and perform a non-destructive tabletop rebuild
from this runbook. Annually, perform a clean rebuild or isolated restore for one
Linux role. Record elapsed time, missing prerequisites, unauthorized
dependencies and remediation owners in Modulo. Live production restores,
network removal and device wipes require an explicit maintenance window.
