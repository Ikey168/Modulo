# Personal infrastructure configuration

This directory is the non-secret, declarative host baseline for the six-device
inventory. It does not contain provider credentials, private keys, recovery
material or application `.env` files.

Roles are explicit:

- `desktop`: engineering workstation;
- `laptop`: thin portable workstation;
- `phone`: owner-managed and outside Ansible;
- `home-pi`: always-on Raspberry Pi 5 homeserver;
- `dev-netcup`: disposable remote development compute;
- `prod-oracle`: minimal production host for Modulo, Noesis and Praxis.

The Pi is not an edge lab. Hardware experiments and untrusted firmware remain
on the desktop bench.

## Bootstrap and inspect

Install the pinned controller dependencies without changing a managed host:

```sh
uv sync --project infra/personal --locked
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook \
  -i infra/personal/inventory.example.yml \
  infra/personal/playbooks/audit.yml
```

The example inventory deliberately leaves the laptop address as
`owner-evidence-required`; the owner-supplied Netcup public address is recorded
for the named `ik` administrator, but copy the inventory outside Git and review
all target values before applying it. Supply SSH keys through the SSH agent or
`ANSIBLE_PRIVATE_KEY_FILE`, never through inventory.

Preview configuration changes first:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --check --diff \
  -i /secure/path/inventory.yml infra/personal/playbooks/site.yml
```

Apply one host at a time only after the audit succeeds and a second
administrative path is available:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --diff \
  -i /secure/path/inventory.yml infra/personal/playbooks/site.yml \
  --limit home-pi
```

SSH hardening is opt-in per host with `manage_ssh: true`. The role validates
the effective daemon configuration before reload. Hostname changes are not
automatic; canonical inventory names do not silently replace working service
hostnames.

## What the baseline owns

- common administration and transfer packages;
- time synchronization and the Europe/Berlin timezone;
- bounded persistent journal storage;
- automatic security-update packages/timers where supported;
- a non-secret role marker;
- optional SSH password/root-login denial;
- Restic/rclone client prerequisites and protected configuration directories;
- workstation development CLI packages;
- validation that Docker is present where a container role requires it.

The `development_servers` group additionally receives Docker/Compose, build
tools, GitHub CLI, Maven and `mise`. Exact project runtimes remain declared by
each repository (for Modulo, `.mise.toml`) instead of drifting into an
unversioned host-global toolchain. The profile records that production
credentials and authoritative personal data are forbidden on disposable DEV.
It also installs a 15-minute health timer; its latest machine-readable result
is retained at `/var/lib/dev-netcup-health/last.json`.
Docker JSON logs are bounded to three 25 MiB files per container, and a weekly
timer removes unused development artifacts older than seven days without
pruning volumes.

The `private_network_members` group enrolls the declared development and
production hosts in ZeroTier using the fingerprint-pinned official repository.
It allows managed private addresses but disallows ZeroTier default/global
routes and DNS replacement. Production membership can be applied separately:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook \
  -i /secure/path/inventory.yml infra/personal/playbooks/private-network.yml
```

ZeroTier is allowed to assign the host's managed private address, but is
explicitly forbidden from replacing the default route or DNS. Keep
`remote_development_private_ssh_only: false` until the network member is
authorized and a separate SSH session over its ZeroTier address succeeds.
After that proof, setting the variable to `true` enables a default-deny nftables
policy with SSH reachable only through ZeroTier. Netcup's console remains the
out-of-band recovery path.

Application topology stays in `deploy/oci`, `deploy/pi` and service-specific
repositories. Secrets remain in protected host/provider custody. Recovery uses
`docs/infrastructure/recovery/README.md`.

## Verification

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --syntax-check \
  -i infra/personal/inventory.example.yml infra/personal/playbooks/site.yml
python3 scripts/verify-personal-infra.py
```
