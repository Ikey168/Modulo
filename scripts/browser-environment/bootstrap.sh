#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/../.." && pwd)
source_dir="$repo_root/config/browser-environment"
profile_root="$HOME/.mozilla/firefox"
state_root="$HOME/.local/share/browser-environment"
application_root="$HOME/.local/share/applications"
bin_root="$HOME/.local/bin"
tmpfiles_root="$HOME/.config/user-tmpfiles.d"
stamp=$(date -u +%Y%m%dT%H%M%SZ)

for command_name in firefox curl unzip jq timeout install sed cmp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

mkdir -p "$profile_root" "$state_root" "$application_root" "$bin_root" "$tmpfiles_root"

ensure_profile() {
  local name=$1
  local path=$2
  if [[ ! -d "$path" ]]; then
    firefox --headless -CreateProfile "$name $path"
  fi
}

install_with_backup() {
  local source=$1
  local destination=$2
  local mode=${3:-0644}
  if [[ -f "$destination" ]] && ! cmp -s "$source" "$destination"; then
    cp -p -- "$destination" "$destination.before-browse-env-$stamp"
  fi
  install -Dm"$mode" -- "$source" "$destination"
}

ensure_profile Main "$profile_root/main"
ensure_profile Development "$profile_root/development"
ensure_profile Disposable "$profile_root/disposable"

install_with_backup "$source_dir/profiles/main.js" "$profile_root/main/user.js"
install_with_backup "$source_dir/profiles/development.js" "$profile_root/development/user.js"
install_with_backup "$source_dir/profiles/disposable.js" "$profile_root/disposable/user.js"
install_with_backup "$source_dir/containers.json" "$profile_root/main/containers.json"

extension_cache=$(mktemp -d /tmp/browser-environment-extensions.XXXXXX)
cleanup() {
  if [[ -d "$extension_cache" && "$extension_cache" == /tmp/browser-environment-extensions.* ]]; then
    find "$extension_cache" -depth -delete
  fi
}
trap cleanup EXIT

download_extension() {
  local slug=$1
  local output=$2
  curl -fsSL "https://addons.mozilla.org/firefox/downloads/latest/$slug/latest.xpi" -o "$output"
}

extension_id() {
  unzip -p "$1" manifest.json |
    jq -er '.browser_specific_settings.gecko.id // .applications.gecko.id'
}

install_extension() {
  local xpi=$1
  shift
  local id
  id=$(extension_id "$xpi")
  local profile
  for profile in "$@"; do
    install -Dm0644 -- "$xpi" "$profile_root/$profile/extensions/$id.xpi"
  done
  printf 'Installed %s in: %s\n' "$id" "$*"
}

download_extension ublock-origin "$extension_cache/ublock-origin.xpi"
download_extension multi-account-containers "$extension_cache/multi-account-containers.xpi"
download_extension bitwarden-password-manager "$extension_cache/bitwarden.xpi"

install_extension "$extension_cache/ublock-origin.xpi" main development disposable
install_extension "$extension_cache/multi-account-containers.xpi" main
install_extension "$extension_cache/bitwarden.xpi" main development

install -Dm0644 -- "$source_dir/policies.json" "$state_root/policies.json"
install -Dm0755 -- "$source_dir/firefox-profile" "$bin_root/firefox-profile"
install -Dm0644 -- "$source_dir/browser-environment.conf" "$tmpfiles_root/browser-environment.conf"

for launcher in firefox-main firefox-development firefox-disposable; do
  sed "s|@HOME@|$HOME|g" "$source_dir/$launcher.desktop.in" >"$application_root/$launcher.desktop"
  chmod 0644 "$application_root/$launcher.desktop"
done

if command -v systemd-tmpfiles >/dev/null 2>&1; then
  XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)} \
    systemd-tmpfiles --user --create browser-environment.conf
else
  runtime_root=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
  mkdir -p "$runtime_root/firefox"
  ln -sfn "$state_root/policies.json" "$runtime_root/firefox/policies.json"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$application_root"
fi

xdg-settings set default-web-browser firefox-main.desktop
xdg-mime default firefox-main.desktop x-scheme-handler/http
xdg-mime default firefox-main.desktop x-scheme-handler/https
xdg-mime default firefox-main.desktop text/html

initialize_profile() {
  local profile=$1
  local path=$2
  set +e
  timeout 15s firefox --headless --no-remote --profile "$path" about:blank >/dev/null 2>&1
  local status=$?
  set -e
  if [[ $status -ne 0 && $status -ne 124 ]]; then
    printf 'Firefox profile initialization failed for %s (status %s)\n' "$profile" "$status" >&2
    exit "$status"
  fi
}

initialize_profile Main "$profile_root/main"
initialize_profile Development "$profile_root/development"
initialize_profile Disposable "$profile_root/disposable"

printf 'Browser environment installed. Default: Firefox — Main; fallback: existing Chromium/Vivaldi.\n'
