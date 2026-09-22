# Netcup recovery and rebuild runbook

This runbook covers recovery of the disposable Netcup development host. It
contains procedures and acceptance checks only; provider identifiers,
credentials, private keys, recovery codes, and backup passwords remain in
their protected custody locations.

## Recovery prerequisites

The operator must have two independent recovery paths available before
starting a destructive operation:

1. owner access to the Netcup customer-control panel or provider rescue/console
   path;
2. owner access to the ZeroTier network and an authorized administration
   device.

Record only non-secret provider and support identifiers in the identity
inventory. Do not place them in this repository if they reveal more access
than the recovery process requires.

## If the host is still running

1. Connect through ZeroTier at `10.165.78.189` using the operator's authorized
   SSH key.
2. Run `infra/personal/scripts/verify-netcup-baseline.sh`.
3. Capture the latest `/var/lib/dev-netcup-health/last.json` status without
   copying credentials or private state.
4. Create a boundary-checked archive with
   `NETCUP_BACKUP_DEST=/absolute/path infra/personal/scripts/backup-netcup-state.sh`.
5. Verify the archive with
   `infra/personal/scripts/verify-netcup-backup.sh` before storing or moving it.

## Rebuild sequence

1. Confirm the target server, role, owner, provider recovery path, and rollback
   decision.
2. Use the provider's trusted install or rescue workflow to install the
   supported Debian release and apply security updates.
3. Re-enrol the new machine into the owner-controlled ZeroTier network and
   authorize the new member from ZeroTier Central.
4. Create a fresh machine identity and named non-root administrator key. Never
   clone `/etc/ssh`, ZeroTier identity material, or private keys from the old
   host.
5. Clone or restore the trusted repository and run the personal Ansible
   profile against the ZeroTier address.
6. Restore only accepted state categories. Recreate build caches and generated
   outputs from lockfiles and source; do not restore them as valuable state.
7. If an off-site restic repository is configured, run its repository check and
   tagged-snapshot restore into an isolated directory before accepting the
   rebuild.

## Acceptance

The replacement is accepted only after all of the following pass:

- `infra/personal/scripts/verify-netcup-baseline.sh`;
- `mise run check-operations` from the repository root;
- SSH login over ZeroTier from each authorized administration device;
- a negative test that new public TCP/22 connections are filtered;
- health and maintenance timers are enabled and active;
- any configured backup has a successful verification and isolated restore;
- the old host and state remain available until the owner records the
  acceptance decision.

Provider recovery, off-site backup, and destroy/rebuild acceptance are
separate gates. A source archive or local isolated restore does not prove that
an external repository or provider recovery path works.
