#!/usr/bin/env python3
"""Validate the local Noesis lifecycle contract without opening its data."""

from __future__ import annotations

import json
import os
import re
import sys
import tomllib
from pathlib import Path


MODULO_ROOT = Path(__file__).resolve().parents[1]
NOESIS_ROOT = Path(os.environ.get("NOESIS_ROOT", str(MODULO_ROOT.parent / "Noesis"))).expanduser()


def main() -> int:
    required = (
        "README.md",
        "Makefile",
        "pyproject.toml",
        "src/noesis_cli/app.py",
        "tests/unit/cli/test_cli.py",
        "contracts/schemas/jsonschema/noesis-cli-v1.json",
        ".noesis/config.json",
        ".noesis/domains.yml",
    )
    missing = [relative for relative in required if not (NOESIS_ROOT / relative).is_file()]
    if missing:
        raise AssertionError(f"Noesis lifecycle entry points missing: {', '.join(missing)}")

    with (NOESIS_ROOT / "pyproject.toml").open("rb") as handle:
        project = tomllib.load(handle).get("project", {})
    if project.get("requires-python") != ">=3.11":
        raise AssertionError("Noesis Python support contract is not >=3.11")
    if project.get("scripts", {}).get("noesis") != "src.noesis_cli.app:main":
        raise AssertionError("Noesis CLI entry point is not authoritative")

    make_targets = set()
    for line in (NOESIS_ROOT / "Makefile").read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([A-Za-z0-9_.-]+):", line)
        if match:
            make_targets.add(match.group(1))
    for target in ("install", "init", "doctor", "test-cli"):
        if target not in make_targets:
            raise AssertionError(f"Noesis Makefile is missing lifecycle target: {target}")

    config = json.loads((NOESIS_ROOT / ".noesis/config.json").read_text(encoding="utf-8"))
    if config.get("config_version") != 1:
        raise AssertionError("Noesis local config version is not 1")
    for field in ("root", "warehouse", "domains", "cursor_directory"):
        value = config.get(field)
        if not isinstance(value, str) or not value.strip():
            raise AssertionError(f"Noesis local config is missing {field}")
    if "def main" not in (NOESIS_ROOT / "src/noesis_cli/app.py").read_text(encoding="utf-8"):
        raise AssertionError("Noesis CLI has no callable main entry point")

    print(f"PASS Noesis lifecycle contract: {NOESIS_ROOT}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, json.JSONDecodeError, tomllib.TOMLDecodeError) as exc:
        print(f"FAIL Noesis lifecycle: {exc}", file=sys.stderr)
        raise SystemExit(1)
