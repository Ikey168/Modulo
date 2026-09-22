#!/usr/bin/env python3
"""Validate the object-storage decision, policy and migration safety contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs/storage/object-storage-inventory.json"
RUNBOOK = ROOT / "docs/storage/object-storage.md"
MIGRATOR = ROOT / "scripts/object-storage-migrate.sh"

EXPECTED_CLASSES = {
    "datasets",
    "generated-artifacts",
    "application-objects",
    "research-outputs",
    "archives",
}


def main() -> int:
    errors: list[str] = []
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    runbook = RUNBOOK.read_text(encoding="utf-8")
    migrator = MIGRATOR.read_text(encoding="utf-8")

    if inventory.get("format") != "modulo.object-storage.v1":
        errors.append("unexpected inventory format")

    decision = inventory.get("decision", {})
    if decision.get("cloudflareR2RequiredNow") is not False:
        errors.append("R2 decision must explicitly be false until a workload trigger fires")
    if len(decision.get("rationale", [])) < 3:
        errors.append("decision needs at least three evidence-based reasons")
    if len(decision.get("activationTriggers", [])) < 4:
        errors.append("decision needs measurable activation triggers")
    if not decision.get("decisionOwner") or not decision.get("reviewCadenceDays"):
        errors.append("decision owner or review cadence is missing")

    classes = inventory.get("classes", [])
    ids = {item.get("id") for item in classes}
    if ids != EXPECTED_CLASSES:
        errors.append(f"object classes differ: expected {sorted(EXPECTED_CLASSES)}, got {sorted(ids)}")

    naming_pattern = re.compile(inventory.get("naming", {}).get("allowed", r"$^"))
    names: set[str] = set()
    for item in classes:
        name = item.get("candidateBucket", "")
        if not naming_pattern.fullmatch(name):
            errors.append(f"invalid candidate bucket name: {name}")
        if name in names:
            errors.append(f"duplicate candidate bucket name: {name}")
        names.add(name)
        if item.get("publicAccess") is not False or item.get("cors") != []:
            errors.append(f"{item.get('id')}: public access/CORS must default closed")
        if not item.get("authority") or not item.get("lifecycle"):
            errors.append(f"{item.get('id')}: authority or lifecycle missing")
        if not item.get("allowedContent") or not item.get("forbiddenContent"):
            errors.append(f"{item.get('id')}: content boundary missing")

    credential = inventory.get("credentialPolicy", {})
    for required_true in (
        "oneCredentialPerServiceEnvironment",
        "bucketScoped",
        "administrativeCredentialSeparate",
        "rotateOnRoleChangeOrSuspectedExposure",
    ):
        if credential.get(required_true) is not True:
            errors.append(f"credential policy must enable {required_true}")
    for required_false in ("accountWideCredentialsOnWorkloads", "browserCredentialsAllowed"):
        if credential.get(required_false) is not False:
            errors.append(f"credential policy must disable {required_false}")

    required_runbook_sections = (
        "Decision",
        "Data placement boundary",
        "Bucket and object conventions",
        "Lifecycle and retention",
        "Access, CORS and public exposure",
        "Provider activation",
        "Provider migration and exit",
        "Monitoring and review",
        "Acceptance evidence",
    )
    for heading in required_runbook_sections:
        if f"## {heading}" not in runbook:
            errors.append(f"runbook section missing: {heading}")

    for required in ("rclone copy", "rclone check", "--download", "--dry-run", "--one-way"):
        if required not in migrator:
            errors.append(f"migration contract missing: {required}")
    for prohibited in ("rclone sync", "rclone delete", "rclone purge"):
        executable_lines = [
            line.strip()
            for line in migrator.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        if any(line.startswith(prohibited) for line in executable_lines):
            errors.append(f"migration contract contains destructive command: {prohibited}")

    serialized = json.dumps(inventory).casefold()
    for secret_key in ("secretaccesskey", "accesskeyid", "password", "api_token"):
        if f'"{secret_key}"' in serialized:
            errors.append(f"inventory appears to contain credential field: {secret_key}")

    if errors:
        print("Object-storage policy verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Object-storage policy verified: {len(classes)} classes, "
        f"{sum(len(item['lifecycle']) for item in classes)} lifecycle rules, "
        "closed-by-default access"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
