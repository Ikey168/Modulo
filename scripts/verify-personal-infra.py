#!/usr/bin/env python3
"""Verify the checked-in personal host baseline without contacting hosts."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1] / "infra" / "personal"
REQUIRED = (
    "README.md",
    "ansible.cfg",
    "inventory.example.yml",
    "group_vars/all.yml",
    "playbooks/oracle.yml",
    "roles/common/tasks/main.yml",
    "roles/common/handlers/main.yml",
    "roles/container_host/tasks/main.yml",
    "roles/oracle_production/tasks/main.yml",
)

for relative in REQUIRED:
    path = ROOT / relative
    if not path.is_file():
        raise SystemExit(f"missing baseline file: {path}")

inventory = (ROOT / "inventory.example.yml").read_text(encoding="utf-8")
if "oracle_production: true" not in inventory or "example.invalid" not in inventory:
    raise SystemExit("example inventory must stay non-routable and explicitly production-scoped")

all_text = "\n".join((ROOT / relative).read_text(encoding="utf-8") for relative in REQUIRED)
for pattern in (r"BEGIN OPENSSH PRIVATE KEY", r"gh[pousr]_[A-Za-z0-9]{20,}", r"sk-[A-Za-z0-9]{20,}"):
    if re.search(pattern, all_text):
        raise SystemExit(f"secret-shaped content found in personal baseline: {pattern}")

for fragment in ("key-only", "container runtime", "protected backup", "oracle_production"):
    if fragment not in all_text:
        raise SystemExit(f"personal baseline is missing its safety contract: {fragment}")

print("Personal Linux baseline verified: non-secret files and explicit Oracle role present")
