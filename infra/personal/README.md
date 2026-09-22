# Personal Linux baseline

This is the non-secret configuration authority for the personal Linux roles.
It is deliberately safe to review and syntax-check from a development host;
the example inventory does not name a real host and no play is run by CI.

The Oracle profile describes a boring production host: key-only administration,
container runtime directories, protected backup state, and no development or
agent toolchain. Credentials, private keys, ZeroTier enrollment and provider
metadata stay outside this repository.

Validate before an explicitly approved apply:

```sh
ansible-playbook -i inventory.example.yml playbooks/oracle.yml --syntax-check
ansible-playbook -i inventory.example.yml playbooks/oracle.yml --check --diff
```

The real inventory must be supplied separately. A live apply still requires a
maintenance window, a working private-network path, and an independent backup.
