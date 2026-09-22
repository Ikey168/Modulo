# Digital Security & Identity

This local-first pack tracks security posture without becoming a secret manager.

- **Security Inventory** covers accounts, devices, public wallet addresses, and identities.
- **Keys, Backups & Recovery** covers rotation reminders, backup checks, recovery exercises, and emergency access.
- **Incidents & Procedures** covers response procedures, exercises, incident timelines, and follow-up.
- **Security Command Center** surfaces reviews, failures, at-risk records, upcoming checks, and recovery readiness.

## No-secret boundary

Only metadata and references to an external secret manager belong here. The forms contain no password, seed, mnemonic, passphrase, or private-key fields. Security-store writes are additionally rejected when they contain common secret-assignment patterns or PEM private-key material. Public wallet addresses are allowed.

The pack has no implicit connection to an identity provider, password manager, wallet, cloud account, or device-management service.
