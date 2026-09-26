#!/usr/bin/env bash
set -euo pipefail

umask 077
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/network-backup-monitor"
mkdir -p "$state_dir"
state_path="$state_dir/last.json"
vault_dir="/home/ik/.local/share/Cryptomator/mnt/Vault_ImportantDocs/20_Security & Account Recovery/20.05 Backups & Exports (Bitwarden exports, etc. — encrypted if possible)"

python3 - "$vault_dir" "$state_path" <<'PY'
import hashlib
import json
import os
import pathlib
import sys
import tempfile
import time

vault = pathlib.Path(sys.argv[1])
state_path = pathlib.Path(sys.argv[2])
now = time.time()
max_age = 30 * 60 * 60
checks = []

def newest(pattern):
    files = [p for p in vault.glob(pattern) if p.is_file()]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None

def verify(label, archive, sidecar):
    if archive is None:
        return {"label": label, "status": "missing"}
    stat = archive.stat()
    mode = stat.st_mode & 0o777
    age = max(0, int(now - stat.st_mtime))
    result = {
        "label": label,
        "status": "ok",
        "file": archive.name,
        "mode": format(mode, "03o"),
        "age_seconds": age,
    }
    if mode != 0o600:
        result["status"] = "degraded"
        result["reason"] = "custody_mode_not_600"
    if age > max_age:
        result["status"] = "degraded"
        result["reason"] = "archive_older_than_30h"
    if sidecar is None or not sidecar.is_file():
        result["status"] = "degraded"
        result["reason"] = "checksum_sidecar_missing"
    else:
        expected = sidecar.read_text(encoding="utf-8").split()[0]
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        result["checksum"] = "match" if digest == expected else "mismatch"
        if digest != expected:
            result["status"] = "degraded"
            result["reason"] = "checksum_mismatch"
    return result

if not vault.is_dir():
    checks = [{"label": "vault", "status": "unmounted"}]
else:
    mik_rsc = newest("mikrotik-hEX-S-modulo-auto-*.rsc")
    mik_backup = newest("mikrotik-hEX-S-modulo-auto-*.backup")
    ap_backup = newest("openwrt-archer-c6-backup-*.tgz")
    ap_packages = newest("openwrt-archer-c6-packages-*.txt")
    checks = [
        verify("mikrotik_rsc", mik_rsc, newest(f"{mik_rsc.name}.sha256") if mik_rsc else None),
        verify("mikrotik_backup", mik_backup, newest(f"{mik_backup.name}.sha256") if mik_backup else None),
        verify("openwrt_backup", ap_backup, newest(f"{ap_backup.name}.sha256") if ap_backup else None),
    ]
    if ap_packages is None:
        checks.append({"label": "openwrt_packages", "status": "missing"})
    else:
        age = max(0, int(now - ap_packages.stat().st_mtime))
        checks.append({
            "label": "openwrt_packages",
            "status": "ok" if (ap_packages.stat().st_mode & 0o777) == 0o600 and age <= max_age else "degraded",
            "file": ap_packages.name,
            "mode": format(ap_packages.stat().st_mode & 0o777, "03o"),
            "age_seconds": age,
        })

overall = "ok" if checks and all(item["status"] == "ok" for item in checks) else "degraded"
payload = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "overall": overall, "checks": checks}
state_path.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=state_path.parent, prefix=".last.", delete=False) as handle:
    os.chmod(handle.fileno(), 0o600)
    json.dump(payload, handle, separators=(",", ":"))
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
    temporary = pathlib.Path(handle.name)
os.replace(temporary, state_path)
if overall != "ok":
    print(json.dumps(payload, separators=(",", ":")))
    raise SystemExit(1)
print(json.dumps(payload, separators=(",", ":")))
PY
