# Modulo workspace MCP

This stdio MCP server lets an assistant read and create records and update Life/PARA task statuses in Modulo's authenticated, owner-scoped plugin-state API. The server uses the same workspace (`personal`), namespace, schema checks, and optimistic version checks as the app. It never accesses PostgreSQL directly.

Install dependencies and start Modulo's backend, then provide an access token for the account whose workspace you want to edit:

```sh
python3 -m pip install -r tools/modulo_mcp/requirements.txt
export MODULO_BASE_URL=http://localhost:8080
export MODULO_API_TOKEN='<access token for your signed-in Modulo account>'
```

Configure your MCP client to launch `python3 tools/modulo_mcp/server.py` with these variables in its environment. Alternatively, set `MODULO_API_TOKEN_FILE` to a file containing only the token. Tokens expire; replace the token when authentication fails. For a remote backend, use an HTTPS URL.

For a browser login that returns a refresh token, set `MODULO_API_TOKEN_FILE` and `MODULO_OIDC_REFRESH_TOKEN_FILE` to separate mode-0600 files containing the access and refresh tokens. On an API 401 the server refreshes the session through Modulo's Keycloak realm, rotates both files, and retries once. When the Keycloak session itself expires, sign in again and replace both files. Password grant is disabled for the frontend client; the MCP does not store account passwords.

Tools:

- `list_installed_plugins`: inspect saved installation settings. An account with only built-in defaults may have no installation record yet.
- `list_plugin_records` and `get_plugin_record`: inspect keys, values, schemas, and versions before writing.
- `register_plugin_schema`: register a new custom schema if the plugin does not already have one. Existing schema definitions are immutable.
- `create_plugin_record`: create a new key with `expectedVersion: 0`; it fails rather than replacing an existing record.
- `append_plugin_entry`: add an item to an array within an existing record. Supply a JSON Pointer such as `/data/records`; the tool keeps the record's schema and sends its current version, so concurrent edits fail with a conflict. You can pass `expected_version` after inspection to require that exact version.
- `update_para_task_status`: change one Life/PARA task to `Next`, `Waiting`, or `Done`. Read `get_workspace_record(namespace="para")` first, then pass the exact task ID and returned record version as `expected_version`. The tool rejects missing or duplicate IDs, schema changes, and concurrent edits; it preserves all other PARA data. A repeat request for the same status makes no write.
- `create_note`: create a native note through Modulo's Notes API, with optional Markdown and tags.

For example, a workspace-tool plugin with a `records` key stores a `{ "version": 1, "data": ... }` envelope. Inspect that record first, then append to its actual data array. Entry fields vary by plugin and must match the plugin's own format. If the record does not exist yet, create the complete initial envelope with the plugin's schema before appending.

The generic record tools operate on **server-backed plugin state**. Some older Modulo plugins still store entries only in browser `localStorage`; those entries are not available from the backend and cannot be edited through this MCP. The tools do not install plugins or create side-effectful related resources such as attachments. Use the plugin's own workflow when an entry depends on those resources.

## Shared Life/PARA storage

Life/PARA/Tasks is a view over the shared **workspace-para** namespace, record
**data**, schema **modulo.workspace.para**. Tasks are in `value.tasks`; projects,
areas and resources are adjacent arrays. The visible `para-tasks` and `para-core`
plugin IDs are not the storage namespace. Empty results for those IDs do not
mean the user's tasks are absent or the server is wrong.

Use `get_workspace_record(namespace="para")` or the backwards-compatible
`get_plugin_record(plugin_id="workspace-para", key="data")`. Shared workspace
helpers add the same `workspace-` prefix as the app's `workspaceState()` host.
Always preserve the other arrays and require the inspected record version when
updating tasks. New MCP tools become discoverable when the client reconnects;
existing generic tools can access this namespace immediately.
