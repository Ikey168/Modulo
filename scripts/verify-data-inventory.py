#!/usr/bin/env python3
"""Validate the non-secret personal data inventory."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


FORBIDDEN = {
    "password", "passwd", "token", "secret", "privatekey", "private_key",
    "recoverycode", "recovery_code", "totp", "seed", "credential",
}


def keys(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key).replace("-", "").replace("_", "").lower()
            yield from keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from keys(child)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "inventory",
        nargs="?",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "docs/infrastructure/data/inventory.json",
    )
    args = parser.parse_args()
    data = json.loads(args.inventory.read_text(encoding="utf-8"))
    assert data.get("schemaVersion") == 1, "schemaVersion must be 1"
    datasets = data.get("datasets")
    assert isinstance(datasets, list) and datasets, "datasets must be a non-empty list"
    ids = [item.get("id") for item in datasets]
    assert all(isinstance(item, str) and item for item in ids), "every dataset needs an id"
    assert len(ids) == len(set(ids)), "dataset ids must be unique"
    forbidden = sorted(set(keys(data)) & FORBIDDEN)
    assert not forbidden, f"secret-bearing inventory keys found: {forbidden}"
    for item in datasets:
        for field in ("id", "classification", "authority", "backupPolicy", "restoreMethod", "evidenceState"):
            assert item.get(field), f"{item.get('id')}: missing {field}"
        assert item["classification"] in {"source", "state", "artifact", "cache", "configuration"}
        assert item["evidenceState"] in {"verified", "verified-local", "verified-runtime", "planned", "owner-gated"}
    print(f"PASS data inventory: {len(datasets)} non-secret dataset records")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, json.JSONDecodeError) as exc:
        print(f"FAIL data inventory: {exc}", file=sys.stderr)
        raise SystemExit(1)
