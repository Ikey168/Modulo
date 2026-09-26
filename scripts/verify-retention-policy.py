#!/usr/bin/env python3
"""Validate retention coverage and fail-safe deletion language."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs/infrastructure/data/retention-policy.md"


def main() -> None:
    text = " ".join(POLICY.read_text(encoding="utf-8").lower().split())
    for data_class in range(7):
        if f"t{data_class}" not in text:
            raise SystemExit(f"missing retention class T{data_class}")
    for subject in (
        "identity and recovery",
        "irreplaceable originals",
        "modulo notes and plugin state",
        "noesis sources and provenance",
        "git repositories",
        "application/audit logs",
        "temporary exports",
        "build output",
    ):
        if subject not in text:
            raise SystemExit(f"missing retention subject: {subject}")
    for safeguard in (
        "never auto-delete",
        "unknown never means safe to delete",
        "deletion is blocked",
        "failed uploads never trigger pruning",
    ):
        if safeguard not in text:
            raise SystemExit(f"missing retention safeguard: {safeguard}")
    print("retention policy verified: T0-T6, authorities, deletion gates and safeguards present")


if __name__ == "__main__":
    main()
