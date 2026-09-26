#!/usr/bin/env python3
"""Check that incident response keeps its required scenarios and safety gates."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PLAYBOOK = ROOT / "docs/security/incident-response/README.md"
REQUIRED = {
    "Universal first response",
    "Lost or stolen hardware security key",
    "Lost phone, SIM or eSIM",
    "Password-manager compromise",
    "Compromised browser or active web session",
    "Compromised workstation or laptop",
    "Leaked API token, PAT or OAuth credential",
    "Leaked SSH or signing key",
    "Suspicious GitHub App, OAuth grant or workflow",
    "Email account takeover",
    "Server or cloud administrative compromise",
    "Closeout and evidence",
}


def main() -> None:
    text = PLAYBOOK.read_text(encoding="utf-8")
    normalized = " ".join(text.lower().split())
    headings = set(re.findall(r"^## (.+)$", text, re.MULTILINE))
    missing = sorted(REQUIRED - headings)
    if missing:
        raise SystemExit("missing incident playbooks: " + ", ".join(missing))
    for boundary in (
        "known-clean device",
        "never contain credentials",
        "Acceptance:",
        "documentation alone is not proof",
    ):
        if boundary.lower() not in normalized:
            raise SystemExit(f"missing incident-response boundary: {boundary}")
    print(f"incident playbooks verified: {len(REQUIRED)} required sections present")


if __name__ == "__main__":
    main()
