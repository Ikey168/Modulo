# Personal device inventory contract

inventory.json is the non-secret inventory for the six-device estate:
desktop, laptop, phone, edge-pi, dev-netcup and prod-oracle.

It records roles, trust boundaries, lifecycle state, state authorities and
rebuild profiles. It deliberately does not record host credentials, private
keys, recovery codes, provider account identifiers or device unlock material.

The account owner is the approval authority. Review the inventory quarterly and
after a replacement, role change, network change or access change.

Validation:

    python3 scripts/verify-device-inventory.py
    python3 scripts/verify-device-inventory.py --strict

The ordinary check verifies the static contract. Strict mode is an acceptance
gate and requires current runtime evidence for every device; it is expected to
fail while any physical or provider-owned evidence is outstanding.
