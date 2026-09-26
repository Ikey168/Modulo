#!/bin/sh
set -eu
# Values are embedded in JavaScript; accept only URL/client-id characters.
issuer=${MODULO_OIDC_ISSUER:-http://localhost:8180/realms/modulo}
client=${MODULO_OIDC_CLIENT_ID:-modulo-frontend}
case "$issuer" in
  *[!A-Za-z0-9.:/_~-]*|'') echo 'Invalid MODULO_OIDC_ISSUER' >&2; exit 1 ;;
esac
case "$issuer" in http://?*|https://?*) ;; *) echo 'Invalid MODULO_OIDC_ISSUER' >&2; exit 1 ;; esac
case "$client" in
  *[!A-Za-z0-9._-]*|'') echo 'Invalid MODULO_OIDC_CLIENT_ID' >&2; exit 1 ;;
esac
printf 'window.__MODULO_CONFIG__ = {"oidcIssuer":"%s","oidcClientId":"%s"};\n' "$issuer" "$client" > /usr/share/nginx/html/runtime-config.js
