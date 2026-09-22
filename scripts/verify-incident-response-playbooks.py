#!/usr/bin/env python3
"""Static acceptance checks for the personal incident-response runbook."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNBOOK = ROOT / "docs/security/incident-response/README.md"

PLAYBOOKS = (
    "Lost YubiKey",
    "Stolen phone",
    "Compromised laptop or desktop",
    "GitHub compromise",
    "Production server or cloud-admin compromise",
    "Primary email compromise",
    "Complete device loss",
)

REQUIRED_SECTIONS = (
    "Emergency start — use for every incident",
    "Incident record",
    "Cross-cutting: Bitwarden or vault exposure",
    "Cross-cutting: one leaked token, API key or SSH/signing key",
    "Shared closeout",
    "Preparation checklist",
    "Authoritative references",
)

SAFETY_PHRASES = (
    "known-clean device",
    "independent recovery path",
    "Do not rotate a secret on a compromised device",
    "Do not destroy or reimage evidence",
    "Store no live secrets",
)


def section(text: str, heading: str) -> str:
    pattern = re.compile(
        rf"^## \d+\. {re.escape(heading)}\s*$([\s\S]*?)(?=^## (?:\d+\.|Cross-cutting:|Shared closeout|Preparation checklist|Authoritative references)|\Z)",
        re.MULTILINE,
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def main() -> int:
    text = RUNBOOK.read_text(encoding="utf-8")
    errors: list[str] = []

    for required in REQUIRED_SECTIONS:
        if not re.search(rf"^## (?:\d+\. )?{re.escape(required)}$", text, re.MULTILINE):
            errors.append(f"missing section: {required}")

    for phrase in SAFETY_PHRASES:
        if phrase.casefold() not in text.casefold():
            errors.append(f"missing safety boundary: {phrase}")

    for playbook in PLAYBOOKS:
        body = section(text, playbook)
        if not body:
            errors.append(f"missing playbook: {playbook}")
            continue
        for phase in ("Contain", "Recover", "Verify"):
            if not re.search(rf"^### {phase}$", body, re.MULTILINE):
                errors.append(f"{playbook}: missing {phase} phase")
        if body.count("- [ ]") < 8:
            errors.append(f"{playbook}: fewer than eight executable checks")

    if "password" in text.casefold() and "do not put passwords" not in text.casefold():
        errors.append("missing explicit password-storage prohibition")

    if errors:
        print("Incident-response runbook verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Incident-response runbook verified: {len(PLAYBOOKS)} playbooks, "
        f"{text.count('- [ ]')} executable checks"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
