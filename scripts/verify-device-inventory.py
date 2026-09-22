#!/usr/bin/env python3
"""Validate the non-secret six-device inventory contract."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


EXPECTED = {"desktop", "laptop", "phone", "edge-pi", "dev-netcup", "prod-oracle"}
FORBIDDEN_KEYS = {
    "password", "passwd", "token", "secret", "privatekey", "private_key",
    "recoverycode", "recovery_code", "totp", "seed", "unlockmaterial",
}


def walk_keys(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key).replace("-", "").replace("_", "").lower()
            yield from walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_keys(child)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    data = json.loads(args.inventory.read_text())
    devices = data.get("devices")
    assert data.get("schemaVersion") == 1, "schemaVersion must be 1"
    assert isinstance(devices, list) and len(devices) == 6, "exactly six devices required"
    names = [device.get("name") for device in devices]
    assert set(names) == EXPECTED and len(names) == len(set(names)), "canonical device names are invalid"
    for device in devices:
        for field in ("name", "boundary", "role", "environment", "lifecycle", "evidenceState", "rebuildAuthority"):
            assert device.get(field), f"{device.get('name')}: missing {field}"
    forbidden = sorted(set(walk_keys(data)) & FORBIDDEN_KEYS)
    assert not forbidden, f"secret-bearing inventory keys found: {forbidden}"

    netcup = next(device for device in devices if device["name"] == "dev-netcup")
    assert netcup["network"]["zerotierAddress"] == "10.165.78.189"
    assert netcup["network"]["zerotierNetworkId"] == "88c5b1f339774e42"

    incomplete = [device["name"] for device in devices if device["evidenceState"] not in {"verified", "verified-local", "verified-runtime"}]
    if args.strict and incomplete:
        raise AssertionError(f"strict evidence is incomplete: {', '.join(incomplete)}")

    print(f"PASS device inventory: {len(devices)} unique canonical devices")
    if incomplete:
        print(f"INFO partial evidence: {', '.join(incomplete)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, json.JSONDecodeError) as exc:
        print(f"FAIL device inventory: {exc}", file=sys.stderr)
        raise SystemExit(1)
