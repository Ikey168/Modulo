#!/usr/bin/env bash
set -Eeuo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/modulo-restore-test.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT

mkdir -p "$tmp/snapshot/noesis" "$tmp/snapshot/neo4j"
printf 'CREATE ROLE modulo;\n' > "$tmp/postgres.sql"
printf 'duckdb fixture\n' > "$tmp/snapshot/noesis/noesis.duckdb"
printf 'neo4j fixture\n' > "$tmp/snapshot/neo4j/server_id"
gzip -9 -c "$tmp/postgres.sql" > "$tmp/snapshot/postgres.sql.gz"
tar -C "$tmp/snapshot/noesis" -czf "$tmp/snapshot/noesis-data.tar.gz" .
tar -C "$tmp/snapshot/neo4j" -czf "$tmp/snapshot/neo4j-data.tar.gz" .
(
  cd "$tmp/snapshot"
  sha256sum postgres.sql.gz neo4j-data.tar.gz noesis-data.tar.gz > SHA256SUMS
  touch VERIFIED COMPLETE
)
RESTORE_DRILL_REPORT="$tmp/report.json" "$root/restore-drill.sh" "$tmp/snapshot" --skip-postgres
python3 - "$tmp/report.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    report = json.load(handle)
assert report["format"] == "modulo.restore-drill.v1"
assert report["status"] == "passed"
assert report["checks"]["archives"] == "passed"
PY
printf 'Restore-drill integration test passed\n'
