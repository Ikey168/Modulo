# Canonical device inventory

`inventory.json` is a non-secret six-device inventory. It records role,
boundary, lifecycle, safe network evidence, and rebuild authority; it does not
store credentials or recovery material.

The inventory is intentionally evidence-aware. `verified-local` means the
listed facts were inspected in the authorized runtime, not that every
cross-device or recovery acceptance gate is complete. Run the default validator
for structural checks and use `--strict` only when all physical, provider,
private-network, and rebuild evidence has been collected.

The Netcup runtime authority is `infra/personal/`. Its provider-control-panel
recovery remains outside this repository; the non-secret procedure and
acceptance checklist are documented in `netcup-recovery.md`.
