#!/usr/bin/env python3
"""Validate the non-secret six-device inventory and its evidence gate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


EXPECTED_IDS = {"desktop", "laptop", "phone", "pi5", "netcup", "oracle"}
ALLOWED_BOUNDARIES = {"personal", "home-infrastructure", "development", "production"}
ALLOWED_EVIDENCE = {"verified", "partial", "blocked"}
FORBIDDEN_KEY_FRAGMENTS = {
    "passwordvalue",
    "privatekey",
    "recoverycode",
    "secretvalue",
    "totpseed",
    "tokenvalue",
}


class InventoryError(ValueError):
    pass


def _normalized_key(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def _reject_secret_fields(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = _normalized_key(str(key))
            if any(fragment in normalized for fragment in FORBIDDEN_KEY_FRAGMENTS):
                raise InventoryError(f"secret-bearing field is forbidden at {path}.{key}")
            _reject_secret_fields(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_secret_fields(child, f"{path}[{index}]")


def validate_inventory(data: Any, strict_evidence: bool = False) -> list[str]:
    if not isinstance(data, dict) or data.get("schemaVersion") != 1:
        raise InventoryError("schemaVersion must be 1")
    devices = data.get("devices")
    if not isinstance(devices, list) or len(devices) != 6:
        raise InventoryError("inventory must contain exactly six devices")

    _reject_secret_fields(data)
    ids = [device.get("id") for device in devices if isinstance(device, dict)]
    if set(ids) != EXPECTED_IDS or len(ids) != len(set(ids)):
        raise InventoryError("device IDs must be unique and match the six-device contract")

    logical_names: set[str] = set()
    roles: set[str] = set()
    warnings: list[str] = []
    required = {
        "id", "label", "currentName", "canonicalName", "targetRole",
        "observedRole", "trustBoundary", "lifecycleState", "platform",
        "network", "access", "state", "rebuildProfile", "evidence",
    }
    for device in devices:
        missing = sorted(required - set(device))
        if missing:
            raise InventoryError(f"{device.get('id', '<unknown>')} missing: {', '.join(missing)}")
        if device["trustBoundary"] not in ALLOWED_BOUNDARIES:
            raise InventoryError(f"{device['id']} has invalid trust boundary")
        name = device["canonicalName"]
        role = device["targetRole"]
        if not isinstance(name, str) or not name:
            raise InventoryError(f"{device['id']} has no canonical name")
        if name in logical_names:
            raise InventoryError(f"duplicate canonical name: {name}")
        if role in roles:
            raise InventoryError(f"duplicate target role: {role}")
        logical_names.add(name)
        roles.add(role)

        evidence = device["evidence"]
        if not isinstance(evidence, dict) or evidence.get("status") not in ALLOWED_EVIDENCE:
            raise InventoryError(f"{device['id']} has invalid evidence status")
        gaps = evidence.get("gaps")
        if not isinstance(gaps, list):
            raise InventoryError(f"{device['id']} evidence gaps must be a list")
        if evidence["status"] != "verified" or gaps:
            warnings.append(
                f"{device['id']}: status={evidence['status']}, gaps={len(gaps)}"
            )

    if strict_evidence and warnings:
        raise InventoryError("strict evidence gate failed: " + "; ".join(warnings))
    return warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict-evidence", action="store_true")
    parser.add_argument("inventory", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.inventory.read_text(encoding="utf-8"))
        warnings = validate_inventory(data, strict_evidence=args.strict_evidence)
    except (OSError, json.JSONDecodeError, InventoryError) as error:
        print(f"device inventory invalid: {error}", file=sys.stderr)
        return 1

    print(f"device inventory valid: 6 devices, {len(warnings)} evidence warning(s)")
    for warning in warnings:
        print(f"warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
