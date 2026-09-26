# Tier-0 MFA and recovery-factor register

Task: **03 · Establish redundant MFA and recovery factors**  
Project: Establish Identity Roots & Recovery  
Area: Security, Identity & Access  
Status: **In progress**  
Last reviewed: 2026-09-19 (Europe/Berlin)

## Confirmed current state

| Factor / channel | Quantity / identity | State | Intended role | Safe notes |
|---|---|---|---|---|
| FIDO2 security key | 1 | In use | Primary phishing-resistant factor | Model, serial suffix, firmware, purchase date, and custody reference not yet recorded |
| Additional FIDO2 security keys | 2 | To order | Redundant enrolled keys | Target total: 3 keys |
| Ente Auth on phone | 1 phone installation | In use for TOTP | Supplemental TOTP factor where FIDO2 is unavailable or as an approved fallback | Ente login alias in the alias export: `admin-ente@krasnjanski-mail.com` → `admin@krasnjanski.com`; do not store TOTP seeds here |
| Recovery phone | `+4915142094656` | Current; klarmobil line | SMS/voice recovery where unavoidable | Do not treat as the only recovery path |
| Independent recovery mailbox | `paleport@proton.me` | Current | Independent recovery for `ilja@krasnjanski.com` | Protected by the active YubiKey per the supplied current-state diagram |
| Primary/domain mailbox | `ilja@krasnjanski.com` | Current | Primary identity and SimpleLogin recovery/contact mailbox | Depends on `krasnjanski.com` DNS and Google mail routing |

## Target key layout

| Key | Purpose | Custody target | Status |
|---|---|---|---|
| Key A | Daily primary key | With owner, separate from phone where practical | In use; inventory details to record |
| Key B | Local spare | Secure location separate from Key A and the daily phone | To order, then inventory, enroll, and test |
| Key C | Off-site recovery spare | Independent trusted/off-site secure location | To order, then inventory, enroll, and test |

## Enrollment matrix

The diagram shows YubiKey protection for the roots and downstream Tier-0 accounts, but provider-by-provider enrollment is not yet evidenced. Check each account and record only enrollment status and key labels—never recovery codes or key secrets.

| Account | Key A | Key B | Key C | Ente TOTP | Phone recovery | Recovery email | Notes |
|---|---|---|---|---|---|---|---|
| Proton (`paleport@proton.me`) | Confirm enrolled | Pending order | Pending order | Confirm | Confirm | `ilja@krasnjanski.com` | Keep independent of custom-domain email where possible |
| Google primary (`ilja@krasnjanski.com`) | Confirm enrolled | Pending order | Pending order | Confirm | `+4915142094656` — confirm configured | `paleport@proton.me` | Domain/DNS dependency remains |
| Cloudflare | Confirm enrolled | Pending order | Pending order | Confirm | Confirm | `admin-cloudflare@krasnjanski-mail.com` — confirm configured | Circular dependency with SimpleLogin/custom-domain delivery requires an independent admin/recovery path |
| SimpleLogin | Confirm enrolled/support | Pending order | Pending order | Confirm | Confirm | `ilja@krasnjanski.com` | Confirm whether sign-in is native or through Proton |
| Bitwarden | Confirm enrolled | Pending order | Pending order | Confirm | Confirm | `admin-bitwarden@krasnjanski-mail.com` | Also record emergency-access contact and offline recovery-kit location reference |
| GitHub organization owner account(s) | Confirm enrolled | Pending order | Pending order | Confirm | Confirm | `dev-github@krasnjanski-mail.com` — confirm configured | Record each human owner account separately when known |
| Oracle Cloud | Confirm enrolled | Pending order | Pending order | Confirm | Confirm | `admin-oracle@krasnjanski-mail.com` — confirm configured | Check tenancy break-glass administrator separately |
| netcup | Confirm support/enrollment | Pending order | Pending order | Confirm | Confirm | `admin-netcup@krasnjanski-mail.com` — confirm configured | Record provider-supported MFA methods |
| ZeroTier owner | Confirm enrolled through IdP | Pending order | Pending order | Confirm through IdP | Confirm | Confirm identity-provider account | ZeroTier network login/owner still needs mapping |
| klarmobil | Confirm support/enrollment | Pending order | Pending order | Confirm | `+4915142094656` — confirmed klarmobil line | `admin-klarmobil@krasnjanski-mail.com` — confirm configured | Never record service PIN values here |
| ALDI TALK | Confirm support/enrollment | Pending order | Pending order | Confirm | Not this recovery number; any separate line **Confirm** | `admin-alditalk@krasnjanski-mail.com` — confirm configured | Never record hotline PIN, SIM PIN, or PUK values here |
| Google service account (`admin-google`) | Confirm enrolled | Pending order | Pending order | Confirm | `+4915142094656` — confirm configured | Confirm | Merge with primary Google row if it is the same account |
| Apple Account | Confirm enrolled | Pending order | Pending order | Confirm | `+4915142094656` — confirm configured | `admin-apple@krasnjanski-mail.com` — confirm configured | Record Apple Recovery Contact by name/reference only |
| Microsoft account | Confirm enrolled | Pending order | Pending order | Confirm | `+4915142094656` — confirm configured | `admin-microsoft@krasnjanski-mail.com` — confirm configured | Record security-info channels without codes |

## Completion checklist

- [x] Record the current primary FIDO2-key count: 1.
- [ ] Order 2 additional FIDO2 keys of a compatible standard/model.
- [ ] Record model, serial suffix, firmware, purchase date, and custody reference for all 3 keys.
- [ ] Enroll Keys B and C on every Tier-0 account that supports FIDO2/passkeys/security keys.
- [ ] Test each key independently before moving Key C off-site.
- [ ] Confirm Ente Auth sync/recovery status and the Ente account login without exposing TOTP seeds.
- [x] Map `+4915142094656` to klarmobil.
- [ ] Verify klarmobil SIM-swap and support-account protections.
- [ ] Confirm `paleport@proton.me` and `ilja@krasnjanski.com` in each provider's actual recovery settings.
- [ ] Record safe pointers to offline recovery materials; never copy their contents into the workspace.
- [ ] Run a recovery drill using a spare key and an independent mailbox without disabling the working primary factor.

## Safety rules

- Do not remove Key A until Keys B and C are enrolled and tested.
- Do not place all three keys, the daily phone, and offline recovery material in one location.
- Prefer FIDO2 over TOTP and TOTP over SMS when the provider supports the stronger option.
- Do not store TOTP seeds, QR codes, backup codes, SIM PIN/PUK values, or provider support PINs in this register.
- A recovery email is only independent when its domain, mailbox, and second factor do not depend exclusively on the account being recovered.
