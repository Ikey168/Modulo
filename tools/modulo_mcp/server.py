"""MCP tools for authenticated Modulo plugin-state entries."""
from __future__ import annotations

from typing import Any

try:
    from .client import ModuloClient
except ImportError:  # Direct stdio invocation from .mcp.json.
    from client import ModuloClient

from fastmcp import FastMCP

mcp = FastMCP("modulo-workspace")


@mcp.tool()
def list_installed_plugins() -> dict:
    """List account-recorded plugin installations and enabled status. Built-in defaults may be absent until saved."""
    return ModuloClient().installed_plugins()


@mcp.tool()
def list_plugin_records(plugin_id: str, cursor: str | None = None, limit: int = 100) -> dict:
    """Inspect a storage namespace, not necessarily its UI plugin ID. Life/PARA/Tasks is workspace-para, key data, value.tasks. Use nextCursor for the next page."""
    return ModuloClient().list_records(plugin_id, cursor, limit)


@mcp.tool()
def get_plugin_record(plugin_id: str, key: str) -> dict:
    """Read one plugin-state record, including its schema and version, before adding an entry."""
    return ModuloClient().get_record(plugin_id, key)


@mcp.tool()
def list_workspace_records(namespace: str, cursor: str | None = None, limit: int = 100) -> dict:
    """Read shared workspace data. Life/PARA/Tasks uses namespace='para', key='data', value.tasks. UI plugin IDs such as para-tasks do not own these records."""
    return ModuloClient().list_workspace_records(namespace, cursor, limit)


@mcp.tool()
def get_workspace_record(namespace: str, key: str = "data") -> dict:
    """Read shared workspace data, e.g. namespace='para' for Life/PARA tasks, projects, areas and resources. Includes schema and optimistic version."""
    return ModuloClient().get_workspace_record(namespace, key)


@mcp.tool()
def register_plugin_schema(plugin_id: str, schema_id: str, schema: dict[str, Any],
                           schema_version: int = 1) -> str:
    """Register an immutable custom schema in a plugin namespace before creating its first record."""
    ModuloClient().register_schema(plugin_id, schema_id, schema, schema_version)
    return "Schema registered"


@mcp.tool()
def create_plugin_record(plugin_id: str, key: str, schema_id: str, value: Any,
                         schema_version: int = 1) -> dict:
    """Create a native plugin-state record with an existing registered schema. Fails if the key exists."""
    return ModuloClient().create_record(plugin_id, key, schema_id, value, schema_version)


@mcp.tool()
def append_plugin_entry(plugin_id: str, key: str, array_path: str, entry: Any,
                        expected_version: int | None = None) -> dict:
    """Append to an existing plugin record's JSON array (e.g. /data/records); preserves schema and rejects concurrent changes."""
    return ModuloClient().append_entry(plugin_id, key, array_path, entry, expected_version)


@mcp.tool()
def create_note(title: str, content: str = "", tags: list[str] | None = None) -> dict:
    """Create a native Notes plugin entry with Markdown content and optional tags."""
    return ModuloClient().create_note(title, content, tags)


if __name__ == "__main__":
    mcp.run()
