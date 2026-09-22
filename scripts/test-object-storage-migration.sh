#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/modulo-object-storage-test.XXXXXX")
server_pid=

finish() {
  rc=$?
  if [[ -n $server_pid ]]; then
    kill "$server_pid" >/dev/null 2>&1 || true
    wait "$server_pid" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$work_dir"
  exit "$rc"
}
trap finish EXIT

command -v rclone >/dev/null 2>&1 || {
  echo "rclone is required." >&2
  exit 1
}
serve_s3_help=$(rclone serve s3 --help 2>&1 || true)
if ! grep -q '^`serve s3`' <<<"$serve_s3_help"; then
  echo "SKIP: this rclone build does not provide the experimental serve s3 command."
  exit 0
fi
command -v python3 >/dev/null 2>&1 || {
  echo "python3 is required to allocate an isolated loopback port." >&2
  exit 1
}

port=$(python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
)

mkdir -p "$work_dir/store/source-bucket" "$work_dir/store/destination-bucket"
mkdir -p "$work_dir/store/source-bucket/datasets/2026/09"
printf '%s\n' 'alpha object' > "$work_dir/store/source-bucket/datasets/2026/09/alpha.txt"
printf '%s\n' 'beta object' > "$work_dir/store/source-bucket/datasets/2026/09/beta.txt"

cat > "$work_dir/rclone.conf" <<EOF
[s3test]
type = s3
provider = Rclone
endpoint = http://127.0.0.1:$port
access_key_id = test-access
secret_access_key = test-secret
force_path_style = true
EOF
chmod 0600 "$work_dir/rclone.conf"

rclone serve s3 \
  --addr "127.0.0.1:$port" \
  --auth-key test-access,test-secret \
  --log-file "$work_dir/server.log" \
  "$work_dir/store" &
server_pid=$!

ready=false
for _ in {1..50}; do
  if rclone lsd --contimeout 250ms --timeout 250ms \
    --config "$work_dir/rclone.conf" s3test: >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.1
done
$ready || {
  cat "$work_dir/server.log" >&2
  echo "Local S3 acceptance endpoint did not become ready." >&2
  exit 1
}

"$script_dir/object-storage-migrate.sh" \
  --config "$work_dir/rclone.conf" \
  s3test:source-bucket \
  s3test:destination-bucket

[[ $(rclone lsf --config "$work_dir/rclone.conf" --recursive --files-only s3test:destination-bucket | wc -l) -eq 0 ]] || {
  echo "Dry run unexpectedly copied data." >&2
  exit 1
}

"$script_dir/object-storage-migrate.sh" \
  --apply \
  --config "$work_dir/rclone.conf" \
  s3test:source-bucket \
  s3test:destination-bucket

rclone check --config "$work_dir/rclone.conf" --download \
  s3test:source-bucket s3test:destination-bucket

# Prove repeated migrations are non-destructive: an unrelated destination-only
# object must survive because the contract uses copy, never sync.
printf '%s\n' 'retain me' > "$work_dir/destination-only.txt"
rclone copyto --config "$work_dir/rclone.conf" \
  "$work_dir/destination-only.txt" \
  s3test:destination-bucket/destination-only.txt

"$script_dir/object-storage-migrate.sh" \
  --apply \
  --config "$work_dir/rclone.conf" \
  s3test:source-bucket \
  s3test:destination-bucket

rclone cat --config "$work_dir/rclone.conf" \
  s3test:destination-bucket/destination-only.txt | grep -qx 'retain me'

printf '%s\n' 'Object-storage migration acceptance test passed.'
