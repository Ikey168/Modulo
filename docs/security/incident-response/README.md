# Security incident-response playbooks

These playbooks define the first actions, containment order, recovery path and
acceptance evidence for common personal-infrastructure incidents. They never
contain credentials, recovery codes, private keys or token values.

## Universal first response

1. Move to a known-clean device and network. Do not use a possibly compromised
   browser to rotate the credentials that protect it.
2. Record the detection time, affected identity/device, observed indicators and
   last known-good time. Preserve screenshots and provider audit events without
   copying message/document contents unnecessarily.
3. Contain first: revoke the narrowest affected session, token, key or device.
   Escalate to account-wide resets only when the blast radius is unknown.
4. Preserve evidence before reimaging or deleting. Do not execute unknown files
   merely to identify them.
5. Recover from an independent factor or offline custody. Never send recovery
   codes through chat, email or Modulo.
6. Validate replacement access, remove the old access path, review activity,
   and record follow-up work.

If primary email, the password manager and a daily hardware key may all be
affected, use the full owner-led recovery exercise rather than improvising.

## Lost or stolen hardware security key

1. From a known-clean device, inventory which accounts accepted the lost key.
2. Authenticate with Backup Key B or another independently enrolled factor.
3. Revoke the lost key from email, Bitwarden, GitHub, cloud, registrar and other
   Tier-0 accounts. Do not revoke the working backup factor first.
4. Review recent sign-ins and active sessions on every affected Tier-0 account.
5. Enrol a replacement key, label it uniquely, and test it in a private window.
6. Confirm two independent usable factors remain, then update offline custody.

Acceptance: the lost key is absent everywhere, the replacement and backup key
both work, recovery codes remain independently available, and no unexplained
session remains.

## Lost phone, SIM or eSIM

1. Ask the carrier to block the SIM/eSIM and protect replacement/port-out with
   the account's established verification route.
2. Mark the phone lost and request remote lock/wipe only after confirming that
   unique device data has another authority.
3. Revoke the device from primary email, password manager, Matrix, Signal,
   WhatsApp, Telegram, GitHub, cloud accounts and the private overlay network.
4. Replace the SIM/eSIM through the carrier's verified path. Treat unexpected
   loss of service as a possible SIM-swap incident.
5. Provision a replacement phone from a known-clean image. Restore data before
   re-enrolling authenticators; do not clone unknown device state wholesale.
6. Re-register phone-bound messengers, review linked devices/sessions and test
   native fallback applications.

Acceptance: the old phone and SIM cannot authenticate, the replacement receives
calls/messages, Tier-0 MFA works without weakening it to SMS where stronger
factors are supported, and messenger linked-device lists are clean.

## Password-manager compromise

1. Use a known-clean device. End all Bitwarden sessions and revoke unknown
   devices before changing downstream credentials.
2. Change the master passphrase if exposure is plausible; retain the known KDF
   policy and verify the new credential before closing the recovery session.
3. Rotate email and Tier-0 credentials first, then server/cloud administration,
   financial accounts, developer tokens and ordinary services.
4. Replace exposed TOTP seeds, recovery codes, passkeys and API credentials.
5. Review vault items for malicious URL/username changes and unexpected shares.
6. Create and independently test a new encrypted export only after the vault is
   trusted again. Retire superseded recovery material.

Do not mass-rotate from an infected workstation. Acceptance requires a clean
session inventory, tested new primary/backup access and a documented rotation
ledger that contains references, never secret values.

## Compromised browser or active web session

1. Disconnect the browser profile from sync and stop using it for authentication.
2. From a clean device, terminate browser/account sessions for email, Bitwarden,
   GitHub, cloud, registrar, banking and Modulo as applicable.
3. Review installed extensions, enterprise policies, download history and
   permission grants. Preserve suspicious extension identifiers and hashes.
4. Revoke OAuth grants created or used during the suspected window.
5. Delete the compromised profile or reimage the host if credential theft cannot
   be bounded. Recreate profiles from deliberate configuration, not profile copy.

Acceptance: new sessions require fresh authentication, no suspicious extension
or grant remains, and Tier-0 account audit logs show no unexplained activity.

## Compromised workstation or laptop

1. Isolate it from LAN, Wi-Fi, ZeroTier and cloud sync without powering it off if
   volatile evidence is important and safe to preserve.
2. Revoke its SSH keys, GitHub credentials, API tokens, browser sessions, device
   registrations and overlay membership from a known-clean device.
3. Inventory repositories with unpushed commits and non-Git data from backups or
   remote evidence; do not execute binaries from the affected filesystem.
4. Preserve a disk image/log bundle if investigation is warranted.
5. Reimage from trusted installation media. Rebuild using the documented device
   baseline; restore only data, not unknown executables or whole home directories.
6. Generate new device credentials and run repository/application verification.

Acceptance: old credentials fail, the rebuilt host matches the inventory, data
authorities reconcile, and security/update/backup checks pass.

## Leaked API token, PAT or OAuth credential

1. Revoke the specific credential immediately at its issuer. Disabling a local
   environment variable is not revocation.
2. Search provider audit logs for its identifier, scopes, source addresses and
   use during the exposure window.
3. Search Git history, CI logs/artifacts, container layers and deployment files
   for copies without printing the value to logs.
4. Remove the source of leakage. Purge public history/artifacts where possible,
   while assuming every published secret was copied.
5. Issue a least-privilege replacement only if still required. Update the trusted
   secret store and redeploy dependants deliberately.

Acceptance: issuer confirms revocation, the leaked credential fails, dependent
services use a scoped replacement, and no repository or artifact contains it.

## Leaked SSH or signing key

1. Remove the public key from every authorized_keys, Git host, cloud account and
   signing trust store. Revoke its certificate where a CA is used.
2. Review SSH, sudo, Git-signing and provider logs for use during exposure.
3. Generate a replacement on a known-clean device; never copy the compromised
   private key forward.
4. Update host-key pinning or signing policy only after verifying the new key by
   an independent channel.
5. Re-sign or annotate affected releases/commits according to repository policy;
   do not rewrite shared history silently.

## Suspicious GitHub App, OAuth grant or workflow

1. Suspend or uninstall the app/grant and disable the affected workflow.
2. Inspect organization/repository audit events, installations, webhook targets,
   deploy keys, Actions secrets, environments and recent releases.
3. Revoke generated tokens and rotate any downstream credential the workflow
   could read. Ordinary pull-request workflows must not receive production keys.
4. Compare workflow files and branch protection with a known-good revision.
5. Restore only the minimum approved permissions and monitor the next run.

Acceptance: installation and token scopes match the approved inventory, branch
protections hold, and a clean CI run produces expected immutable artifacts.

## Email account takeover

1. Use an independent recovery factor/device. Change the password and revoke all
   sessions, app passwords, OAuth grants and forwarding/filter rules.
2. Review recovery addresses, phone numbers, passkeys, hardware keys and mailbox
   delegates. Preserve malicious rule/header evidence before removal.
3. Search sent, deleted and archived mail for account-recovery attempts during
   the incident window; notify affected contacts without forwarding malicious
   content.
4. Recover downstream Tier-0 accounts that use this mailbox, then rotate their
   recovery paths.

Acceptance: two independent phishing-resistant factors work where supported,
recovery routes are correct, no hidden forwarding/delegate remains, and all
sessions are attributable.

## Server or cloud administrative compromise

1. Remove the host/account from public traffic and private overlay access. Take
   a provider snapshot when it preserves evidence without extending exposure.
2. Revoke SSH, cloud API, CI/CD, service-account and deployment credentials.
3. Review provider control-plane events, SSH/auth logs, sudo history, containers,
   systemd units, network listeners and persistence mechanisms.
4. Rebuild a replacement from versioned configuration and immutable artifacts.
   Restore data into isolated volumes using the recovery runbook.
5. Validate identity, TLS, authentication, data integrity and application health
   before changing DNS or rejoining private networks.

Acceptance: the compromised host is fenced, unexplained persistence is absent
from the replacement, credentials are new, and deployment plus restore evidence
is recorded.

## Closeout and evidence

Every incident record includes detection and containment times, systems and
credential identifiers (not values), evidence locations, revocations, recovery
source, verification results, residual risk and follow-up tasks. Rehearse these
playbooks through the separate full security-recovery exercise; documentation
alone is not proof that owner-held factors work.

Run the structural check after editing:

```sh
python3 scripts/verify-incident-playbooks.py
```
