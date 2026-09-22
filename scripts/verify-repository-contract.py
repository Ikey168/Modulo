#!/usr/bin/env python3
"""Validate the repository's documented local-development contract."""

from __future__ import annotations

import json
import sys
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require_file(relative: str) -> None:
    if not (ROOT / relative).is_file():
        raise AssertionError(f"missing contract entry point: {relative}")


def main() -> int:
    for relative in (
        "README.md",
        "CONTRIBUTING.md",
        "package.json",
        "package-lock.json",
        "frontend/package.json",
        "backend/pom.xml",
        ".mise.toml",
        ".gitignore",
        ".github/workflows/ci.yml",
        ".github/workflows/secret-scanning.yml",
        ".github/workflows/state-acceptance.yml",
        ".github/dependabot.yml",
        "scripts/verify-device-inventory.py",
        "scripts/verify-personal-infra.py",
        "scripts/verify-data-inventory.py",
        "scripts/verify-noesis-lifecycle.py",
        "deploy/oci/README.md",
        "deploy/oci/tests/test_contract.py",
    ):
        require_file(relative)

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = package.get("scripts", {})
    for name in ("build", "test", "prepare"):
        if not scripts.get(name):
            raise AssertionError(f"root package.json is missing script: {name}")
    if package.get("workspaces") != ["frontend", "smart-contracts"]:
        raise AssertionError("root workspace declaration changed unexpectedly")

    frontend = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))
    for name in ("typecheck", "lint", "lint:boundary:ci", "test:run", "build:strict"):
        if not frontend.get("scripts", {}).get(name):
            raise AssertionError(f"frontend package.json is missing script: {name}")

    with (ROOT / ".mise.toml").open("rb") as handle:
        mise = tomllib.load(handle)
    tasks = mise.get("tasks", {})
    for name in ("check-contract", "check-frontend", "check-backend", "check-operations", "check"):
        if name not in tasks:
            raise AssertionError(f".mise.toml is missing task: {name}")

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for pattern in (".env", ".env.*", "node_modules", "target"):
        if pattern not in gitignore:
            raise AssertionError(f".gitignore does not protect {pattern}")

    print("PASS repository contract: local entry points and acceptance tasks are present")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, json.JSONDecodeError, tomllib.TOMLDecodeError) as exc:
        print(f"FAIL repository contract: {exc}", file=sys.stderr)
        raise SystemExit(1)
