#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
: "${MODULO_URL:?Export MODULO_URL}"
docker compose -f compose.yml ps
curl -fsS --max-time 10 "$MODULO_URL/health"
curl -fsS --max-time 10 "$MODULO_URL/api/health"
curl -fsS --max-time 10 http://127.0.0.1:8012/health
