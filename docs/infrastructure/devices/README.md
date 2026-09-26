# Device roles and inventory

This directory is the non-secret, versioned companion to Modulo Knowledge note
#51. The note is the human-facing authority; `inventory.json` is the
machine-checkable inventory. Both describe exactly six owner devices and keep
unknown runtime state explicit instead of treating a target design as deployed.

## Role contract

| Canonical name | Boundary | Role | State authority |
| --- | --- | --- | --- |
| `desktop` | personal | physical engineering workstation | Git, managed records, encrypted recovery custody |
| `laptop` | personal | thin portable workstation | Git and managed personal-file services; no unique services |
| `phone` | personal | communications, authentication and capture | application/cloud exports plus offline recovery custody |
| `home-pi` | home infrastructure | always-on homeserver for records, communications and private services | versioned deployment definitions plus encrypted service backups |
| `dev-netcup` | development | canonical remote development compute | Git and reproducible disposable development services |
| `prod-oracle` | production | Modulo and Noesis production only | GitHub/CI, production databases and encrypted off-host backups |

Names are stable identifiers. Current hostnames and addresses are observations,
not authorities. Address changes therefore do not create a new inventory item.

## Boundaries

- Personal devices may initiate development access; they do not inherit
  unattended production administration.
- Netcup is development only. It must not hold production deploy credentials or
  become a recovery dependency for Oracle.
- Oracle is production only. Interactive development, experiments, agent
  sandboxes and personal shell state are out of scope.
- The Pi is an always-on homeserver. Paperless, Matrix/bridges, monitoring and
  other private services are its intended workload; experimental firmware,
  disposable labs and hardware-development targets belong on the desktop bench.
- Secrets, private keys, recovery codes, device unlock material and provider
  credentials never belong in the inventory or repository.

## Evidence states

`verified` means a safe runtime check was performed from an authorized path.
`partial` means the device was observed or its service runtime was verified but
one or more host controls remain untested. `blocked` means no authorized runtime
or control-plane evidence is currently available.

The structural validator must pass on every change:

```sh
python3 scripts/verify-device-inventory.py \
  docs/infrastructure/devices/inventory.json
```

Strict evidence mode is the project acceptance gate. It intentionally fails
until all six devices have `verified` evidence and no recorded gaps:

```sh
python3 scripts/verify-device-inventory.py --strict-evidence \
  docs/infrastructure/devices/inventory.json
```

## Operations

The account owner reviews the inventory quarterly and after a replacement,
role, network, access or authority change. A review confirms:

1. the device still has one primary role and the correct trust boundary;
2. its canonical name is used by private networking, SSH, monitoring and
   deployment configuration where applicable;
3. administrative access is key/passkey-based and public password login is not
   enabled;
4. irreplaceable state has a named authority outside the endpoint;
5. the rebuild path remains usable without copying secrets into the repository;
6. stale devices, credentials, monitoring targets and backup jobs are retired
   only after replacement evidence and rollback readiness exist.

Failures are recorded as gaps in `inventory.json` and in note #51. A failed
check never causes automatic device reconfiguration, credential rotation,
deletion or restore.

See [rebuild.md](rebuild.md) for recovery order and device-specific acceptance,
and [netcup-access-acceptance-2026-09-21.md](netcup-access-acceptance-2026-09-21.md)
for the current Netcup evidence. The older
[verification-2026-09-20.md](verification-2026-09-20.md) remains the prior
six-device review and its unresolved gates are intentionally not rewritten.
Oracle's current enrollment evidence is in
[oracle-zerotier-acceptance-2026-09-21.md](oracle-zerotier-acceptance-2026-09-21.md).
