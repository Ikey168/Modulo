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

For Netcup, connect through the separately proven, source-restricted root
break-glass key and keep `remote_development_admin_user: ik`. This lets Ansible
manage the host after passwordless sudo is removed without turning the root SSH
session into the day-to-day developer account:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --check --diff \
  -i /secure/path/inventory.yml \
  infra/personal/playbooks/development-server.yml

ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --diff \
  -i /secure/path/inventory.yml \
  infra/personal/playbooks/development-server.yml
```

The Netcup inventory explicitly sets `baseline_ssh_permit_root_login` to
`prohibit-password`; the authorized key remains source-restricted. All other
managed hosts default to denying root SSH entirely.

After cloning Modulo into the managed checkout root, trust its reviewed mise
configuration, install the declared runtimes as the unprivileged administrator,
and run the root-readable host acceptance:

```sh
ssh netcup 'mise trust /home/ik/Development/Modulo/.mise.toml && \
  mise install --cd /home/ik/Development/Modulo && \
  rustup toolchain install 1.94.1 --profile minimal \
    --target wasm32-unknown-unknown'
ssh -l root netcup \
  'python3 /home/ik/Development/Modulo/scripts/verify-netcup-development.py \
    --project /home/ik/Development/Modulo --admin-user ik'
```

Apply one host at a time only after the audit succeeds and a second
administrative path is available:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --diff \
  -i /secure/path/inventory.yml infra/personal/playbooks/site.yml \
  --limit home-pi
```

Bootstrap a clean workstation with a reviewed inventory outside Git. The
inventory must place exactly the intended target in the `workstations` group;
the dedicated playbook does not touch servers or the home Pi:

```sh
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook \
  -i /secure/path/clean-workstation.yml \
  infra/personal/playbooks/prepare-workstation.yml

ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --check --diff \
  -i /secure/path/clean-workstation.yml \
  infra/personal/playbooks/workstation.yml

ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --diff \
  -i /secure/path/clean-workstation.yml \
  infra/personal/playbooks/workstation.yml

python3 scripts/verify-workstation-bootstrap.py \
  --project /path/to/a/clean/project/checkout
```

The functional verifier requires the shared CLI, the role marker, the external
backup-secret boundary and project-tool declarations. Add
`--expect-sshd-hardening` when the inventory sets `manage_ssh: true`; client-only
workstations are not required to run an SSH server. The verifier reports
optional parity commands separately so workstation drift is visible without
pretending that project-owned runtimes are host-global dependencies.
The preparation stage is intentionally narrow: it installs only Python and the
distribution package bindings Ansible needs to perform an honest dry run.

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
tools, GitHub CLI, Maven, `mise` and `rustup`. Exact project runtimes remain declared by
each repository (for Modulo, `.mise.toml`) instead of drifting into an
unversioned host-global toolchain; the Rust WASM example pins its compiler and
target in `rust-toolchain.toml`. The profile records that production
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
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --syntax-check \
  -i infra/personal/inventory.example.yml infra/personal/playbooks/prepare-workstation.yml
ANSIBLE_CONFIG=infra/personal/ansible.cfg \
uv run --project infra/personal ansible-playbook --syntax-check \
  -i infra/personal/inventory.example.yml infra/personal/playbooks/workstation.yml
python3 scripts/verify-personal-infra.py
```
