# Netcup access and baseline acceptance

Date: 2026-09-21 (Europe/Berlin)

This document records non-secret live evidence for the disposable development
host. It is intentionally not a provider recovery record and contains no
passwords, private keys, tokens, or recovery codes.

## Live identity

- Inventory name: `dev-netcup`
- Provider hostname: `v2202609388785525256.ultrasrv.de`
- OS: Debian GNU/Linux 13 (trixie), x86_64
- Public IPv4: `185.162.249.37`
- ZeroTier IPv4: `10.165.78.189/24`
- ZeroTier network: `88c5b1f339774e42`, status `OK`
- ZeroTier node: `dda91e801f`
- Administrator: named non-root user `ik`

## Access controls

Live `sshd -T` evidence confirms:

- public-key authentication enabled;
- password authentication disabled;
- keyboard-interactive authentication disabled;
- root login disabled.

The live nftables policy allows new TCP/22 only on `ztpp6mnpl3` and drops new
TCP/22 on all other interfaces. The public listener remains present for
service continuity, but public SSH connections are filtered before reaching
authentication. The pre-existing public control session was allowed to finish
without being interrupted during the cutover.

## Runtime evidence

- `docker.service`: active
- `zerotier-one.service`: active
- `unattended-upgrades.service`: active and enabled
- `dev-netcup-health.timer`: active and enabled
- `dev-netcup-docker-prune.timer`: active and enabled
- `netcup-ssh-zerotier-firewall.service`: active and enabled
- latest health JSON: healthy, ZeroTier network `OK`, administration firewall
  active, root disk below 90%
- root disk usage at acceptance: 3%

## Network boundary verification

From the connected `pi5`, `laptop`, and `oracle` peers, TCP/22 on
`10.165.78.189` was reachable and TCP/22 on the public address timed out. The
peer-side machine key was not used as an operator login key on Netcup, so this
check proves the network boundary and leaves operator-key authentication to the
owner's authorized client.

The repository authority for this configuration is `infra/personal/`. The
read-only verifier is `infra/personal/scripts/verify-netcup-baseline.sh`.

## Remaining acceptance gates

The following are not claimed complete by this evidence:

- Netcup customer-control-panel recovery and provider identifiers;
- an off-site/immutable backup destination and restore from that destination;
- a provider-level destroy/rebuild exercise;
- cross-device acceptance for the desktop, laptop, Pi, Oracle, router, and
  OpenWrt roles;
- any change to the broad NOPASSWD sudo grant.
