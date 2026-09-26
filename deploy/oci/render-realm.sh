#!/bin/sh
set -eu

if [ ! -f .env ]; then
  echo "missing .env; run ./init-env.sh first" >&2
  exit 1
fi

set -a
. ./.env
set +a

mkdir -p generated
tmp_file=generated/realm-modulo.json.tmp

ssl_required=none
case "$MODULO_URL" in
  https://*) ssl_required=external ;;
esac

jq \
  --arg public_url "$MODULO_URL" \
  --arg ssl_required "$ssl_required" \
  '
    .sslRequired = $ssl_required
    | .users = []
    | .clients |= map(
        if .clientId == "modulo-frontend" then
          .redirectUris = [$public_url + "/*", "com.modulo:/oauth2redirect", "com.modulo:/logout"]
          | .webOrigins = [$public_url, "https://localhost"]
          | .rootUrl = $public_url
          | .baseUrl = $public_url
          | .attributes["post.logout.redirect.uris"] = ($public_url + "/*\ncom.modulo:/logout")
        else . end
      )
  ' ../../keycloak/realm-modulo.json > "$tmp_file"

mv "$tmp_file" generated/realm-modulo.json
# The non-root Keycloak container must read this bind-mounted file. It contains
# no users or credentials; secrets remain in the mode-0600 .env.
chmod 0644 generated/realm-modulo.json
echo "rendered generated/realm-modulo.json for $MODULO_URL"
