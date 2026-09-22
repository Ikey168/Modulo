#!/usr/bin/env python3
"""Check the Noesis lifecycle contract and OCI backup exclusions."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs/infrastructure/data/noesis-lifecycle.md"
BACKUP = ROOT / "deploy/oci/backup.sh"
COMPOSE = ROOT / "deploy/oci/compose.yml"


def require(text: str, fragments: tuple[str, ...], source: Path) -> None:
    missing = [fragment for fragment in fragments if fragment not in text]
    if missing:
        raise SystemExit(f"{source}: missing contract fragments: {missing}")


policy = POLICY.read_text(encoding="utf-8")
backup = BACKUP.read_text(encoding="utf-8")
compose = COMPOSE.read_text(encoding="utf-8")

require(
    policy,
    (
        "Irreplaceable source state",
        "Costly derived state",
        "Disposable runtime state",
        "Re-downloadable assets",
        "maximum normal data-loss interval",
        "Restore sequence",
    ),
    POLICY,
)
require(
    backup,
    (
        "noesis-data.tar.gz",
        "gzip -t",
        "sha256sum -c SHA256SUMS",
        "touch \"$target/VERIFIED\"",
        "touch \"$target/COMPLETE\"",
    ),
    BACKUP,
)
require(compose, ("noesis_data:/data", "noesis_models:/models-cache"), COMPOSE)
if "noesis_models" in backup:
    raise SystemExit(f"{BACKUP}: model cache must remain excluded")

print("Noesis lifecycle contract verified: durable data included, model cache excluded")
