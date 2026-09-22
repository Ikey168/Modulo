#!/usr/bin/env python3
"""Validate the non-secret six-device inventory contract."""

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "docs/infrastructure/devices/inventory.json"
EXPECTED = {"desktop", "laptop", "phone", "edge-pi", "dev-netcup", "prod-oracle"}
REQUIRED = {
    "name",
    "boundary",
    "role",
    "purpose",
    "owner",
    "lifecycle",
    "stateAuthorities",
    "rebuildProfile",
    "productionOnly",
    "evidence",
}
SECRET_SHAPES = (
    re.compile(r"BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY"),
    re.compile(r"(?:gh[pousr]_)[A-Za-z0-9]{20,}"),
    re.compile(r"(?:password|secret|token|recovery.?code)\s*[:=]\s*\S+", re.I),
)


def fail(message: str) -> None:
    raise SystemExit(f"device inventory: {message}")


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
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    try:
        payload = json.loads(args.path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing file: {args.path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")

    if payload.get("format") != "modulo.device-inventory.v1":
        fail("unexpected format")
    devices = payload.get("devices")
    if not isinstance(devices, list):
        fail("devices must be a list")
    names = [item.get("name") for item in devices if isinstance(item, dict)]
    if len(names) != len(set(names)):
        fail("duplicate canonical device name")
    if set(names) != EXPECTED:
        fail(f"expected exactly {sorted(EXPECTED)}, got {sorted(names)}")

    allowed_boundaries = {"personal", "home-infrastructure", "development", "production"}
    for device in devices:
        if not isinstance(device, dict) or not REQUIRED <= device.keys():
            fail(f"device missing required fields: {device}")
        if device["boundary"] not in allowed_boundaries:
            fail(f"unsupported boundary for {device['name']}")
        if not isinstance(device["stateAuthorities"], list) or not device["stateAuthorities"]:
            fail(f"stateAuthorities must be non-empty for {device['name']}")
        evidence = device["evidence"]
        if not isinstance(evidence, dict) or evidence.get("status") not in {"partial", "pending", "verified"}:
            fail(f"invalid evidence status for {device['name']}")
        if device["name"] == "prod-oracle" and (
            device["boundary"] != "production" or device["productionOnly"] is not True
        ):
            fail("prod-oracle must be production-only")
        for value in walk_strings(device):
            if any(pattern.search(value) for pattern in SECRET_SHAPES):
                fail(f"secret-shaped value found for {device['name']}")

    if args.strict:
        incomplete = [device["name"] for device in devices if device["evidence"]["status"] != "verified"]
        if incomplete:
            fail(f"strict evidence is incomplete: {', '.join(incomplete)}")
    print(f"Device inventory verified: {len(devices)} canonical roles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
