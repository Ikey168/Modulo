"""Authenticated client for Modulo's owner-scoped plugin-state API."""
from __future__ import annotations

import fcntl
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class ModuloError(RuntimeError):
    """A request failed without exposing the access token."""


class _NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class ModuloClient:
    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = (base_url or os.environ.get("MODULO_BASE_URL", "http://localhost:8080")).rstrip("/")
        parsed = urlsplit(self.base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ModuloError("MODULO_BASE_URL must be an HTTP(S) origin without credentials or a path")
        if parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise ModuloError("Use HTTPS when MODULO_BASE_URL is not localhost")
        self.token = token
        self.opener = build_opener(_NoRedirects())

    def _token(self) -> str:
        token = self.token or os.environ.get("MODULO_API_TOKEN", "")
        token_file = os.environ.get("MODULO_API_TOKEN_FILE")
        if not token and token_file:
            token = Path(token_file).read_text(encoding="utf-8").strip()
        if not token or "\n" in token or "\r" in token:
            raise ModuloError("Set MODULO_API_TOKEN or MODULO_API_TOKEN_FILE to a valid access token")
        return token

    @staticmethod
    def _replace_secret(path: Path, value: str) -> None:
        if not value or "\n" in value or "\r" in value:
            raise ModuloError("The identity provider returned an invalid token")
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                             prefix=f".{path.name}.", delete=False) as file:
                temporary = Path(file.name)
                os.fchmod(file.fileno(), 0o600)
                file.write(value + "\n")
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, path)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def _refresh_token(self, attempted_token: str) -> bool:
        access_file = os.environ.get("MODULO_API_TOKEN_FILE")
        refresh_file = os.environ.get("MODULO_OIDC_REFRESH_TOKEN_FILE")
        if self.token or os.environ.get("MODULO_API_TOKEN") or not access_file or not refresh_file:
            return False
        access_path, refresh_path = Path(access_file), Path(refresh_file)
        if not access_path.is_file() or not refresh_path.is_file():
            return False
        lock_path = access_path.with_name(access_path.name + ".lock")
        with lock_path.open("a+") as lock:
            os.fchmod(lock.fileno(), 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            if access_path.read_text(encoding="utf-8").strip() != attempted_token:
                return True  # Another MCP process already refreshed it.
            refresh = refresh_path.read_text(encoding="utf-8").strip()
            if not refresh:
                return False
            body = urlencode({"grant_type": "refresh_token", "client_id": "modulo-frontend",
                              "refresh_token": refresh}).encode("ascii")
            request = Request(self.base_url + "/auth/realms/modulo/protocol/openid-connect/token",
                              data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
            try:
                with self.opener.open(request, timeout=15) as response:
                    renewed = json.load(response)
            except HTTPError as error:
                with error:
                    raise ModuloError(f"Modulo session refresh failed ({error.code}); sign in again") from None
            except (URLError, ValueError, UnicodeError):
                raise ModuloError("Modulo session refresh failed; sign in again") from None
            access = renewed.get("access_token") if isinstance(renewed, dict) else None
            next_refresh = renewed.get("refresh_token") if isinstance(renewed, dict) else None
            if not isinstance(access, str) or not isinstance(next_refresh, str):
                raise ModuloError("Modulo session refresh returned no tokens; sign in again")
            # Write the rotated refresh token first. An interrupted update can then
            # still renew the old access token on the next request.
            self._replace_secret(refresh_path, next_refresh)
            self._replace_secret(access_path, access)
            return True

    @staticmethod
    def _segment(value: str, name: str) -> str:
        if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}", value):
            raise ModuloError(f"Invalid {name}")
        return quote(value, safe="")

    def register_schema(self, plugin_id: str, schema_id: str, schema: dict[str, Any], schema_version: int = 1) -> None:
        if not isinstance(schema, dict) or not schema_id or len(schema_id) > 256 or schema_id.startswith("modulo.") or not isinstance(schema_version, int) or schema_version < 1:
            raise ModuloError("A valid custom schema ID, version, and object definition are required")
        path = ("/api/workspaces/personal/plugin-state-schemas/"
                f"{self._segment(plugin_id, 'plugin ID')}/{quote(schema_id, safe='')}/{schema_version}")
        self._request(path, "PUT", schema)

    def _request(self, path: str, method: str = "GET", body: Any = None) -> Any:
        data = None if body is None else json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        for attempt in range(2):
            token = self._token()
            headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
            if data is not None:
                headers["Content-Type"] = "application/json"
            request = Request(self.base_url + path, data=data, headers=headers, method=method)
            try:
                with self.opener.open(request, timeout=15) as response:
                    payload = response.read()
                    return json.loads(payload) if payload else None
            except HTTPError as error:
                with error:
                    try:
                        detail = json.loads(error.read())
                        code = detail.get("code") if isinstance(detail, dict) else None
                    except (ValueError, UnicodeError):
                        code = None
                if error.code == 401 and attempt == 0 and self._refresh_token(token):
                    continue
                raise ModuloError(f"Modulo API {error.code}: {code or error.reason}") from None
            except URLError as error:
                raise ModuloError(f"Modulo API unavailable: {error.reason}") from None
        raise ModuloError("Modulo API authentication failed after refresh")

    def _state_path(self, plugin_id: str, key: str | None = None) -> str:
        path = f"/api/workspaces/personal/plugin-state/{self._segment(plugin_id, 'plugin ID')}"
        return path if key is None else f"{path}/{self._segment(key, 'record key')}"

    def list_records(self, plugin_id: str, cursor: str | None = None, limit: int = 100) -> dict[str, Any]:
        if type(limit) is not int or not 1 <= limit <= 200:
            raise ModuloError("limit must be between 1 and 200")
        params = {"limit": limit}
        if cursor:
            params["cursor"] = self._segment(cursor, "cursor")
        return self._request(f"{self._state_path(plugin_id)}?{urlencode(params)}")

    def list_workspace_records(self, namespace: str, cursor: str | None = None, limit: int = 100) -> dict[str, Any]:
        """Read a shared app family, e.g. Life/PARA uses namespace para."""
        self._segment(namespace, "workspace namespace")
        return self.list_records("workspace-" + namespace, cursor, limit)

    def get_workspace_record(self, namespace: str, key: str = "data") -> dict[str, Any]:
        """Read the same workspace-prefixed namespace used by Modulo's UI."""
        self._segment(namespace, "workspace namespace")
        return self.get_record("workspace-" + namespace, key)

    def get_record(self, plugin_id: str, key: str) -> dict[str, Any]:
        return self._request(self._state_path(plugin_id, key))

    def create_record(self, plugin_id: str, key: str, schema_id: str, value: Any, schema_version: int = 1) -> dict[str, Any]:
        if not schema_id or len(schema_id) > 256 or type(schema_version) is not int or schema_version < 1:
            raise ModuloError("A valid schema ID and positive schema version are required")
        return self._request(self._state_path(plugin_id, key), "PUT", {
            "expectedVersion": 0, "schemaId": schema_id, "schemaVersion": schema_version, "value": value,
        })

    def append_entry(self, plugin_id: str, key: str, array_path: str, entry: Any, expected_version: int | None = None) -> dict[str, Any]:
        record = self.get_record(plugin_id, key)
        if expected_version is not None and record["version"] != expected_version:
            raise ModuloError(f"Record changed: expected version {expected_version}, current version {record['version']}")
        if array_path != "" and not array_path.startswith("/"):
            raise ModuloError("array_path must be a JSON Pointer, such as /data/records")
        value = record["value"]
        target = value
        for raw in array_path.split("/")[1:] if array_path else []:
            part = raw.replace("~1", "/").replace("~0", "~")
            if isinstance(target, dict) and part in target:
                target = target[part]
            elif isinstance(target, list) and part.isdigit() and int(part) < len(target):
                target = target[int(part)]
            else:
                raise ModuloError(f"Array path does not exist: {array_path}")
        if not isinstance(target, list):
            raise ModuloError(f"Array path is not a list: {array_path}")
        target.append(entry)
        return self._request(self._state_path(plugin_id, key), "PUT", {
            "expectedVersion": record["version"], "schemaId": record["schemaId"],
            "schemaVersion": record["schemaVersion"], "value": value,
        })

    def update_para_task_status(self, task_id: str, status: str, expected_version: int) -> dict[str, Any]:
        """Change one Life/PARA task with the version seen by the caller."""
        if not isinstance(task_id, str) or not task_id.strip() or len(task_id) > 256:
            raise ModuloError("A valid task ID is required")
        if status not in ("Next", "Waiting", "Done"):
            raise ModuloError("status must be Next, Waiting, or Done")
        if type(expected_version) is not int or expected_version < 1:
            raise ModuloError("expected_version must be a positive integer")

        record = self.get_workspace_record("para")
        if record.get("version") != expected_version:
            raise ModuloError(
                f"Record changed: expected version {expected_version}, current version {record.get('version')}"
            )
        if record.get("schemaId") != "modulo.workspace.para" or record.get("schemaVersion") != 1:
            raise ModuloError("Unexpected Life/PARA record schema")
        value = record.get("value")
        tasks = value.get("tasks") if isinstance(value, dict) else None
        if not isinstance(tasks, list):
            raise ModuloError("Life/PARA tasks are missing")
        matches = [task for task in tasks if isinstance(task, dict) and task.get("id") == task_id]
        if len(matches) != 1:
            raise ModuloError("Task ID must match exactly one Life/PARA task")
        task = matches[0]
        previous_status = task.get("status")
        if previous_status not in ("Next", "Waiting", "Done"):
            raise ModuloError("Task has an unsupported current status")
        if previous_status == status:
            return {"taskId": task_id, "title": task.get("title"), "previousStatus": previous_status,
                    "status": status, "recordVersion": expected_version, "changed": False}

        task["status"] = status
        updated = self._request(self._state_path("workspace-para", "data"), "PUT", {
            "expectedVersion": expected_version, "schemaId": record["schemaId"],
            "schemaVersion": record["schemaVersion"], "value": value,
        })
        return {"taskId": task_id, "title": task.get("title"), "previousStatus": previous_status,
                "status": status, "recordVersion": updated["version"], "changed": True}

    def installed_plugins(self) -> dict[str, Any]:
        try:
            record = self.get_record("workspace-settings", "installed")
        except ModuloError as error:
            if "Modulo API 404:" in str(error):
                return {"recorded": False, "plugins": [], "note": "No installation record exists; built-in defaults may still be active."}
            raise
        if record["schemaId"] != "modulo.workspace.installations" or not isinstance(record["value"], list):
            raise ModuloError("Unexpected plugin installation record")
        return {"recorded": True, "plugins": record["value"]}

    def create_note(self, title: str, content: str = "", tags: list[str] | None = None) -> dict[str, Any]:
        if not isinstance(title, str) or not title.strip() or not isinstance(content, str):
            raise ModuloError("A nonempty note title and text content are required")
        if tags is not None and (not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags)):
            raise ModuloError("tags must be a list of nonempty strings")
        result = self._request("/api/notes", "POST", {
            "title": title.strip(), "content": content, "markdownContent": content, "tagNames": tags or [],
        })
        if not isinstance(result, dict) or not isinstance(result.get("id"), int):
            raise ModuloError("Note creation was not confirmed by the backend")
        return result
