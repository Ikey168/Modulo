"""Contract checks against the HTTP shape used by Modulo plugin state."""
from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, unquote, urlsplit

from client import ModuloClient, ModuloError


class StateHandler(BaseHTTPRequestHandler):
    records = {}
    writes = []
    notes = []

    def log_message(self, *_args):
        pass

    def respond(self, status, value):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def route(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/auth/realms/modulo/protocol/openid-connect/token" and self.command == "POST":
            body = parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode())
            if body.get("refresh_token") == ["old-refresh"] and body.get("grant_type") == ["refresh_token"]:
                return self.respond(200, {"access_token": "new-token", "refresh_token": "new-refresh"})
            return self.respond(400, {"error": "invalid_grant"})
        if self.headers.get("Authorization") not in ("Bearer test-token", "Bearer new-token"):
            return self.respond(401, {"code": "UNAUTHORIZED"})
        if parsed.path == "/api/notes" and self.command == "POST":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.notes.append(body)
            return self.respond(201, {"id": len(self.notes), **body})
        prefix = "/api/workspaces/personal/plugin-state/"
        if not parsed.path.startswith(prefix):
            return self.respond(404, {"code": "NOT_FOUND"})
        parts = [unquote(part) for part in parsed.path[len(prefix):].split("/")]
        plugin = parts[0]
        if len(parts) == 1 and self.command == "GET":
            records = [copy.deepcopy(record) for (namespace, _key), record in self.records.items() if namespace == plugin]
            return self.respond(200, {"records": records, "nextCursor": None})
        key = parts[1]
        current = self.records.get((plugin, key))
        if self.command == "GET":
            return self.respond(200, copy.deepcopy(current)) if current else self.respond(404, {"code": "STATE_NOT_FOUND"})
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        self.writes.append((plugin, key, copy.deepcopy(body)))
        version = current["version"] if current else 0
        if body["expectedVersion"] != version:
            return self.respond(409, {"code": "STATE_VERSION_CONFLICT"})
        record = {"key": key, "schemaId": body["schemaId"], "schemaVersion": body["schemaVersion"],
                  "version": version + 1, "value": body["value"], "deleted": False}
        self.records[(plugin, key)] = copy.deepcopy(record)
        return self.respond(200, record)

    do_GET = route
    do_PUT = route
    do_POST = route


class ModuloClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), StateHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        StateHandler.records = {}
        StateHandler.writes = []
        StateHandler.notes = []
        self.client = ModuloClient(self.base_url, "test-token")

    def test_workspace_para_matches_ui_namespace(self):
        self.client.create_record("workspace-para", "data", "modulo.workspace.para", {"tasks": [{"title": "BROWSE-CAPTURE"}]})
        self.assertEqual(self.client.list_records("para-tasks")["records"], [])
        record = self.client.get_workspace_record("para")
        self.assertEqual(record["value"]["tasks"][0]["title"], "BROWSE-CAPTURE")
        self.assertEqual(self.client.list_workspace_records("para")["records"], [record])
        with self.assertRaises(ModuloError):
            self.client.get_workspace_record("../para")

    def test_create_refuses_overwrite_and_uses_owner_scoped_api(self):
        created = self.client.create_record("decision-journal", "records", "workspace-tool", {"version": 1, "data": {"records": []}})
        self.assertEqual(created["version"], 1)
        self.assertEqual(StateHandler.writes[0][2]["expectedVersion"], 0)
        with self.assertRaisesRegex(ModuloError, "STATE_VERSION_CONFLICT"):
            self.client.create_record("decision-journal", "records", "workspace-tool", {})

    def test_append_preserves_schema_and_detects_changes(self):
        self.client.create_record("decision-journal", "records", "workspace-tool", {"version": 1, "data": {"records": [{"id": "first"}]}})
        updated = self.client.append_entry("decision-journal", "records", "/data/records", {"id": "second"}, 1)
        self.assertEqual(updated["version"], 2)
        self.assertEqual(updated["schemaId"], "workspace-tool")
        self.assertEqual([item["id"] for item in updated["value"]["data"]["records"]], ["first", "second"])
        self.assertEqual(StateHandler.writes[-1][2]["expectedVersion"], 1)
        with self.assertRaisesRegex(ModuloError, "Record changed"):
            self.client.append_entry("decision-journal", "records", "/data/records", {"id": "third"}, 1)
        self.assertEqual(len(StateHandler.writes), 2)

    def test_missing_or_nonarray_path_never_writes(self):
        self.client.create_record("p", "records", "workspace-tool", {"data": {"records": []}})
        for pointer in ("/data/missing", "/data", "data/records"):
            with self.assertRaises(ModuloError):
                self.client.append_entry("p", "records", pointer, {"id": "x"})
        self.assertEqual(len(StateHandler.writes), 1)

    def test_update_para_task_status_changes_only_one_task(self):
        original = {"tasks": [
            {"id": "task-a", "title": "First", "status": "Next", "context": "keep"},
            {"id": "task-b", "title": "Second", "status": "Waiting"},
        ], "projects": [{"id": "project-a"}]}
        self.client.create_record("workspace-para", "data", "modulo.workspace.para", original)
        result = self.client.update_para_task_status("task-a", "Done", 1)
        self.assertEqual(result, {"taskId": "task-a", "title": "First", "previousStatus": "Next",
                                  "status": "Done", "recordVersion": 2, "changed": True})
        record = self.client.get_workspace_record("para")
        self.assertEqual(record["value"]["tasks"][0], {"id": "task-a", "title": "First", "status": "Done", "context": "keep"})
        self.assertEqual(record["value"]["tasks"][1], original["tasks"][1])
        self.assertEqual(record["value"]["projects"], original["projects"])
        self.assertEqual(StateHandler.writes[-1][2]["expectedVersion"], 1)

        unchanged = self.client.update_para_task_status("task-a", "Done", 2)
        self.assertFalse(unchanged["changed"])
        self.assertEqual(len(StateHandler.writes), 2)

    def test_update_para_task_status_rejects_stale_or_ambiguous_data(self):
        self.client.create_record("workspace-para", "data", "modulo.workspace.para",
                                  {"tasks": [{"id": "task-a", "title": "First", "status": "Next"}]})
        for task_id, status, version in (("task-a", "Done", 0), ("task-a", "Invalid", 1),
                                         ("missing", "Done", 1), ("", "Done", 1)):
            with self.assertRaises(ModuloError):
                self.client.update_para_task_status(task_id, status, version)
        self.assertEqual(len(StateHandler.writes), 1)

        StateHandler.records[("workspace-para", "data")]["value"]["tasks"].append(
            {"id": "task-a", "title": "Duplicate", "status": "Next"})
        with self.assertRaisesRegex(ModuloError, "exactly one"):
            self.client.update_para_task_status("task-a", "Done", 1)
        self.assertEqual(len(StateHandler.writes), 1)

    def test_update_para_task_status_uses_server_version_check(self):
        self.client.create_record("workspace-para", "data", "modulo.workspace.para",
                                  {"tasks": [{"id": "task-a", "title": "First", "status": "Next"}]})
        original_request = self.client._request

        def concurrent_request(path, method="GET", body=None):
            if method == "PUT" and body and body.get("expectedVersion") == 1:
                StateHandler.records[("workspace-para", "data")]["version"] = 2
            return original_request(path, method, body)

        with patch.object(self.client, "_request", side_effect=concurrent_request):
            with self.assertRaisesRegex(ModuloError, "STATE_VERSION_CONFLICT"):
                self.client.update_para_task_status("task-a", "Done", 1)
        self.assertEqual(StateHandler.records[("workspace-para", "data")]["value"]["tasks"][0]["status"], "Next")

    def test_rejects_insecure_remote_endpoint_and_invalid_namespace(self):
        with self.assertRaisesRegex(ModuloError, "HTTPS"):
            ModuloClient("http://example.com", "test-token")
        with self.assertRaisesRegex(ModuloError, "Invalid plugin ID"):
            self.client.list_records("../other")
        with self.assertRaisesRegex(ModuloError, "UNAUTHORIZED"):
            ModuloClient(self.base_url, "wrong-token").list_records("p")

    def test_create_note_uses_native_notes_api(self):
        created = self.client.create_note("  Research  ", "# Draft", ["work"])
        self.assertEqual(created["id"], 1)
        self.assertEqual(StateHandler.notes, [{"title": "Research", "content": "# Draft", "markdownContent": "# Draft", "tagNames": ["work"]}])

    def test_expired_token_refreshes_and_retries_once(self):
        with tempfile.TemporaryDirectory() as directory:
            access = Path(directory) / "access-token"
            refresh = Path(directory) / "refresh-token"
            access.write_text("old-token\n")
            refresh.write_text("old-refresh\n")
            with patch.dict(os.environ, {"MODULO_API_TOKEN": "", "MODULO_API_TOKEN_FILE": str(access),
                                      "MODULO_OIDC_REFRESH_TOKEN_FILE": str(refresh)}):
                result = ModuloClient(self.base_url).list_records("decision-journal")
            self.assertEqual(result["records"], [])
            self.assertEqual(access.read_text().strip(), "new-token")
            self.assertEqual(refresh.read_text().strip(), "new-refresh")
            self.assertEqual(access.stat().st_mode & 0o777, 0o600)
            self.assertEqual(refresh.stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
