# Modulo workspace MCP

This stdio MCP server lets an assistant read and create records in Modulo's authenticated, owner-scoped plugin-state API. The server uses the same workspace (`personal`), namespace, schema checks, and optimistic version checks as the app. It never accesses PostgreSQL directly.

Install dependencies and start Modulo's backend, then provide an access token for the account whose workspace you want to edit:

```sh
python3 -m pip install -r tools/modulo_mcp/requirements.txt
export MODULO_BASE_URL=http://localhost:8080
export MODULO_API_TOKEN='<access token for your signed-in Modulo account>'
```

The repository's `.mcp.json` registers the server as `modulo`, and `.codex/config.toml` makes it available when you open Modulo as a trusted Codex project. An MCP client must inherit those variables when it launches the server. Alternatively, set `MODULO_API_TOKEN_FILE` to a file containing only the token. Tokens expire; replace the token when authentication fails. For a remote backend, use an HTTPS URL.

For a browser login that returns a refresh token, set `MODULO_API_TOKEN_FILE` and `MODULO_OIDC_REFRESH_TOKEN_FILE` to separate mode-0600 files containing the access and refresh tokens. On an API 401 the server refreshes the session through Modulo's Keycloak realm, rotates both files, and retries once. When the Keycloak session itself expires, sign in again and replace both files. Password grant is disabled for the frontend client; the MCP does not store account passwords.

To give the MCP its own long-lived session instead of borrowing a browser token, run `login.py` (authorization code + PKCE with `offline_access`). It writes `~/.config/modulo/mcp-access-token` and `mcp-refresh-token` (mode 0600); the refresh token keeps working as long as it is used at least once per offline idle period (Keycloak default: 30 days):

```sh
export MODULO_BASE_URL=https://modulo.example.org
python3 tools/modulo_mcp/login.py start               # open the printed URL and sign in
python3 tools/modulo_mcp/login.py finish '<landed URL>' # the /mcp-callback address the browser ended on
# or, with the desktop app running with --remote-debugging-port and signed in:
python3 tools/modulo_mcp/login.py cdp
```

Register it for every project with the token files, for example:

```sh
claude mcp add --scope user modulo-prod -e MODULO_BASE_URL=https://modulo.example.org \
  -e MODULO_API_TOKEN_FILE=$HOME/.config/modulo/mcp-access-token \
  -e MODULO_OIDC_REFRESH_TOKEN_FILE=$HOME/.config/modulo/mcp-refresh-token \
  -- python3 /path/to/Modulo/tools/modulo_mcp/server.py
```

Tools:

- `list_installed_plugins`: inspect saved installation settings. An account with only built-in defaults may have no installation record yet.
- `list_plugin_records` and `get_plugin_record`: inspect keys, values, schemas, and versions before writing.
- `register_plugin_schema`: register a new custom schema if the plugin does not already have one. Existing schema definitions are immutable.
- `create_plugin_record`: create a new key with `expectedVersion: 0`; it fails rather than replacing an existing record.
- `update_plugin_record` and `delete_plugin_record`: replace a record's whole value or delete it. Both require the `expected_version` you just read and fail with a conflict if the record changed since; update keeps the stored schema unless you pass another.
- `append_plugin_entry`: add an item to an array within an existing record. Supply a JSON Pointer such as `/data/records`; the tool keeps the record's schema and sends its current version, so concurrent edits fail with a conflict. You can pass `expected_version` after inspection to require that exact version.
- `create_note`: create a native note through Modulo's Notes API, with optional Markdown and tags.

For example, a workspace-tool plugin with a `records` key stores a `{ "version": 1, "data": ... }` envelope. Inspect that record first, then append to its actual data array. Entry fields vary by plugin and must match the plugin's own format. If the record does not exist yet, create the complete initial envelope with the plugin's schema before appending.

The generic record tools operate on **server-backed plugin state**. Some older Modulo plugins still store entries only in browser `localStorage`; those entries are not available from the backend and cannot be edited through this MCP. The tools do not install plugins or create side-effectful related resources such as attachments. Use the plugin's own workflow when an entry depends on those resources.
