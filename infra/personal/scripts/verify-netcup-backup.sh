#!/bin/sh
set -eu

archive=${1:-}
[ -n "$archive" ] && [ -r "$archive" ] || { printf 'Usage: %s ARCHIVE.tar.gz\n' "$0" >&2; exit 2; }

if [ -r "$archive.sha256" ]; then
  (cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive.sha256")") >/dev/null
fi

entries=$(tar -tzf "$archive")
for required in home/ik/ChatGPT/Modulo/ home/ik/ChatGPT/Noesis/; do
  printf '%s\n' "$entries" | grep -Fq "$required" || { printf 'missing required backup root: %s\n' "$required" >&2; exit 1; }
done

for pattern in \
  '^home/ik/\.ssh/' \
  '^home/ik/\.config/modulo-mcp/' \
  '^home/ik/\.codex/' \
  '^home/ik/\.claude/' \
  '(^|/)\.env($|\.)' \
  '(^|/)node_modules/' \
  '(^|/)target/'; do
  if printf '%s\n' "$entries" | grep -Eiq "$pattern"; then
    printf 'forbidden path present in archive: %s\n' "$pattern" >&2
    exit 1
  fi
done

printf 'Backup archive passed boundary checks: %s\n' "$archive"
