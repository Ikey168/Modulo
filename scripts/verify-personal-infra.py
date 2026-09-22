#!/usr/bin/env python3
"""Validate the non-secret personal infrastructure source tree."""

from __future__ import annotations

import sys
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
INFRA = ROOT / "infra" / "personal"
REQUIRED = (
    INFRA / "README.md",
    INFRA / "inventory" / "hosts.yml",
    INFRA / "playbooks" / "site.yml",
    INFRA / "backup-boundary.yml",
    INFRA / "roles" / "remote_development" / "defaults" / "main.yml",
    INFRA / "roles" / "remote_development" / "tasks" / "main.yml",
    INFRA / "roles" / "remote_development" / "handlers" / "main.yml",
    INFRA / "roles" / "remote_development" / "templates" / "dev-netcup-health",
    INFRA / "roles" / "remote_development" / "templates" / "dev-netcup-health.service",
    INFRA / "roles" / "remote_development" / "templates" / "dev-netcup-health.timer",
    INFRA / "roles" / "remote_development" / "templates" / "netcup-ssh-zerotier.nft",
    INFRA / "roles" / "remote_development" / "templates" / "netcup-ssh-zerotier-firewall",
    INFRA / "roles" / "remote_development" / "templates" / "netcup-ssh-zerotier-firewall.service",
    INFRA / "roles" / "remote_development" / "files" / "dev-netcup-docker-prune.service",
    INFRA / "roles" / "remote_development" / "files" / "dev-netcup-docker-prune.timer",
    INFRA / "backup" / "README.md",
    INFRA / "backup" / "restic.env.example",
    INFRA / "backup" / "restic-backup.sh",
    INFRA / "backup" / "restic-verify.sh",
    INFRA / "backup" / "restic-prune.sh",
    ROOT / "docs" / "infrastructure" / "devices" / "netcup-recovery.md",
    INFRA / "roles" / "remote_development" / "templates" / "netcup-restic-backup.service",
    INFRA / "roles" / "remote_development" / "templates" / "netcup-restic-backup.timer",
)
FORBIDDEN_KEYS = r"password|passwd|token|secret|private[_-]?key|recovery[_-]?code"


def main() -> int:
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED if not path.is_file()]
    if missing:
        raise AssertionError(f"missing infrastructure files: {', '.join(missing)}")

    inventory_text = (INFRA / "inventory" / "hosts.yml").read_text()
    for expected in (
        "dev-netcup:",
        "ansible_host: 10.165.78.189",
        "ansible_user: ik",
        "personal_manage_runtime_units: true",
        "personal_public_address: 185.162.249.37",
        "personal_zerotier_network_id: 88c5b1f339774e42",
        "personal_zerotier_address: 10.165.78.189",
        "personal_zerotier_interface: ztpp6mnpl3",
        "personal_enable_ssh_hardening: true",
        "personal_enable_firewall: true",
    ):
        assert expected in inventory_text, f"inventory is missing {expected}"

    for path in (INFRA / "backup-boundary.yml", INFRA / "roles" / "remote_development" / "defaults" / "main.yml"):
        assert not re.search(rf"(?im)^\s*(?:{FORBIDDEN_KEYS})\s*:", path.read_text()), f"secret-bearing key in {path.relative_to(ROOT)}"

    task_text = (INFRA / "roles" / "remote_development" / "tasks" / "main.yml").read_text()
    assert "personal_enable_ssh_hardening" in task_text
    assert "personal_enable_firewall" in task_text
    assert "personal_manage_zerotier" in task_text
    assert "personal_manage_offsite_backup_units" in task_text
    assert "NETCUP_BACKUP_ALLOW_PRUNE" in (INFRA / "backup" / "restic-prune.sh").read_text()
    print("PASS personal infrastructure source tree")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, KeyError, TypeError) as exc:
        print(f"FAIL personal infrastructure: {exc}", file=sys.stderr)
        raise SystemExit(1)
