#!/usr/bin/env python3
"""Verify the bounded Netcup development-host and clean-checkout contract."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess


SYSTEM_COMMANDS = (
    "cmake",
    "docker",
    "gcc",
    "gh",
    "git",
    "jq",
    "make",
    "mise",
    "mvn",
    "ninja",
    "rg",
    "rustup",
    "shellcheck",
    "tmux",
)


def run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)


def first_line(result: subprocess.CompletedProcess[str]) -> str | None:
    combined = (result.stdout + "\n" + result.stderr).strip()
    return combined.splitlines()[0] if combined else None


def as_admin(
    admin: str, home: Path, project: Path, command: list[str]
) -> subprocess.CompletedProcess[str]:
    return run(
        [
            "runuser",
            "-u",
            admin,
            "--",
            "env",
            f"HOME={home}",
            f"USER={admin}",
            f"LOGNAME={admin}",
            *command,
        ],
        cwd=project,
    )


def admin_run(
    admin: str, home: Path, project: Path, command: list[str]
) -> subprocess.CompletedProcess[str]:
    return as_admin(admin, home, project, ["mise", "exec", "--", *command])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--admin-user", default="ik")
    args = parser.parse_args()

    failures: list[str] = []
    if os.geteuid() != 0:
        failures.append("verifier:not-root")

    try:
        account = pwd.getpwnam(args.admin_user)
    except KeyError:
        account = None
        failures.append("admin-user:missing")
    admin_home = Path(account.pw_dir) if account else Path("/nonexistent")

    files = {
        "role": Path("/etc/motd.d/60-personal-role"),
        "boundary": Path("/etc/motd.d/70-development-boundary"),
        "backupScope": Path("/etc/personal-backup/DEV-NETCUP-SCOPE"),
        "health": Path("/var/lib/dev-netcup-health/last.json"),
        "docker": Path("/etc/docker/daemon.json"),
    }
    file_state = {name: path.is_file() for name, path in files.items()}
    failures.extend(f"file:{name}" for name, present in file_state.items() if not present)

    if file_state["role"]:
        role = files["role"].read_text()
        if "disposable-development-compute" not in role or "dev-netcup" not in role:
            failures.append("role:content")

    health: dict[str, object] = {}
    if file_state["health"]:
        try:
            health = json.loads(files["health"].read_text())
            if health.get("healthy") is not True:
                failures.append("health:degraded")
            services = health.get("services", {})
            if not isinstance(services, dict) or services.get("adminFirewall") != "active":
                failures.append("health:admin-firewall")
        except (OSError, json.JSONDecodeError):
            failures.append("health:invalid")

    if file_state["docker"]:
        try:
            docker = json.loads(files["docker"].read_text())
            options = docker.get("log-opts", {})
            expected = {"max-file": "3", "max-size": "25m"}
            if docker.get("live-restore") is not True or options != expected:
                failures.append("docker:policy")
        except (OSError, json.JSONDecodeError):
            failures.append("docker:invalid")

    units = (
        "docker.service",
        "ssh.service",
        "zerotier-one.service",
        "dev-netcup-health.timer",
        "dev-netcup-docker-prune.timer",
        "netcup-ssh-zerotier-firewall.service",
    )
    unit_state: dict[str, dict[str, str]] = {}
    for unit in units:
        active = run(["systemctl", "is-active", unit]).stdout.strip()
        enabled = run(["systemctl", "is-enabled", unit]).stdout.strip()
        unit_state[unit] = {"active": active, "enabled": enabled}
        if active != "active" or enabled != "enabled":
            failures.append(f"unit:{unit}")

    ssh_policy: dict[str, str] = {}
    sshd = run(["sshd", "-T"])
    if sshd.returncode != 0:
        failures.append("sshd:invalid")
    else:
        wanted = {
            "passwordauthentication": {"no"},
            "kbdinteractiveauthentication": {"no"},
            "pubkeyauthentication": {"yes"},
            "permitrootlogin": {"without-password", "prohibit-password"},
        }
        for line in sshd.stdout.splitlines():
            key, _, value = line.partition(" ")
            if key in wanted:
                ssh_policy[key] = value
        for key, accepted in wanted.items():
            if ssh_policy.get(key) not in accepted:
                failures.append(f"sshd:{key}")

    groups = run(["id", "-nG", args.admin_user])
    if groups.returncode != 0 or "docker" not in groups.stdout.split():
        failures.append("admin-user:docker-group")

    system_commands: dict[str, str | None] = {}
    for command in SYSTEM_COMMANDS:
        location = shutil.which(command)
        system_commands[command] = location
        if location is None:
            failures.append(f"command:{command}")

    project = args.project.resolve()
    markers = (".git", ".mise.toml", "package.json", "backend/pom.xml")
    marker_state = {marker: (project / marker).exists() for marker in markers}
    failures.extend(f"project:{marker}" for marker, present in marker_state.items() if not present)

    git_status = as_admin(
        args.admin_user, admin_home, project, ["git", "status", "--porcelain"]
    )
    clean_checkout = git_status.returncode == 0 and not git_status.stdout.strip()
    if not clean_checkout:
        failures.append("project:not-clean")

    runtimes: dict[str, str | None] = {}
    for name, command in {
        "java": ["java", "-version"],
        "node": ["node", "--version"],
        "npm": ["npm", "--version"],
        "python": ["python", "--version"],
    }.items():
        result = admin_run(args.admin_user, admin_home, project, command)
        runtimes[name] = first_line(result)
        if result.returncode != 0:
            failures.append(f"runtime:{name}")

    tasks = as_admin(args.admin_user, admin_home, project, ["mise", "tasks"])
    for task in (
        "check",
        "check-backend",
        "check-frontend",
        "check-frontend-strict-lint",
        "check-infrastructure",
        "check-repository",
        "check-wasm",
    ):
        if task not in tasks.stdout:
            failures.append(f"mise-task:{task}")

    repository_check = as_admin(
        args.admin_user, admin_home, project, ["git", "diff", "--check"]
    )
    if repository_check.returncode != 0:
        failures.append("smoke:repository-check")

    report = {
        "accepted": not failures,
        "adminUser": args.admin_user,
        "cleanCheckout": clean_checkout,
        "failures": failures,
        "files": file_state,
        "health": health,
        "projectMarkers": marker_state,
        "runtimes": runtimes,
        "sshPolicy": ssh_policy,
        "systemCommands": system_commands,
        "units": unit_state,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    raise SystemExit(0 if not failures else 1)


if __name__ == "__main__":
    main()
