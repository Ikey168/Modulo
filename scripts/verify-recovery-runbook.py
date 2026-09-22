#!/usr/bin/env python3
"""Fail closed when the recovery entry point loses a required scenario or link."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
RUNBOOK = ROOT / "docs/infrastructure/recovery/README.md"
REQUIRED_HEADINGS = {
    "Rules for every incident",
    "Choose the recovery path",
    "File or working tree",
    "Endpoint loss",
    "Pi homeserver loss",
    "Paperless",
    "Oracle production loss",
    "Modulo deletion or corruption",
    "Noesis corruption",
    "Netcup loss",
    "GitHub loss",
    "Cloud backup outage",
    "Lost backup credential",
    "Ransomware",
    "Complete infrastructure loss",
    "Evidence record",
}
REQUIRED_REFERENCES = (
    "../records/disaster-recovery-2026-09-20.md",
    "../../../deploy/oci/README.md",
    "./scripts/paperless-offsite-restore-drill.sh",
    "./restore-drill.sh",
)


def main() -> None:
    text = RUNBOOK.read_text(encoding="utf-8")
    headings = set(re.findall(r"^## (.+)$", text, re.MULTILINE))
    missing = sorted(REQUIRED_HEADINGS - headings)
    if missing:
        raise SystemExit("missing recovery sections: " + ", ".join(missing))
    for reference in REQUIRED_REFERENCES:
        if reference not in text:
            raise SystemExit(f"missing recovery reference: {reference}")
    if "Never test a restore\n   by overwriting" not in text:
        raise SystemExit("missing non-destructive restore rule")
    if "secret values" not in text:
        raise SystemExit("missing secret-handling boundary")
    print(f"recovery runbook verified: {len(headings)} required sections and references present")


if __name__ == "__main__":
    main()
