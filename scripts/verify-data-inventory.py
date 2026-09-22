#!/usr/bin/env python3
"""Validate the non-secret data-asset inventory contract."""

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "docs/infrastructure/data/inventory.json"
REQUIRED = {
    "id",
    "name",
    "description",
    "ownerSystem",
    "sourceOfTruth",
    "physicalLocation",
    "dataClass",
    "sensitivity",
    "regenerability",
    "backupPolicy",
    "retentionPolicy",
    "rpo",
    "rto",
    "dependencies",
    "recoveryProcedure",
    "lastBackup",
    "lastVerification",
    "lastRestoreTest",
    "evidenceStatus",
}
SECRET_SHAPES = (
    re.compile(r"BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY"),
    re.compile(r"(?:gh[pousr]_)[A-Za-z0-9]{20,}"),
    re.compile(r"(?:password|secret|token|recovery.?code)\s*[:=]\s*\S+", re.I),
)


def fail(message: str) -> None:
    raise SystemExit(f"data inventory: {message}")


def walk_strings(value: object):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    try:
        payload = json.loads(args.path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing file: {args.path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")

    if payload.get("format") != "modulo.data-inventory.v1":
        fail("unexpected format")
    assets = payload.get("dataAssets")
    if not isinstance(assets, list) or len(assets) < 6:
        fail("at least six data assets are required")
    ids = [asset.get("id") for asset in assets if isinstance(asset, dict)]
    if len(ids) != len(set(ids)):
        fail("duplicate data-asset id")

    for asset in assets:
        if not isinstance(asset, dict) or not REQUIRED <= asset.keys():
            fail(f"data asset missing required fields: {asset}")
        if asset["dataClass"] not in {f"T{index}" for index in range(7)}:
            fail(f"unsupported data class for {asset['id']}")
        if not isinstance(asset["dependencies"], list):
            fail(f"dependencies must be a list for {asset['id']}")
        if asset["evidenceStatus"] not in {"verified-local", "verified-excluded", "partial", "pending"}:
            fail(f"invalid evidence status for {asset['id']}")
        for value in walk_strings(asset):
            if any(pattern.search(value) for pattern in SECRET_SHAPES):
                fail(f"secret-shaped value found for {asset['id']}")
    print(f"Data inventory verified: {len(assets)} data assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
