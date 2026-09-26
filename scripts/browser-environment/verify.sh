#!/usr/bin/env bash
set -euo pipefail

profile_root="$HOME/.mozilla/firefox"
policy_file="$HOME/.local/share/browser-environment/policies.json"
runtime_root=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

expect_pref() {
  local profile=$1
  local preference=$2
  local expected=$3
  rg -q "^user_pref\\(\"$preference\", $expected\\);$" \
    "$profile_root/$profile/user.js" ||
    fail "$profile does not set $preference to $expected"
}

expect_extension() {
  local profile=$1
  local extension_id=$2
  jq -e --arg id "$extension_id" \
    '.addons[] | select(.id == $id and .active == true and .userDisabled == false and .appDisabled == false)' \
    "$profile_root/$profile/extensions.json" >/dev/null ||
    fail "$extension_id is not active in $profile"
}

[[ $(xdg-settings get default-web-browser) == firefox-main.desktop ]] ||
  fail 'Firefox Main is not the default browser'
[[ $(xdg-mime query default x-scheme-handler/http) == firefox-main.desktop ]] ||
  fail 'Firefox Main does not own HTTP links'
[[ $(xdg-mime query default x-scheme-handler/https) == firefox-main.desktop ]] ||
  fail 'Firefox Main does not own HTTPS links'
[[ $(xdg-mime query default text/html) == firefox-main.desktop ]] ||
  fail 'Firefox Main does not own HTML documents'

for profile in main development disposable; do
  [[ -d "$profile_root/$profile" ]] || fail "missing $profile profile"
  expect_pref "$profile" 'permissions.default.desktop-notification' 2
  expect_pref "$profile" 'identity.fxaccounts.enabled' false
  expect_pref "$profile" 'browser.download.useDownloadDir' false
  expect_extension "$profile" 'uBlock0@raymondhill.net'
done

expect_pref main 'dom.security.https_only_mode' true
expect_pref development 'dom.security.https_only_mode' false
expect_pref disposable 'dom.security.https_only_mode' true
expect_pref disposable 'privacy.sanitize.sanitizeOnShutdown' true
expect_extension main '@testpilot-containers'
expect_extension main '{446900e4-71c2-419f-a6a7-df9c091e268b}'
expect_extension development '{446900e4-71c2-419f-a6a7-df9c091e268b}'

jq -e '
  [.identities[] | select(.public == true) | .name] as $names |
  ["Personal", "Work", "Finance", "Shopping", "Google", "Social"] |
  all(. as $required | $names | index($required) != null)
' "$profile_root/main/containers.json" >/dev/null || fail 'Main container set differs from baseline'

jq -e '
  .policies.DisableFirefoxAccounts == true and
  .policies.DisableTelemetry == true and
  .policies.PromptForDownloadLocation == true and
  .policies.SearchSuggestEnabled == false and
  (.policies.SearchEngines.Add | map(.Alias) | sort == ["g", "gh", "mdn", "rfc", "sch", "w"])
' "$policy_file" >/dev/null || fail 'active policy source differs from baseline'

[[ -L "$runtime_root/firefox/policies.json" ]] || fail 'per-user Firefox policy link is missing'
[[ $(readlink -f "$runtime_root/firefox/policies.json") == "$policy_file" ]] ||
  fail 'per-user Firefox policy link has the wrong target'

command -v vivaldi-stable >/dev/null 2>&1 || command -v chromium >/dev/null 2>&1 ||
  fail 'no Chromium-family fallback is available'

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate \
    "$HOME/.local/share/applications/firefox-main.desktop" \
    "$HOME/.local/share/applications/firefox-development.desktop" \
    "$HOME/.local/share/applications/firefox-disposable.desktop"
fi

printf '%s\n' 'PASS: PC browser baseline, profile boundaries, extensions, policies, search aliases, and fallback are consistent.'
