# Personal incident-response playbooks

This is the clean-device runbook for the personal security estate: email,
Bitwarden, GitHub, Modulo/Keycloak, domains and DNS, Oracle, Netcup, the edge
Pi, desktop, laptop and phone. Keep an encrypted offline copy with the recovery
kit. Do not put passwords, recovery codes, private keys, account identifiers or
provider support PINs in this file.

The order is deliberate: establish a known-clean control point, contain the
affected authority, preserve useful evidence, recover through an independent
path, and verify before returning to normal operation. This follows the NIST
incident-response lifecycle while remaining short enough to use under stress.

## Emergency start — use for every incident

- [ ] Move to physical safety. For theft, stalking or extortion, do not confront
      anyone; contact the appropriate carrier, provider, bank or authorities.
- [ ] Use a **known-clean device**. If none is available, boot trusted media or
      obtain a replacement device before entering Tier-0 credentials.
- [ ] Use a trusted network. Do not use the suspected device as a hotspot.
- [ ] Start the incident record below and use UTC timestamps.
- [ ] Write down what is known, what is only suspected, and the earliest likely
      exposure time. Do not invent certainty.
- [ ] Preserve screenshots, provider alerts, relevant logs and key/token
      fingerprints. Do not copy executable files from a suspected device.
- [ ] Confirm at least one **independent recovery path** before deleting the last
      working factor, session, key or recovery method.
- [ ] Contain the narrowest affected authority first. Broaden revocation when
      the exposure cannot be bounded.
- [ ] Do not rotate a secret on a compromised device. The replacement may be
      captured immediately.
- [ ] Do not destroy or reimage evidence until the preservation decision has
      been made. If crime, financial loss or third-party data may be involved,
      preserve first and seek qualified help.

### Severity and response target

| Level | Examples | Start response |
| --- | --- | --- |
| SEV-0 | Active email/Bitwarden/GitHub takeover, production admin compromise, all trusted devices lost | Immediately; freeze risky changes and deployments |
| SEV-1 | Stolen unlocked device, suspected malware, exposed Tier-0 token or key | Immediately |
| SEV-2 | Lost locked phone or YubiKey with no suspicious activity | Same day |
| SEV-3 | Blocked attempt or alert with no evidence of access | Within 24 hours; investigate and document |

## Incident record

Copy this block into a new private incident note. Store no live secrets in it.

```text
Incident ID: IR-YYYYMMDD-NN
Started (UTC):
Severity:
Reporter / contact channel:
Known-clean device used:
Affected assets and identities:
Known facts:
Unverified assumptions:
Earliest / latest possible exposure:
Containment actions (UTC + result):
Credentials/factors revoked (type + fingerprint/name only):
Evidence preserved and location:
Recovery actions (UTC + result):
Validation checks:
Residual risk / monitoring deadline:
Follow-up owners and dates:
Closed (UTC):
```

## 1. Lost YubiKey

Use this for a missing hardware key whether or not theft is suspected.

### Contain

- [ ] Determine which physical key is missing from its non-secret label or
      fingerprint; do not guess and revoke the backup key by mistake.
- [ ] From a known-clean device, prove that the backup YubiKey or another
      independent recovery method works on primary email and Bitwarden.
- [ ] Remove the missing key from every relying party in the Tier-0 inventory:
      primary/recovery email, Bitwarden, GitHub, domain/DNS, Oracle, Netcup,
      banking/government identities, and internal SSO/Keycloak where enrolled.
- [ ] If the key was attached to a lost unlocked device, its PIN may be known,
      or suspicious sign-ins exist, terminate sessions and follow the matching
      device/account-compromise playbook as well.
- [ ] Review sign-in and security-event history from the earliest possible loss.

### Recover

- [ ] Obtain a genuine replacement through a trusted channel.
- [ ] Register the replacement while the proven backup factor is available.
- [ ] Set a fresh FIDO2 PIN; enroll only intended FIDO/OATH/PIV functions.
- [ ] Maintain at least two independent hardware factors in separate custody.
- [ ] Update the non-secret factor inventory and encrypted recovery-kit copy.

### Verify

- [ ] Test both retained keys on email, Bitwarden and GitHub in a private window.
- [ ] Confirm the missing key no longer appears on any Tier-0 account.
- [ ] Confirm recovery codes and recovery email remain usable and separately
      stored.
- [ ] Monitor authentication alerts for at least 72 hours; record the result.

## 2. Stolen phone

### Contain

- [ ] From a known-clean device, use the platform's official device-finding
      service. Mark the phone lost/secure it first; capture last-seen time and
      location without travelling to confront anyone.
- [ ] If prompt recovery is unlikely, the phone was unlocked, or sensitive data
      is exposed, request remote erase. Record whether the erase is pending.
- [ ] Contact the carrier through a known number. Block the SIM/eSIM and IMEI as
      appropriate, replace the SIM/eSIM, and set or change the port-out/account
      PIN. Treat SMS recovery as exposed until replacement is complete.
- [ ] Terminate the phone's sessions in the Apple/Google account, primary and
      recovery email, Bitwarden, GitHub, Modulo/Keycloak, financial accounts and
      other Tier-0 services.
- [ ] Remove the lost device and any unknown passkeys or authentication methods.
      Distinguish device-bound passkeys from intentionally synced passkeys.
- [ ] If Bitwarden was unlocked or its local data may have been accessible,
      execute the Bitwarden/vault-compromise procedure below.
- [ ] Review email, password-manager and provider security events for activity
      since the earliest possible theft.

### Recover

- [ ] Provision a replacement from a factory-reset/known-good state with a new
      strong device PIN and current updates.
- [ ] Restore data only from a trusted backup; re-enroll passkeys and TOTP from
      independent recovery material rather than cloning device security state.
- [ ] Reconnect the replacement SIM/eSIM and verify incoming calls/SMS, carrier
      account protection and emergency access.
- [ ] Re-establish primary email and Bitwarden before ordinary applications.
- [ ] Rotate individual TOTP seeds or credentials when exposure is plausible;
      do not rotate blindly before a working replacement factor exists.

### Verify

- [ ] The stolen device is locked/erased or documented as pending, and it cannot
      access email, Bitwarden, GitHub, Modulo or financial services.
- [ ] No unknown device, passkey, forwarding rule, OAuth grant or recovery
      method remains.
- [ ] The replacement phone can authenticate with a separate hardware-key
      fallback.
- [ ] Monitor carrier, email and account alerts for at least seven days.

## 3. Compromised laptop or desktop

### Contain

- [ ] Disconnect Wi-Fi/Ethernet and attached storage. Do not continue ordinary
      work on the suspected host.
- [ ] If memory-resident evidence matters, leave power on and obtain qualified
      forensic help; otherwise keep the machine isolated. Do not run random
      cleanup tools before deciding what evidence is needed.
- [ ] From a known-clean device, terminate browser, email, Bitwarden, GitHub,
      cloud-provider, Modulo/Keycloak and administrative sessions.
- [ ] Inventory reachable authority: unlocked vault data, browser cookies,
      passkeys, SSH agent/keys, GPG/signing keys, `gh`/Git credentials, cloud CLI
      profiles, kube/Docker contexts, API tokens, environment files and mounted
      backups.
- [ ] Revoke exposed tokens and keys. If scope is uncertain, treat every secret
      readable by the user account as exposed and broaden rotation accordingly.
- [ ] Freeze releases and sensitive account changes until GitHub/cloud activity
      has been reviewed.

### Recover

- [ ] Preserve the required logs/image, then wipe the system disk and reinstall
      from trusted vendor/distribution media. Do not rely on in-place cleaning.
- [ ] Apply the versioned device profile and all updates before restoring data.
- [ ] Generate a fresh machine identity and fresh SSH/signing keys; never clone
      host keys, user private keys, browser profiles or sessions.
- [ ] Restore documents from a verified backup. Scan and manually review scripts,
      binaries, extensions, startup entries and dotfiles before reintroducing
      them.
- [ ] Reissue credentials from the known-clean control point and update dependent
      services one at a time.

### Verify

- [ ] Secure Boot/disk encryption, updates, firewall and endpoint configuration
      match the secure-device baseline.
- [ ] GitHub/cloud/email logs show no unexplained activity after containment.
- [ ] Old host keys, sessions and tokens fail; new credentials work only from the
      rebuilt device.
- [ ] Backup, restore and the device-specific failure path pass.

## 4. GitHub compromise

### Contain

- [ ] Use a known-clean device. Freeze deployments, package publication and
      secret-bearing workflows; notify affected collaborators through a channel
      not controlled by GitHub.
- [ ] Secure the primary email first if it may also be compromised.
- [ ] Change the GitHub password and review/remove unknown sessions, passkeys,
      2FA methods and recovery changes.
- [ ] Preserve the personal/organization security log and suspicious workflow,
      webhook, release, package and settings evidence before removing it.
- [ ] Revoke suspicious PATs, OAuth grants, GitHub Apps, SSH keys, signing keys,
      deploy keys and Codespaces credentials. If the scope cannot be bounded,
      revoke all affected credential classes and accept the controlled outage.
- [ ] Disable unauthorized workflows/apps/webhooks and rotate any secret they
      could read. Revocation of a GitHub credential does not rotate downstream
      cloud, registry, DNS or deployment secrets.

### Recover

- [ ] Review organization owners/members, repository collaborators, branch/rule
      protections, environments, Actions permissions, OIDC trust, secrets,
      variables, deploy keys, webhooks, Pages, packages and release artifacts.
- [ ] Compare changed workflows, source, tags and releases with a known-good
      commit or independent clone. Do not rewrite history until evidence is
      retained and downstream consumers are identified.
- [ ] Generate fresh SSH/signing/PAT credentials on a clean device with minimum
      scope and expiry. Update automations individually and document ownership.
- [ ] Rebuild and republish affected artifacts from reviewed source; invalidate
      or clearly mark untrusted releases/packages.
- [ ] Rotate registry, Oracle/Netcup, DNS, CI, signing and application secrets
      reachable from GitHub Actions or compromised apps.

### Verify

- [ ] Security logs show only expected sessions, keys, apps and changes.
- [ ] Protected branches/rules and required reviews prevent unilateral release.
- [ ] A reviewed commit produces a verified deployment through the normal
      immutable-release path.
- [ ] Revoked credentials fail and every replacement has an owner, scope and
      expiry/review date.

## 5. Production server or cloud-admin compromise

This covers Oracle production, Netcup development and a compromised edge Pi.
Treat host output as evidence from an untrusted system, not as proof of safety.

### Contain

- [ ] Secure the provider, domain/DNS, GitHub/registry and primary email control
      planes first. Use provider-console access rather than credentials stored on
      the affected host.
- [ ] Remove the host from DNS/load-balancing or restrict network rules to the
      clean administrative path. Do not merely stop one suspicious process.
- [ ] Decide whether evidence is required. If so, record UTC time and acquire a
      provider snapshot/log export before destructive changes, following legal
      and provider requirements.
- [ ] Preserve relevant cloud audit logs, authentication logs, deployment
      manifests, container/image digests, process/network listings and recent
      configuration changes. Never publish logs containing secrets.
- [ ] Revoke exposed cloud API keys, SSH keys, registry credentials, deploy
      tokens and administrative sessions from clean control planes.
- [ ] Assume lateral movement to GitHub Actions, registry, DNS, Keycloak,
      databases, backups, Netcup/Oracle and the Pi when credentials or network
      paths allowed it; start the corresponding playbooks.

### Recover

- [ ] Build a replacement host from known-good IaC/vendor images. Do not promote
      the compromised root filesystem or its host identities.
- [ ] For Modulo on Oracle, validate a retained snapshot with
      `deploy/oci/restore-drill.sh` and deploy reviewed immutable image digests
      through `deploy/oci/release.sh`; follow
      `docs/operations/oracle-deployment.md`.
- [ ] Restore only required durable data from a verified snapshot predating the
      compromise, then apply reviewed migrations. Retain the old environment
      isolated until investigation is complete.
- [ ] Issue fresh host, SSH, database, application, backup, monitoring, registry
      and CI credentials from clean systems. Rotate in dependency order and
      revoke the old value after the replacement is confirmed unless immediate
      revocation is required for containment.
- [ ] Review persistence points: cloud IAM, metadata/startup scripts, DNS,
      firewall/security lists, systemd/cron, SSH authorized keys, containers,
      images, registries, CI workflows, Keycloak admins/clients and database
      roles.

### Verify

- [ ] Provider audit history and network exposure match the intended inventory.
- [ ] The replacement passes service health, authenticated API, login, backup,
      restore-drill, monitoring and rollback checks.
- [ ] Old host keys, API keys, tokens and administrative paths fail.
- [ ] No production service trusts artifacts or credentials produced only by the
      compromised host.
- [ ] Heightened logs/alerts are reviewed for at least seven days.

## 6. Primary email compromise

### Contain

- [ ] Use the provider's official account-recovery flow from a known-clean
      device. If locked out, open a provider recovery case immediately.
- [ ] Change the password, terminate other sessions/devices, and remove unknown
      passkeys, security keys, TOTP methods, app passwords and trusted devices.
- [ ] Verify recovery email/phone/contact/key data before relying on it; remove
      unauthorized changes.
- [ ] Review and remove unknown OAuth/application grants, delegation, aliases,
      forwarding addresses, filters/rules, POP/IMAP access, send-as identities,
      vacation responses and blocked addresses.
- [ ] Preserve recent-security, login, sent, deleted/trash and mailbox-rule
      evidence. Search for password-reset and provider-security messages.
- [ ] Warn contacts through another channel if phishing or impersonation was
      sent. Contact banks/providers promptly if identity or financial abuse is
      possible.
- [ ] Assume password-reset control over Bitwarden, GitHub, domains/DNS, Oracle,
      Netcup, financial/government accounts and recovery email; review each.

### Recover

- [ ] Enroll two independent hardware-backed factors and refresh offline
      recovery codes after unauthorized methods are removed.
- [ ] Change reused passwords and recover downstream accounts in Tier-0 order.
- [ ] Re-authorize only necessary mail clients and OAuth apps.
- [ ] Restore deleted mail/rules with provider support where available.

### Verify

- [ ] Only expected sessions, devices, recovery methods, delegates, forwarding
      rules, filters and OAuth grants remain.
- [ ] Test inbound/outbound mail and password recovery without making email the
      only recovery path for Bitwarden.
- [ ] Downstream Tier-0 accounts show no unexplained resets or changes.
- [ ] Monitor security events and mailbox settings daily for at least seven days.

## 7. Complete device loss

Use when the phone and daily computers are unavailable or cannot be trusted.

### Contain

- [ ] Obtain a known-clean device and trusted network. Do not sign in on a
      borrowed device that cannot be wiped and controlled.
- [ ] Retrieve the offline recovery kit and backup hardware key from independent
      custody. Record access without exposing contents in the incident note.
- [ ] Secure/erase lost devices and block the SIM/eSIM using the stolen-phone
      playbook. Revoke lost-device sessions, passkeys and machine credentials.
- [ ] If theft or compromise is suspected, freeze GitHub deployments and cloud
      changes until identity roots are re-established.

### Recover

Recover in this order, testing each layer before proceeding:

1. [ ] Establish a clean device, safe network and incident log.
2. [ ] Recover primary and recovery email with the backup hardware key/recovery
       material; validate security settings and sessions.
3. [ ] Recover Bitwarden through an independent factor; deauthorize lost-device
       sessions and assess vault exposure.
4. [ ] Recover the carrier/SIM and phone account without making SMS the sole
       Tier-0 factor.
5. [ ] Recover GitHub, domain/DNS, registry and cloud provider control planes.
6. [ ] Validate Oracle, Netcup, Pi and Modulo/Keycloak; rotate lost machine and
       device credentials.
7. [ ] Provision replacement devices from trusted media and restore data-only
       backups according to `docs/infrastructure/devices/rebuild.md`.
8. [ ] Recover financial/government identities, then ordinary accounts.
9. [ ] Recreate and independently store a complete recovery kit; do not leave
       the only replacement factors together.

### Verify

- [ ] Email and Bitwarden each have two tested, independent recovery paths.
- [ ] Every lost device/session/key is absent or revoked on all Tier-0 accounts.
- [ ] GitHub/cloud/DNS/infrastructure activity is expected from the exposure
      window onward.
- [ ] Replacement-device backup and rebuild paths pass.
- [ ] Perform a second-person or next-day review before closing the incident.

## Cross-cutting: Bitwarden or vault exposure

- [ ] From a clean device, secure primary email and Bitwarden authentication,
      enable/verify two-step login, and deauthorize all other sessions.
- [ ] Determine whether only the account session was exposed or decrypted vault
      contents/account encryption keys may have been captured.
- [ ] Export a password-protected recovery backup to encrypted offline storage
      before encryption-key rotation; never place an unencrypted export in
      cloud sync, email or the incident record.
- [ ] If decrypted vault data may be exposed, rotate the Bitwarden account
      encryption key using Bitwarden's documented sequence, then rotate stored
      credentials in dependency order: email and recovery, Bitwarden recovery,
      GitHub/domain/cloud, financial/government, infrastructure, then ordinary
      accounts. Prioritize secrets that unlock many others.
- [ ] Revoke API keys, SSH keys, tokens and TOTP seeds as credentials, not merely
      their saved Bitwarden entries.
- [ ] Delete temporary exports securely after the encrypted recovery copy and
      replacement vault have been verified.

## Cross-cutting: one leaked token, API key or SSH/signing key

- [ ] Record the credential type, fingerprint/name, owner, scopes, locations,
      first possible exposure and dependent services—never the secret value.
- [ ] Revoke it at the issuing authority from a clean device. Deleting a local
      file is not revocation.
- [ ] Search issuer/audit logs for use during the exposure window.
- [ ] Generate a least-privilege, expiring replacement on a clean system and
      update dependencies individually.
- [ ] Confirm the old credential fails, the replacement works, and no duplicate
      or persistence mechanism remains.
- [ ] Remove the original leak from history/artifacts/backups where practical,
      but never treat history rewriting as a substitute for revocation.

## Shared closeout

- [ ] All containment and recovery actions have UTC timestamps and results.
- [ ] Every revoked credential was tested as rejected; every replacement was
      tested from its intended location.
- [ ] Security events were reviewed across the full possible exposure window.
- [ ] Monitoring has an owner and an explicit end date (minimum 72 hours for a
      bounded lost factor; seven days for account/device/server compromise).
- [ ] Backups, recovery factors and clean-device access still work.
- [ ] Root cause, blast radius, missed detection and preventive actions are
      recorded without secrets.
- [ ] Follow-up tasks have owners, priorities and dates. The incident is not
      closed merely because service was restored.
- [ ] The offline encrypted copy of this runbook and the non-secret inventory
      are refreshed after structural changes.

## Preparation checklist

These are prerequisites, not actions to improvise during an incident.

- [ ] Keep two hardware security keys in separate custody and test quarterly.
- [ ] Keep provider support paths, carrier contact details and non-secret asset/
      factor fingerprints in the encrypted offline recovery kit.
- [ ] Keep password-protected Bitwarden recovery exports and recovery codes
      offline; test restoration without exposing them.
- [ ] Enable security alerts and retain logs for email, Bitwarden, GitHub,
      domain/DNS, Oracle, Netcup, Keycloak and banking/government services.
- [ ] Maintain verified, off-host infrastructure backups and clean rebuild
      definitions. A backup on a compromised host is not an independent backup.
- [ ] Review this runbook after every incident and at least twice per year.

## Authoritative references

- NIST SP 800-61 Rev. 3, incident-response recommendations:
  <https://csrc.nist.gov/pubs/sp/800/61/r3/final>
- GitHub credential revocation:
  <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/revoking-your-credentials>
- Yubico guidance for a lost/stolen key and maintaining a backup:
  <https://www.yubico.com/blog/your-top-yubikey-questions-answered/>
- Android Find Hub secure/erase procedure:
  <https://support.google.com/android/answer/6160491>
- Apple stolen-device procedure:
  <https://support.apple.com/120837>
- Google account suspicious-activity checks:
  <https://support.google.com/accounts/answer/140921>
- Bitwarden security FAQ and account encryption-key rotation:
  <https://bitwarden.com/help/security-faqs/>
  <https://bitwarden.com/help/account-encryption-key/>

Review provider interfaces when executing a playbook; labels and recovery
rules change. Prefer the provider's current official documentation over stale
screen-by-screen instructions.
