#!/usr/bin/env python3
"""Check the non-secret source and operations contract used by Oracle."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = (
    "README.md",
    ".github/workflows/ci.yml",
    ".github/workflows/docker-build.yml",
    "deploy/oci/compose.yml",
    "deploy/oci/.env.example",
    "deploy/oci/backup.sh",
    "deploy/oci/restore-drill.sh",
    "deploy/oci/offsite-drill.sh",
    "deploy/oci/release.sh",
    "deploy/oci/status.sh",
    "deploy/oci/schema.sh",
    "docs/operations/oracle-deployment.md",
    "docs/infrastructure/data/noesis-lifecycle.md",
    "infra/personal/inventory.example.yml",
    "infra/personal/playbooks/oracle.yml",
    "scripts/verify-noesis-lifecycle.py",
    "scripts/verify-personal-infra.py",
)


def fail(message: str) -> None:
    raise SystemExit(f"repository contract: {message}")


def main() -> int:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).is_file()]
    if missing:
        fail("missing required files: " + ", ".join(missing))

    try:
        tracked = subprocess.check_output(
            ["git", "ls-files", "-z"], cwd=ROOT, text=False
        ).decode().split("\0")
    except (OSError, subprocess.CalledProcessError) as exc:
        fail(f"cannot inspect Git files: {exc}")
    forbidden = [
        path
        for path in tracked
        if path and (
            Path(path).name in {".env", ".env.local"}
            or path.endswith((".pem", ".key", ".p12", ".pfx"))
        )
    ]
    if forbidden:
        fail("secret-bearing files are tracked: " + ", ".join(forbidden))

    compose = (ROOT / "deploy/oci/compose.yml").read_text(encoding="utf-8")
    for fragment in ("noesis_data:/data", "noesis_models:/models-cache", "source-revision"):
        if fragment not in compose:
            fail(f"compose contract is missing {fragment}")
    env_example = (ROOT / "deploy/oci/.env.example").read_text(encoding="utf-8")
    if "NOESIS_JWT_SECRET" not in env_example or "PRAXIS_API_TOKEN" not in env_example:
        fail("secret placeholders are missing from deploy/oci/.env.example")
    workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    if "permissions:" not in workflow or "contents: read" not in workflow:
        fail("CI must declare read-only default contents permissions")
    print(f"Repository contract verified: {len(REQUIRED_FILES)} required paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
