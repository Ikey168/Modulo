# Tier-0 identity and recovery register

Task: **02 · Record each Tier-0 login URL, account owner, non-secret account/support identifier, billing owner, and authoritative recovery contact**

Project: Establish Identity Roots & Recovery  
Area: Security, Identity & Access  
Priority: P2  
Due date: none  
Status: **Done** (accepted 2026-09-19)  
Last reviewed: 2026-09-19 (Europe/Berlin)

## Handling rule

This register contains only non-secret identifiers and references. Do not add passwords, passkeys, API keys, private-key material, one-time codes, recovery-code contents, SIM PINs/PUKs, support PINs, or YubiKey secrets. Store only a pointer such as “Bitwarden item: …” or “sealed recovery kit: …” when a secret needs to be located.

## Evidence labels

- **Diagram** — supplied current-state diagram on 2026-09-19.
- **Alias export** — `/home/ik/Downloads/aliases.csv`, 209 enabled aliases.
- **Local** — non-secret local configuration or repository metadata.
- **Public** — public DNS, RDAP, or provider API data checked on 2026-09-19.
- **Confirm** — private provider-console data that could not be safely verified from the supplied material.

## Current-state dependency map

The supplied diagram establishes the following recovery/control shape:

- YubiKey protects the mailbox roots and the Tier-0 service accounts.
- `paleport@proton.me` is the independent recovery mailbox for `ilja@krasnjanski.com`.
- `ilja@krasnjanski.com` is the primary mailbox identity and the SimpleLogin account/recovery contact.
- Cloudflare controls DNS and registration for `krasnjanski.com` and `krasnjanski-mail.com`; therefore it is upstream of both the primary mailbox and SimpleLogin custom-domain delivery.
- SimpleLogin supplies the service-specific aliases used by the downstream accounts.
- Bitwarden holds the account references/credentials for the downstream accounts.

Arrows in the diagram are treated as dependency evidence, not proof of a provider's configured recovery field. Provider-console confirmation is still required where noted.

## Register

| System / asset | Canonical login | Account owner | Login identity / alias | Safe account or support identifier | Billing owner | Current recovery contact / dependency | Escalation channel | Evidence and status |
|---|---|---|---|---|---|---|---|---|
| Proton Mail root | https://account.proton.me/login | Ilja, personal account; exact legal owner string **Confirm** | `paleport@proton.me` | Account email only; plan/account number **Confirm** | **Confirm** in Proton account | `ilja@krasnjanski.com` per diagram; configured recovery method **Confirm** | https://proton.me/support/contact | **Diagram**; private settings unverified |
| Google primary identity / mail | https://accounts.google.com/ | Ilja, personal/domain account; exact legal owner string **Confirm** | `ilja@krasnjanski.com` | Domain `krasnjanski.com`; Google customer ID **Confirm** | **Confirm** in Google payments/admin | `paleport@proton.me` per diagram; configured recovery phone/email **Confirm** | https://accounts.google.com/signin/recovery | **Diagram**; MX is Google (`smtp.google.com`) **Public** |
| YubiKey recovery factors | N/A (hardware factor) | Ilja | N/A | Key model, serial suffix, firmware, and physical custody references **Confirm** | Ilja / purchaser **Confirm** | Record at least primary and spare-key custody references; no codes | https://support.yubico.com/ | **Diagram**; inventory details missing |
| Cloudflare registrar and DNS | https://dash.cloudflare.com/ | Ilja / Cloudflare account; exact member and legal owner **Confirm** | `admin-cloudflare@krasnjanski-mail.com` → `admin@krasnjanski.com` | Account ID **Confirm**; zones `krasnjanski.com`, `krasnjanski-mail.com`; both registrar: Cloudflare, Inc.; nameservers `kanye.ns.cloudflare.com`, `lindsey.ns.cloudflare.com` | Billing profile/contact **Confirm** | Login/account email appears to be the alias at left; verify it and at least one additional Super Administrator | https://developers.cloudflare.com/support/contacting-cloudflare-support/ and https://developers.cloudflare.com/fundamentals/user-profiles/account-recovery/ | Alias **Alias export**; registrar/NS **Public**; account settings unverified |
| SimpleLogin alias service | https://app.simplelogin.io/auth/login | Ilja, personal account **Confirm** | `ilja@krasnjanski.com` per diagram | Custom domain `krasnjanski-mail.com`; 209 enabled aliases in export | Plan/payment owner **Confirm** | `ilja@krasnjanski.com` per diagram; Proton-linked sign-in status and recovery method **Confirm** | https://simplelogin.io/contact/; `simplelogin@support.proton.me` | **Diagram**, **Alias export** |
| Bitwarden vault | https://vault.bitwarden.com/ or https://vault.bitwarden.eu/ (**Confirm region**) | Ilja, personal vault **Confirm** | `admin-bitwarden@krasnjanski-mail.com` → `admin@krasnjanski.com` | Server region, account fingerprint, organization name/ID **Confirm** | Subscription owner **Confirm** | Login alias at left; trusted emergency contact and organization recovery policy **Confirm** | https://bitwarden.com/help/ | Alias **Alias export**; private settings unverified |
| GitHub organization | https://github.com/login | Organization `Ikey168`; actual organization-owner user(s) **Confirm** | `dev-github@krasnjanski-mail.com` → `dev@krasnjanski.com`; security notices: `security-github@krasnjanski-mail.com` → `security@krasnjanski.com` | Org login `Ikey168`; org numeric ID `122488906`; node ID `O_kgDOB00ISg`; primary repo `Ikey168/Modulo` | Organization owner or billing manager **Confirm** | Account recovery email **Confirm**; dependency on SimpleLogin/primary mail and YubiKey per diagram | https://support.github.com/ | Org/API/remote **Public/Local**; owner membership is private and unverified |
| Oracle Cloud Infrastructure | https://cloud.oracle.com/?tenant=quaesitor&region=eu-frankfurt-1 | Ilja / OCI tenancy; legal owner **Confirm** | `admin-oracle@krasnjanski-mail.com` → `admin@krasnjanski.com` | Tenancy name `quaesitor`; tenancy OCID `ocid1.tenancy.oc1..aaaaaaaajpeg4y2x5wmpypro3c5lgdc3hv6rwmveemz6f3wwuwou7eofkowq`; home region `FRA` / `eu-frankfurt-1`; deploy IAM user OCID `ocid1.user.oc1..aaaaaaaabskztgop3jxf3lbapv77eyf57zg4zuelu3rxulj7cy7ykn5uqc3q`; CSI/support identifier **Confirm** | OCI billing-account owner/contact **Confirm** | Login alias at left; additional tenancy administrator and recovery contact **Confirm** | https://support.oracle.com/; sign-in trouble: https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signinginIdentityDomain.htm | Alias **Alias export**; tenancy details **Local**, verified through OCI API |
| netcup Customer Control Panel | https://ccp.netcup.net/ | Ilja / contract holder; exact legal owner **Confirm** | `admin-netcup@krasnjanski-mail.com` → `admin@krasnjanski.com` | Customer number, CCP login name, and contract IDs **Confirm** | Contract/payment owner **Confirm** | Login/account email at left; recovery contact **Confirm** | https://www.netcup.com/en/helpcenter/support; customer support `+49 721 754 0 755 0`; outage emergency `+49 721 754 0 755 5` | Alias **Alias export**; identifiers unverified |
| ZeroTier network | https://my.zerotier.com/ | ZeroTier network Owner user **Confirm** | **Not present in alias export**; identity provider/login **Confirm** | ZeroTier network ID, DNS name, display name, plan, and owner user **Confirm** | Billing admin **Confirm** | Identity provider/domain and recovery path **Confirm**; YubiKey dependency per diagram | https://www.zerotier.com/contact/; domain-proof recovery guidance: https://www.zerotier.com/support/ | **Diagram**; local client currently `NeedsLogin`, so private fields unverified |
| klarmobil | Use “Mein Onlineservice” from https://www.klarmobil.de/service/kontakt/ | Ilja / contract holder; exact legal owner **Confirm** | `admin-klarmobil@krasnjanski-mail.com` → `admin@krasnjanski.com` | Customer number, contract number, and mobile number **Confirm** | Contract/payment owner **Confirm** | Login/account email at left; recovery phone/email **Confirm** | https://www.klarmobil.de/service/kontakt/ | Alias **Alias export**; contract fields unverified |
| ALDI TALK | “Mein ALDI TALK” from https://www.alditalk.de/tarifverwaltung | Ilja / registered SIM holder; exact legal owner **Confirm** | `admin-alditalk@krasnjanski-mail.com` → `admin@krasnjanski.com` | Mobile number and customer number **Confirm**; store only a reference to SIM/PUK paperwork | Top-up/payment owner **Confirm** | Login/account email at left; recovery contact **Confirm** | https://www.alditalk.de/contact; service `0177 177 1157` | Alias **Alias export**; registration fields unverified; never record hotline PIN/PUK here |
| Google service account (diagram lists Google separately) | https://accounts.google.com/ | Ilja; determine whether this is the same identity as the Google primary row | `admin-google@krasnjanski-mail.com` → `admin@krasnjanski.com` | Google account email/customer ID **Confirm** | Payments profile owner **Confirm** | Login alias at left; configured recovery phone/email **Confirm** | https://accounts.google.com/signin/recovery | **Diagram**, **Alias export**; possible duplicate scope needs reconciliation |
| Apple Account | https://account.apple.com/ | Ilja, personal account; exact legal owner **Confirm** | `admin-apple@krasnjanski-mail.com` → `admin@krasnjanski.com` | Apple Account email; trusted-device/phone references **Confirm** | Apple payment profile owner **Confirm** | Login alias at left; Apple Recovery Contact name/reference **Confirm** | https://support.apple.com/apple-account | **Diagram**, **Alias export**; private settings unverified |
| Microsoft account | https://account.microsoft.com/ | Ilja, personal account; exact legal owner **Confirm** | `admin-microsoft@krasnjanski-mail.com` → `admin@krasnjanski.com` | Microsoft account email; tenant/subscription ID if applicable **Confirm** | Microsoft billing profile owner **Confirm** | Login alias at left; security-info recovery email/phone **Confirm** | https://support.microsoft.com/account-billing | **Diagram**, **Alias export**; private settings unverified |

## Follow-up console checks

Task 02 is complete. The following private fields remain useful maintenance checks when each provider is next reviewed:

1. Write the exact legal/account owner string once, then apply it to each personal account where it matches.
2. Cloudflare: account ID, both zone IDs, Super Administrator list, billing contact, account email, and recovery readiness. Confirm that both domains remain in the same intended account.
3. GitHub: all owners of organization `Ikey168`, billing managers, billing email, and each owner account's recovery email. GitHub recommends at least two organization owners.
4. Oracle: Customer Support Identifier (CSI), subscription/billing-account owner, billing contact, tenancy administrators, and recovery contact.
5. netcup: customer number, CCP login identity, contract owner, billing owner, and support-authorized email.
6. ZeroTier: ZeroTier network ID, ZeroTier network DNS name, identity provider/login, Owner user, Billing Admin, plan, and domain-proof recovery path.
7. Bitwarden: US/EU region, account fingerprint, emergency-access contact, organization owner(s), and billing owner. Record only references to the emergency kit.
8. Proton, Google, Apple, and Microsoft: configured recovery contacts, trusted devices/phones, billing profiles, and whether recovery creates a cycle.
9. klarmobil and ALDI TALK: customer/contract/mobile identifiers, registered holder, billing owner, and support-authorized contact. Keep PIN/PUK/hotline PIN out of this register.
10. Decide whether “Google” in the downstream box is the same account as `ilja@krasnjanski.com`; merge the duplicate row if so.

## Observed recovery risks

- The primary mailbox, alias domain, DNS/registrar, password vault, and downstream accounts form a tightly coupled recovery graph. A Cloudflare or primary-mailbox loss can affect several recovery paths at once.
- ZeroTier has no matching alias in the export and its client is logged out, leaving its owner and identity provider undocumented.
- GitHub organization owner membership is not public. Public data confirms the organization and repository, not the human owner account.
- The diagram shows YubiKey coverage, but it does not prove that a spare key is enrolled everywhere or that custody is independent of the primary device/location.
- Bitwarden is zero-knowledge; provider support cannot recover a forgotten master password. Emergency access and an offline recovery-kit reference should therefore be recorded explicitly.
- Cloudflare's apparent login/recovery alias is hosted by SimpleLogin on `krasnjanski-mail.com`, while that custom domain's registrar and DNS are controlled by Cloudflare. This is a direct circular recovery dependency: a Cloudflare/DNS incident could interrupt the email path needed to recover Cloudflare itself.
- Avoid broader circular recovery: Cloudflare, `ilja@krasnjanski.com`, and SimpleLogin must not rely exclusively on one another without the independent Proton/YubiKey path.

## Public verification notes

- Public DNS on 2026-09-19: both domains use Cloudflare nameservers; `krasnjanski.com` routes mail to Google and `krasnjanski-mail.com` routes mail to SimpleLogin.
- Verisign RDAP on 2026-09-19: Cloudflare, Inc. is registrar for both `.com` domains.
- GitHub public API on 2026-09-19: `Ikey168` is an Organization with numeric ID `122488906`; `Ikey168/Modulo` is the configured origin remote. `KrasForge` does not resolve as a public organization.
- ZeroTier documents that the ZeroTier network ID is visible under General in the admin console and that support can require DNS TXT proof when no administrator is reachable.
- Cloudflare documents that the account email is used for billing, usage notices, and account recovery; verify whether the present account follows that default or has separate billing/notification addresses.
