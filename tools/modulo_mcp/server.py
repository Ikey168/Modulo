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
    """Inspect a plugin's server-backed records. Use nextCursor for the next page."""
    return ModuloClient().list_records(plugin_id, cursor, limit)


@mcp.tool()
def get_plugin_record(plugin_id: str, key: str) -> dict:
    """Read one plugin-state record, including its schema and version, before adding an entry."""
    return ModuloClient().get_record(plugin_id, key)


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
def update_plugin_record(plugin_id: str, key: str, value: Any, expected_version: int,
                         schema_id: str | None = None, schema_version: int | None = None) -> dict:
    """Replace a record's whole value. Read it first and pass its version; keeps its schema unless given. Rejects concurrent changes."""
    return ModuloClient().update_record(plugin_id, key, value, expected_version, schema_id, schema_version)


@mcp.tool()
def delete_plugin_record(plugin_id: str, key: str, expected_version: int) -> dict:
    """Delete one record at the version you inspected. Rejects concurrent changes."""
    return ModuloClient().delete_record(plugin_id, key, expected_version)


@mcp.tool()
def create_note(title: str, content: str = "", tags: list[str] | None = None) -> dict:
    """Create a native Notes plugin entry with Markdown content and optional tags."""
    return ModuloClient().create_note(title, content, tags)


if __name__ == "__main__":
    mcp.run()
