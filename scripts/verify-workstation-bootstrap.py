#!/usr/bin/env python3
"""Functional acceptance check for a bootstrapped developer workstation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess


REQUIRED_COMMANDS = (
    "git",
    "gh",
    "rg",
    "jq",
    "tmux",
    "zsh",
    "fzf",
    "cmake",
    "gcc",
    "make",
    "ninja",
    "shellcheck",
    "ssh",
)

# Required only with --expect-project-runtimes: the repository declares the
# runtimes and mise provisions them; the editor is the agreed terminal editor.
RUNTIME_COMMANDS = (
    "mise",
    "nvim",
)

PARITY_COMMANDS = (
    "bat",
    "batcat",
    "delta",
    "starship",
    "mise",
    "docker",
    "node",
    "npm",
    "java",
    "mvn",
    "uv",
    "code",
)

PROJECT_MARKERS = (
    ".mise.toml",
    "mise.toml",
    "package.json",
    "pom.xml",
    "pyproject.toml",
)


def command_version(command: str) -> str | None:
    path = shutil.which(command)
    if path is None:
        return None
    probes = {
        "tmux": [command, "-V"],
        "ssh": [command, "-V"],
        "gcc": [command, "--version"],
        "java": [command, "-version"],
    }
    result = subprocess.run(
        probes.get(command, [command, "--version"]),
        capture_output=True,
        text=True,
        check=False,
    )
    output = (result.stdout or result.stderr).splitlines()
    return output[0].strip() if output else path


def project_runtimes(project: Path, failures: list[str]) -> dict[str, object]:
    """Resolve the project's mise tools and require each to come from the project."""
    config = next(
        (project / name for name in (".mise.toml", "mise.toml") if (project / name).is_file()),
        None,
    )
    if config is None:
        failures.append("runtime:project-declaration")
        return {}
    result = subprocess.run(
        ["mise", "ls", "--current", "--json"],
        cwd=project,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        failures.append("runtime:mise-resolution")
        return {"error": result.stderr.strip().splitlines()[-1:] or ["mise failed"]}
    resolved: dict[str, object] = {}
    for tool, entries in json.loads(result.stdout).items():
        entry = entries[0] if entries else {}
        source = (entry.get("source") or {}).get("path")
        resolved[tool] = {
            "requested": entry.get("requested_version"),
            "version": entry.get("version"),
            "installed": entry.get("installed", False),
            "source": source,
        }
        # Only tools the project declares are judged; host-global extras may exist.
        if source and Path(source).resolve() == config.resolve():
            if not entry.get("installed", False):
                failures.append(f"runtime:{tool}:not-installed")
    declared = {
        tool for tool, value in resolved.items()
        if value["source"] and Path(value["source"]).resolve() == config.resolve()
    }
    if not declared:
        failures.append("runtime:no-project-tools")
    return {"config": str(config), "declared": sorted(declared), "tools": resolved}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path)
    parser.add_argument("--expect-sshd-hardening", action="store_true")
    parser.add_argument(
        "--expect-project-runtimes",
        action="store_true",
        help="require mise, the editor, and every runtime the project declares",
    )
    args = parser.parse_args()

    required = {name: command_version(name) for name in REQUIRED_COMMANDS}
    parity = {name: command_version(name) for name in PARITY_COMMANDS}
    failures = [name for name, version in required.items() if version is None]
    if args.expect_project_runtimes:
        for name in RUNTIME_COMMANDS:
            required[name] = command_version(name)
            if required[name] is None:
                failures.append(name)

    role_marker = Path("/etc/motd.d/60-personal-role")
    backup_boundary = Path("/etc/personal-backup/README")
    if not role_marker.is_file():
        failures.append("role-marker")
    if not backup_boundary.is_file():
        failures.append("backup-secret-boundary")

    project_markers: list[str] = []
    if args.project:
        project_markers = [
            marker for marker in PROJECT_MARKERS if (args.project / marker).is_file()
        ]
        if not project_markers:
            failures.append("project-tool-declaration")

    runtimes: dict[str, object] = {}
    if args.expect_project_runtimes:
        if not args.project:
            failures.append("runtime:--project-required")
        elif shutil.which("mise"):
            runtimes = project_runtimes(args.project, failures)

    ssh_policy: dict[str, str] = {}
    sshd = shutil.which("sshd")
    if args.expect_sshd_hardening and sshd:
        result = subprocess.run(
            [sshd, "-T"], capture_output=True, text=True, check=False
        )
        for line in result.stdout.splitlines():
            key, _, value = line.partition(" ")
            if key in {
                "passwordauthentication",
                "kbdinteractiveauthentication",
                "permitrootlogin",
                "pubkeyauthentication",
            }:
                ssh_policy[key] = value
        expected = {
            "passwordauthentication": "no",
            "kbdinteractiveauthentication": "no",
            "permitrootlogin": "no",
            "pubkeyauthentication": "yes",
        }
        for key, value in expected.items():
            if ssh_policy.get(key) != value:
                failures.append(f"sshd:{key}")
    elif args.expect_sshd_hardening:
        failures.append("sshd:missing")

    report = {
        "accepted": not failures,
        "requiredCommands": required,
        "parityCommands": parity,
        "projectMarkers": project_markers,
        "projectRuntimes": runtimes,
        "sshPolicy": ssh_policy,
        "failures": failures,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
