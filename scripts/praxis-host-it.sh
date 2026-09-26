#!/usr/bin/env bash
# Integration test of Modulo's Praxis client (#525) against a real Praxis host.
#
# Builds an internal CA, the Praxis server certificate, Modulo's client certificate and a
# certificate from an unrelated CA; generates Modulo's bearer token with
# `python -m praxis.host token --client modulo`; starts `praxis.host serve` with the fake
# executor, mutual TLS and a delegating Modulo client; then runs PraxisHostIntegrationTest.
#
# Usage: scripts/praxis-host-it.sh [path-to-praxis-checkout]
# Without a path, krasforge/praxis is cloned at PRAXIS_REF. Needs uv, openssl and Maven.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRAXIS_REF="${PRAXIS_REF:-9a3eb1f963cc7b67eac1da81defabb7ac0853c0e}"
PORT="${PRAXIS_IT_PORT:-18443}"
WORK="$(mktemp -d)"
HOST_PID=""
cleanup() {
  if [ -n "$HOST_PID" ]; then kill "$HOST_PID" 2>/dev/null || true; wait "$HOST_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

PRAXIS="${1:-}"
if [ -z "$PRAXIS" ]; then
  PRAXIS="$WORK/praxis"
  git init -q "$PRAXIS"
  git -C "$PRAXIS" fetch -q --depth 1 https://github.com/krasforge/praxis "$PRAXIS_REF"
  git -C "$PRAXIS" checkout -q FETCH_HEAD
fi

cd "$WORK"
mkdir -p data
cert() { # name, CN, CA key, CA cert, extensions
  openssl req -newkey rsa:2048 -nodes -keyout "$1.key" -out "$1.csr" -subj "/CN=$2" 2>/dev/null
  openssl x509 -req -in "$1.csr" -CA "$4" -CAkey "$3" -CAcreateserial -out "$1.pem" -days 2 ${5:+-extfile "$5"} 2>/dev/null
}
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 2 -subj "/CN=praxis-it internal CA" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -keyout rogue-ca.key -out rogue-ca.pem -days 2 -subj "/CN=unrelated CA" 2>/dev/null
printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\n' > server.ext
cert server localhost ca.key ca.pem server.ext
cert modulo modulo ca.key ca.pem
cert rogue modulo rogue-ca.key rogue-ca.pem

# The token goes to stderr once; the [[clients]] block with its digest to stdout.
(cd "$PRAXIS" && uv run -q --with uvicorn python -m praxis.host token --client modulo) 2> token.out > client.toml
grep -o 'praxis_[A-Za-z0-9_-]*' token.out > token
chmod 600 token ./*.key
DIGEST="$(sed -n 's/^token_sha256 = "\(.*\)"$/\1/p' client.toml)"

cat > host.toml <<EOF
data_dir = "$WORK/data"
executors = ["fake"]

[server]
host = "127.0.0.1"
port = $PORT
tls_certfile = "$WORK/server.pem"
tls_keyfile = "$WORK/server.key"
tls_client_ca = "$WORK/ca.pem"

[[clients]]
id = "modulo"
token_sha256 = "$DIGEST"
roles = ["submit", "read", "control", "approve", "publish"]
delegate = true
EOF

(cd "$PRAXIS" && uv run -q --with uvicorn python -m praxis.host check --config "$WORK/host.toml")
(cd "$PRAXIS" && exec uv run -q --with uvicorn python -m praxis.host serve --config "$WORK/host.toml") > host.log 2>&1 &
HOST_PID=$!
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --cacert ca.pem --cert modulo.pem --key modulo.key "https://127.0.0.1:$PORT/v1/health" || true)"
  [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "200" ] && break
  sleep 1
done
if ! kill -0 "$HOST_PID" 2>/dev/null; then cat host.log; exit 1; fi

export PRAXIS_IT_URL="https://127.0.0.1:$PORT"
export PRAXIS_IT_CA="$WORK/ca.pem" PRAXIS_IT_CERT="$WORK/modulo.pem" PRAXIS_IT_KEY="$WORK/modulo.key"
export PRAXIS_IT_TOKEN_FILE="$WORK/token"
export PRAXIS_IT_ROGUE_CERT="$WORK/rogue.pem" PRAXIS_IT_ROGUE_KEY="$WORK/rogue.key"
cd "$ROOT"
mvn -q -pl backend test -Dtest=PraxisHostIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false -Djacoco.skip=true \
  || { echo "--- praxis host log"; tail -50 "$WORK/host.log"; exit 1; }
