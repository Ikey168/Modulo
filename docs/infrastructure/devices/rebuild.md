# Device rebuild contract

Rebuilds restore a role, not a machine image. Start from trusted operating
system media, apply the matching versioned profile, enroll a fresh machine
identity, restore only the data assigned to that device, and run the profile's
verification checks.

| Device | Rebuild authority | Do not clone |
| --- | --- | --- |
| desktop | personal Linux profile and Git/IaC | SSH keys, account sessions, hardware secrets |
| laptop | personal Linux profile and Git/IaC | endpoint state or recovery factors |
| phone | vendor restore plus owner account recovery | passkeys, SIM credentials, recovery codes |
| edge-pi | home-service definitions and tested data backups | service secrets or host identity |
| dev-netcup | disposable server profile and Git/IaC | development credentials and caches |
| prod-oracle | CI release manifest, deploy/oci and verified backups | production volumes or credentials from another host |

Before any destructive rebuild, verify an independent backup and record the
maintenance window. Afterward, test access, service health, backup scheduling,
rollback and the device-specific failure path.
