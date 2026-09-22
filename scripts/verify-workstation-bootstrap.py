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
    }
    result = subprocess.run(
        probes.get(command, [command, "--version"]),
        capture_output=True,
        text=True,
        check=False,
    )
    output = (result.stdout or result.stderr).splitlines()
    return output[0].strip() if output else path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path)
    args = parser.parse_args()

    required = {name: command_version(name) for name in REQUIRED_COMMANDS}
    parity = {name: command_version(name) for name in PARITY_COMMANDS}
    failures = [name for name, version in required.items() if version is None]

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

    ssh_policy: dict[str, str] = {}
    sshd = shutil.which("sshd")
    if sshd:
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

    report = {
        "accepted": not failures,
        "requiredCommands": required,
        "parityCommands": parity,
        "projectMarkers": project_markers,
        "sshPolicy": ssh_policy,
        "failures": failures,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
