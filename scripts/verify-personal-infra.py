#!/usr/bin/env python3
"""Structural safety gate for the non-secret personal infrastructure baseline."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "infra/personal"


def main() -> None:
    required = (
        "README.md",
        "pyproject.toml",
        "ansible.cfg",
        "inventory.example.yml",
        "group_vars/all.yml",
        "playbooks/audit.yml",
        "playbooks/site.yml",
        "roles/linux_baseline/tasks/main.yml",
        "roles/linux_baseline/handlers/main.yml",
        "roles/backup_client/tasks/main.yml",
        "roles/container_host/tasks/main.yml",
        "roles/developer_workstation/tasks/main.yml",
    )
    for relative in required:
        if not (BASE / relative).is_file():
            raise SystemExit(f"missing infrastructure file: {relative}")

    inventory = (BASE / "inventory.example.yml").read_text(encoding="utf-8")
    for name in ("desktop", "laptop", "home-pi", "dev-netcup", "prod-oracle"):
        if not re.search(rf"^\s*{re.escape(name)}:\s*$", inventory, re.MULTILINE):
            raise SystemExit(f"missing inventory role: {name}")
    if "edge-pi" in inventory or "edge-lab" in inventory:
        raise SystemExit("Pi must be modeled as a homeserver, not an edge lab")

    text_suffixes = {".cfg", ".md", ".py", ".toml", ".txt", ".yaml", ".yml"}
    source_files = (
        path
        for path in BASE.rglob("*")
        if path.is_file()
        and path.suffix in text_suffixes
        and not any(part.startswith(".") for part in path.relative_to(BASE).parts)
    )
    combined = "\n".join(path.read_text(encoding="utf-8") for path in source_files)
    lowered = combined.lower()
    for unsafe in ("password: changeme", "private_key:", "api_token:", "strictHostKeyChecking=no".lower()):
        if unsafe.lower() in lowered:
            raise SystemExit(f"unsafe infrastructure pattern: {unsafe}")
    for boundary in ("manage_ssh: false", "owner-evidence-required", "protected custody"):
        if boundary not in combined:
            raise SystemExit(f"missing infrastructure boundary: {boundary}")
    print("personal infrastructure verified: roles, opt-in SSH hardening and secret boundaries present")


if __name__ == "__main__":
    main()
