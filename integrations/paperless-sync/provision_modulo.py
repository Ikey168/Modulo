#!/usr/bin/env python3
"""Provision owner-scoped Modulo schemas and outbound callback credentials."""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import tempfile

from client import ModuloClient


def secret(path: pathlib.Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     prefix=f".{path.name}.", delete=False) as handle:
        os.fchmod(handle.fileno(), 0o600)
        handle.write(value if isinstance(value, str) else json.dumps(value, separators=(",", ":")))
        handle.write("\n")
        temporary = pathlib.Path(handle.name)
    os.replace(temporary, path)


def issue(client: ModuloClient, plugin_id: str, destination: pathlib.Path) -> str:
    permissions = ["state.read", "state.write"]
    workload = client._request("/api/plugin-state/workloads", "POST", {
        "pluginId": plugin_id, "permissions": permissions, "lifetimeSeconds": 7_776_000,
    })
    grant = client._request("/api/plugin-state/grants", "POST", {
        "pluginId": plugin_id, "permissions": permissions, "lifetimeSeconds": 3600,
    })
    secret(destination / f"{plugin_id}-workload-token", workload["token"])
    secret(destination / f"{plugin_id}-grant.json", {
        "token": grant["token"], "expiresAt": grant["grant"]["expiresAt"], "id": grant["grant"]["id"],
    })
    return workload["workload"]["expiresAt"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--schemas", type=pathlib.Path, default=pathlib.Path(__file__).parent / "schemas")
    args = parser.parse_args()
    client = ModuloClient()
    for namespace, names in {
        "paperless": ["paperless.document", "paperless.health", "paperless.settings"],
        "paperless-actions": ["paperless.action"],
    }.items():
        for schema_id in names:
            schema = json.loads((args.schemas / f"{schema_id}.json").read_text(encoding="utf-8"))
            client.register_schema(namespace, schema_id, schema, 1)
    expires = issue(client, "paperless", args.output)
    issue(client, "paperless-actions", args.output)
    secret(args.output / "modulo-workload-expiry", expires)
    print("Provisioned four schemas and two revocable outbound identities.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
