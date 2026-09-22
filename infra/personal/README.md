# Personal infrastructure baseline

This directory is the non-secret configuration authority for the personal Linux
hosts. The Netcup machine is the first complete profile:

- inventory name: `dev-netcup`
- role: disposable development/build/agent compute
- public address: `185.162.249.37`
- ZeroTier address: `10.165.78.189`
- operating system: Debian 13/trixie, x86_64

The baseline deliberately does not contain provider credentials, private keys,
ZeroTier identity material, Modulo tokens, recovery codes, or backup passwords.
Those remain in their existing protected custody locations.

## Safe execution model

The playbook is split into explicit tags. Package installation, SSH policy,
firewall policy, and ZeroTier membership management are opt-in. The default
profile only manages low-risk role metadata, shell runtime activation, and
journald policy. The `dev-netcup` inventory explicitly opts into its runtime
units, SSH hardening, and ZeroTier-only administration firewall. Run the
read-only checks from a ZeroTier-connected control device before applying it:

```sh
cd infra/personal
./scripts/verify-netcup-baseline.sh
ansible-playbook -i inventory/hosts.yml playbooks/site.yml --check --diff --limit dev-netcup
```

The live host currently has the runtime units installed. The templates here are
the reproducible source for those units. The `dev-netcup` inventory explicitly
enables SSH hardening and the ZeroTier-only administration firewall; the policy
allows new SSH only on `ztpp6mnpl3` and drops new SSH on other interfaces.

## Backup boundary

`backup-boundary.yml` defines the disposable-development backup boundary. The
backup helper includes source trees and explicitly selected local configuration,
while excluding credential stores, SSH material, caches, generated build
outputs, and environment files. It requires an operator-supplied destination;
it never uploads to an implicit provider or invents credentials.

Use `scripts/verify-netcup-backup.sh` against an archive before treating a
backup as accepted. The local isolated restore boundary is tested by the
repository checks; off-site acceptance still requires a real destination and a
restore from that destination.
