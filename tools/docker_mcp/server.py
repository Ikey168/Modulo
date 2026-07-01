"""
Modulo Docker MCP server.

Tools for inspecting and managing Docker services in the Modulo dev environment.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from fastmcp import FastMCP

REPO_ROOT = Path(__file__).resolve().parents[2]
DEV_COMPOSE = str(REPO_ROOT / "docker-compose.dev.yml")
FULL_COMPOSE = str(REPO_ROOT / "docker-compose.yml")

mcp = FastMCP("docker-modulo")


def _run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
    return (result.stdout + result.stderr).strip()


@mcp.tool()
def list_containers(all: bool = False) -> str:
    """List Docker containers with their status and ports."""
    flags = ["-a"] if all else []
    return _run(["docker", "ps"] + flags + ["--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"])


@mcp.tool()
def compose_status(dev: bool = True) -> str:
    """
    Show status of all docker-compose services.
    dev=True uses docker-compose.dev.yml (frontend, backend, db).
    dev=False uses docker-compose.yml (full stack including keycloak, neo4j, monitoring).
    """
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    return _run(["docker-compose", "-f", compose_file, "ps"])


@mcp.tool()
def get_logs(service: str, dev: bool = True, lines: int = 100) -> str:
    """
    Get recent logs from a docker-compose service.
    Dev services: frontend, backend, db.
    Full stack adds: keycloak, neo4j, audit-collector, otel-collector,
                     jaeger, prometheus, grafana, loki, elasticsearch, opa.
    """
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    return _run(["docker-compose", "-f", compose_file, "logs", "--tail", str(lines), service])


@mcp.tool()
def service_health(dev: bool = True) -> str:
    """Check health status of all compose services, showing state and health check results."""
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    ps_out = _run(["docker-compose", "-f", compose_file, "ps", "--format", "json"])
    try:
        services = json.loads(ps_out)
        if isinstance(services, list):
            lines = []
            for s in services:
                name = s.get("Name", s.get("Service", "?"))
                state = s.get("State", "?")
                health = s.get("Health", "")
                status = state + (f" ({health})" if health else "")
                lines.append(f"{name}: {status}")
            return "\n".join(lines)
    except (json.JSONDecodeError, TypeError):
        pass
    return ps_out


@mcp.tool()
def restart_service(service: str, dev: bool = True) -> str:
    """Restart a specific docker-compose service."""
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    return _run(["docker-compose", "-f", compose_file, "restart", service])


@mcp.tool()
def start_services(dev: bool = True) -> str:
    """Start all docker-compose services in detached mode."""
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    return _run(["docker-compose", "-f", compose_file, "up", "-d"])


@mcp.tool()
def stop_services(dev: bool = True) -> str:
    """Stop all docker-compose services."""
    compose_file = DEV_COMPOSE if dev else FULL_COMPOSE
    return _run(["docker-compose", "-f", compose_file, "down"])


if __name__ == "__main__":
    mcp.run()
