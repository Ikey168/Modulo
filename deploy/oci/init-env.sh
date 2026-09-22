#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <http(s)://public-host>" >&2
  exit 2
fi

public_url=${1%/}
case "$public_url" in
  http://*|https://*) ;;
  *) echo "public URL must start with http:// or https://" >&2; exit 2 ;;
esac

if [ -e .env ]; then
  echo ".env already exists; refusing to overwrite secrets" >&2
  exit 1
fi

case "$public_url" in
  https://*) modulo_site=${public_url#https://} ;;
  http://*) modulo_site=$public_url ;;
esac

umask 077
{
  printf 'MODULO_SITE=%s\n' "$modulo_site"
  printf 'MODULO_URL=%s\n' "$public_url"
  printf 'NOESIS_CONTEXT=/srv/noesis\n'
  printf 'POSTGRES_DB=modulodb\n'
  printf 'POSTGRES_USER=modulo\n'
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'KEYCLOAK_DB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'NEO4J_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'KEYCLOAK_ADMIN=admin\n'
  printf 'KEYCLOAK_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'MODULO_SECURITY_JWT_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '\n')"
  printf 'MODULO_SECURITY_API_KEY=mod_%s\n' "$(openssl rand -hex 24)"
  printf 'MODULO_SECURITY_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 16)"
  printf 'NOESIS_JWT_SECRET=%s\n' "$(openssl rand -hex 48)"
  printf 'NOESIS_API_KEY_SALT=%s\n' "$(openssl rand -hex 32)"
} > .env

echo "created .env with mode 0600"
