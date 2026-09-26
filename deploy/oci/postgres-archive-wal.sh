#!/bin/sh
set -eu

source_path=$1
segment=$2
destination=/var/lib/postgresql/wal-archive

case "$segment" in
  ''|*/*|*..*) exit 1 ;;
esac

case "$source_path" in
  /*) ;;
  *) source_path="${PGDATA:-/var/lib/postgresql/data}/$source_path" ;;
esac

final_path="$destination/$segment"
temporary_path="$destination/.$segment.tmp"
if [ -f "$final_path" ]; then
  exit 0
fi

trap 'rm -f -- "$temporary_path"' EXIT HUP INT TERM
cp -- "$source_path" "$temporary_path"
chmod 0640 "$temporary_path"
mv -- "$temporary_path" "$final_path"
