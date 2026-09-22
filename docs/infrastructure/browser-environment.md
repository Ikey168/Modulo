# Standard browsing environment

This is the reproducible BROWSE-ENV baseline for Linux workstations. Firefox is
the primary browser. The existing Chromium-family browser remains available for
compatibility testing and sites that do not work correctly in Firefox.

## Profiles and boundaries

- **Main** is for ordinary browsing. HTTPS-Only Mode is enabled. Its containers
  are Personal, Work, Finance, Shopping, Google, and Social. uBlock Origin,
  Firefox Multi-Account Containers, and Bitwarden are installed.
- **Development** is for developer tools and local/LAN HTTP services. HTTPS-Only
  Mode is intentionally disabled there. uBlock Origin and Bitwarden are
  installed.
- **Disposable** is for untrusted or one-off browsing. uBlock Origin is the only
  extension, credentials are not stored, and transient browser state is cleared
  when Firefox exits.

All profiles block notification prompts, restrict autoplay, ask before using
camera, microphone, or location, ask where to save downloads, use strict
tracking protection, disable sponsored/browser content, and do not save
passwords in Firefox.

## Search shortcuts

Type a shortcut followed by a query in the Firefox address bar:

| Shortcut | Target |
| --- | --- |
| `g` | DuckDuckGo (default general search) |
| `gh` | GitHub |
| `mdn` | MDN Web Docs |
| `w` | Wikipedia |
| `sch` | Google Scholar |
| `rfc` | IETF RFC and Internet-Draft search |

## Sync and recovery boundary

Firefox Accounts and Firefox Sync are disabled. Browser history, cookies,
sessions, passwords, extensions, and settings do not cloud-sync. Passwords are
owned by Bitwarden; its recovery material must remain outside this repository
and outside Modulo notes. This repository contains only non-secret browser
configuration. Re-run the bootstrap on a rebuilt PC or laptop to restore the
profiles, approved extensions, search shortcuts, and desktop launchers.

Bookmarks are deliberately outside this baseline. Export or import them only
after deciding where their protected backup belongs; do not add a bookmark
export to source control because URLs can reveal private activity.

## Install or reconcile

From the repository root:

```bash
scripts/browser-environment/bootstrap.sh
```

The script is idempotent. When replacing a differing `user.js` or Main
`containers.json`, it creates a timestamped backup beside the original file.
It does not inspect or copy cookies, history, saved logins, sessions, or private
window data.

After deployment, sign in to Bitwarden in Main and Development if appropriate.
Do not sign in to Bitwarden in Disposable. Verify `about:policies`,
`about:profiles`, and the address-bar shortcuts before accepting a new device.

## Acceptance checklist

1. Ordinary browsing opens in Main and an HTTP URL is upgraded to HTTPS where
   supported.
2. A local HTTP development service opens in Development without a forced HTTPS
   upgrade.
3. Finance and social sessions remain isolated in their named Main containers.
4. Disposable clears cookies and history after a clean exit and restart.
5. Notification requests are blocked; camera, microphone, and location remain
   ask-only.
6. Downloads prompt for a destination and are reviewed before opening.
7. Each search shortcut reaches the intended provider.
8. The Chromium-family fallback can open one known compatibility case without
   becoming the default browser.

Review the baseline every six months and after a browser reaches end of support,
an approved extension changes ownership, or a significant privacy control is
renamed or removed.
