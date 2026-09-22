#!/usr/bin/env python3
"""Outbound-only Paperless-ngx metadata synchronizer for Modulo plugin state."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import pathlib
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DOCUMENT_SCHEMA = "paperless.document"
HEALTH_SCHEMA = "paperless.health"
ACTION_SCHEMA = "paperless.action"
SCHEMA_VERSION = 1
RESTRICTED_FORBIDDEN = {
    "title", "correspondent", "tags", "tagIds", "storagePath", "checksum",
    "originalFilename", "business", "documentDate", "year",
}


class SyncError(RuntimeError):
    pass


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def text(value: Any, limit: int = 512) -> str:
    return str(value or "").strip()[:limit]


def atomic_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     prefix=f".{path.name}.", delete=False) as handle:
        os.chmod(handle.fileno(), 0o600)
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
        temporary = pathlib.Path(handle.name)
    os.replace(temporary, path)


class Http:
    def __init__(self, base: str, headers: dict[str, str] | None = None, timeout: int = 20,
                 min_interval: float = 0.0):
        parsed = urllib.parse.urlsplit(base)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise SyncError("invalid service URL")
        self.base = base.rstrip("/")
        self.headers = headers or {}
        self.timeout = timeout
        self.min_interval = max(0.0, min_interval)
        self.last_request = 0.0
        self.context = ssl.create_default_context()

    def request(self, path: str, method: str = "GET", body: Any = None,
                headers: dict[str, str] | None = None) -> tuple[int, Any]:
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        merged = {"Accept": "application/json", **self.headers, **(headers or {})}
        if data is not None:
            merged["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base + path, data=data, headers=merged, method=method)
        for attempt in range(4):
            delay = self.min_interval - (time.monotonic() - self.last_request)
            if delay > 0:
                time.sleep(delay)
            self.last_request = time.monotonic()
            try:
                with urllib.request.urlopen(request, timeout=self.timeout, context=self.context) as response:
                    payload = response.read(2_000_000)
                    return response.status, json.loads(payload) if payload else None
            except urllib.error.HTTPError as error:
                payload = error.read(64_000)
                try:
                    detail = json.loads(payload) if payload else None
                except (ValueError, UnicodeError):
                    detail = None
                if error.code == 404:
                    return 404, detail
                if error.code == 429 and attempt < 3:
                    retry_after = error.headers.get("Retry-After", "1") if error.headers else "1"
                    try:
                        retry_seconds = min(60.0, max(1.0, float(retry_after)))
                    except (TypeError, ValueError):
                        retry_seconds = 1.0
                    time.sleep(retry_seconds)
                    continue
                code = detail.get("code") if isinstance(detail, dict) else None
                raise SyncError(f"HTTP {error.code}: {code or error.reason}") from None
            except (urllib.error.URLError, TimeoutError, ValueError) as error:
                raise SyncError(f"service unavailable: {getattr(error, 'reason', error)}") from None
        raise SyncError("request retry budget exhausted")


class Paperless:
    def __init__(self, base: str, token: str, write_token: str | None = None):
        self.api = Http(base, {"Authorization": f"Token {token}"})
        self.writer = Http(base, {"Authorization": f"Token {write_token}"}) if write_token else None

    def pages(self, endpoint: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode(params or {})
        path = f"/api/{endpoint}/" + (f"?{query}" if query else "")
        records: list[dict[str, Any]] = []
        while path:
            _, payload = self.api.request(path)
            if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
                raise SyncError("invalid Paperless response")
            records.extend(item for item in payload["results"] if isinstance(item, dict))
            next_url = payload.get("next")
            if not next_url:
                break
            parsed = urllib.parse.urlsplit(str(next_url))
            path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        return records

    def lookups(self) -> dict[str, dict[int, str]]:
        result: dict[str, dict[int, str]] = {}
        for endpoint in ("correspondents", "document_types", "tags", "storage_paths", "custom_fields"):
            result[endpoint] = {
                int(item["id"]): text(item.get("name"), 256)
                for item in self.pages(endpoint, {"page_size": "100"})
                if isinstance(item.get("id"), int)
            }
        return result

    def documents(self, modified_after: str | None = None) -> list[dict[str, Any]]:
        # Paperless includes truncated OCR content in list responses. Keep each
        # response bounded when a private record contains a large reversible
        # transport envelope; content is discarded by normalize_document.
        params = {"page_size": "25", "ordering": "id"}
        if modified_after:
            params["modified__gt"] = modified_after
        return self.pages("documents", params)

    def document(self, document_id: int) -> dict[str, Any]:
        _, payload = self.api.request(f"/api/documents/{document_id}/")
        if not isinstance(payload, dict):
            raise SyncError("invalid Paperless document response")
        return payload

    def patch_document(self, document_id: int, payload: dict[str, Any]) -> None:
        if not self.writer:
            raise SyncError("write-back token is not configured")
        self.writer.request(f"/api/documents/{document_id}/", "PATCH", payload)


_UNKNOWN = object()


class ModuloState:
    def __init__(self, base: str, namespace: str, workload_token: str,
                 grant_file: pathlib.Path, http: Http | None = None):
        self.namespace = namespace
        self.workload_token = workload_token
        self.grant_file = grant_file
        self.grant = json.loads(grant_file.read_text(encoding="utf-8"))
        self.http = http or Http(base)

    def headers(self) -> dict[str, str]:
        return {"X-Modulo-Plugin-Token": self.workload_token,
                "X-Modulo-State-Grant": self.grant["token"]}

    def path(self, suffix: str = "") -> str:
        root = f"/api/plugin-state/callback/workspaces/personal/{self.namespace}"
        return root + (f"/{suffix}" if suffix else "")

    def get(self, key: str) -> dict[str, Any] | None:
        status, value = self.http.request(self.path(key), headers=self.headers())
        return None if status == 404 else value

    def list(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            query = urllib.parse.urlencode({"limit": 200, **({"cursor": cursor} if cursor else {})})
            _, page = self.http.request(self.path() + "?" + query, headers=self.headers())
            records.extend(page.get("records", []))
            cursor = page.get("nextCursor")
            if not cursor:
                return records

    def put(self, key: str, value: dict[str, Any], schema: str,
            current: dict[str, Any] | None | object = _UNKNOWN) -> dict[str, Any]:
        for attempt in range(2):
            if current is _UNKNOWN:
                current = self.get(key)
            version = int(current.get("version", 0)) if isinstance(current, dict) else 0
            try:
                _, saved = self.http.request(self.path(key), "PUT", {
                    "expectedVersion": version, "schemaId": schema,
                    "schemaVersion": SCHEMA_VERSION, "value": value,
                }, self.headers())
                return saved
            except SyncError as error:
                if attempt == 0 and "STATE_VERSION_CONFLICT" in str(error):
                    current = self.get(key)
                    continue
                raise
        raise SyncError("unresolved Modulo version conflict")

    def renew_if_needed(self) -> None:
        expires = parse_time(self.grant.get("expiresAt"))
        if expires and expires - dt.datetime.now(dt.timezone.utc) > dt.timedelta(minutes=15):
            return
        _, issued = self.http.request("/api/plugin-state/callback/grants/rotate", "POST",
            {"lifetimeSeconds": 3600}, self.headers())
        self.grant = {"token": issued["token"], "expiresAt": issued["grant"]["expiresAt"],
                      "id": issued["grant"]["id"]}
        atomic_json(self.grant_file, self.grant)


def relation_id(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, dict) and isinstance(value.get("id"), int):
        return value["id"]
    return None


def relation_ids(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for candidate in value if (item := relation_id(candidate)) is not None]


def custom_values(document: dict[str, Any], lookups: dict[str, dict[int, str]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for item in document.get("custom_fields") or []:
        if not isinstance(item, dict):
            continue
        field_id = relation_id(item.get("field"))
        if field_id is not None:
            result[lookups.get("custom_fields", {}).get(field_id, str(field_id))] = item.get("value")
    return result


def merged_custom_fields(document: dict[str, Any], field_id: int, value: Any) -> list[dict[str, Any]]:
    """Replace one field without dropping unrelated Paperless metadata."""
    fields = [item for item in (document.get("custom_fields") or [])
              if isinstance(item, dict) and relation_id(item.get("field")) != field_id]
    fields.append({"field": field_id, "value": value})
    return fields


def end_of_year(date_value: str, years: int) -> str | None:
    try:
        year = dt.date.fromisoformat(date_value[:10]).year + years
        return f"{year}-12-31"
    except (ValueError, TypeError):
        return None


def computed_retention(document_date: str, retention_class: str) -> str | None:
    key = retention_class.casefold().replace("_", "-")
    years = next((value for label, value in {
        "gobd-10": 10, "10-year": 10, "hgb-8": 8, "8-year": 8,
        "general-6": 6, "6-year": 6,
    }.items() if label in key), None)
    return end_of_year(document_date, years) if years else None


def normalize_document(document: dict[str, Any], lookups: dict[str, dict[int, str]],
                       preserved: dict[str, Any] | None = None) -> dict[str, Any]:
    paperless_id = int(document["id"])
    custom = custom_values(document, lookups)
    document_type = lookups.get("document_types", {}).get(relation_id(document.get("document_type")) or -1, "Unclassified")
    tag_ids = relation_ids(document.get("tags"))
    tag_names = [lookups.get("tags", {}).get(tag, f"tag-{tag}") for tag in tag_ids]
    sensitivity_value = text(custom.get("Sensitivity") or "normal", 32).casefold().replace("_", "-")
    sensitivity = next((label for label in ("normal", "confidential", "restricted")
                        if sensitivity_value == label or sensitivity_value.endswith(f"-{label}")),
                       "confidential")
    restricted = sensitivity == "restricted"
    document_date = text(document.get("created"), 32)
    retention_class = text(custom.get("Retention Class"), 128)
    retention_until = text(custom.get("Retention Until"), 32) or computed_retention(document_date, retention_class)
    lifecycle = text(custom.get("Lifecycle Status") or "filed", 64).casefold()
    base: dict[str, Any] = {
        "paperlessId": paperless_id,
        "classification": document_type,
        "sensitivity": sensitivity,
        "restrictedStub": restricted,
        "status": lifecycle,
        "deleted": False,
        "retentionClass": retention_class,
        "retentionUntil": retention_until or "",
        "retentionReason": text(custom.get("Retention Reason"), 512),
        "expiryDate": text(custom.get("Expiry Date"), 32),
        "sourceVersion": text(document.get("modified") or document.get("added"), 64),
        "paraLinks": (preserved or {}).get("paraLinks", {"projects": [], "areas": [], "tasks": []}),
        "review": (preserved or {}).get("review", {"status": "none", "updatedAt": ""}),
    }
    if restricted:
        return base
    correspondent_id = relation_id(document.get("correspondent"))
    storage_id = relation_id(document.get("storage_path"))
    year = int(document_date[:4]) if len(document_date) >= 4 and document_date[:4].isdigit() else 0
    base.update({
        "title": text(document.get("title"), 512),
        "correspondent": lookups.get("correspondents", {}).get(correspondent_id or -1, ""),
        "tags": tag_names,
        "tagIds": tag_ids,
        "documentDate": document_date,
        "year": year,
        "checksum": text(custom.get("Original SHA-256"), 128),
        "storagePath": lookups.get("storage_paths", {}).get(storage_id or -1, ""),
        "business": {
            "invoiceDirection": text(custom.get("Invoice Direction"), 32),
            "eInvoiceStatus": text(custom.get("E-Rechnung Status"), 64),
            "evidenceType": text(custom.get("Compliance Evidence Type"), 128),
        },
    })
    return base


def assert_privacy(record: dict[str, Any]) -> None:
    if record.get("restrictedStub"):
        leaked = sorted(RESTRICTED_FORBIDDEN.intersection(record))
        if leaked:
            raise SyncError("restricted-record privacy filter failed")
    encoded = json.dumps(record, ensure_ascii=False).casefold()
    for forbidden in ("content", "ocr", "thumbnail", "api_token", "authorization"):
        if f'"{forbidden}"' in encoded:
            raise SyncError("prohibited document field in outbound payload")


class Agent:
    def __init__(self) -> None:
        secret_dir = pathlib.Path(os.environ.get("PAPERLESS_SYNC_SECRET_DIR", "/run/secrets/paperless-sync"))
        state_dir = pathlib.Path(os.environ.get("PAPERLESS_SYNC_STATE_DIR", "/var/lib/paperless-sync"))
        self.state_path = state_dir / "state.json"
        self.state = json.loads(self.state_path.read_text(encoding="utf-8")) if self.state_path.is_file() else {}
        def secret(name: str) -> str:
            value = (secret_dir / name).read_text(encoding="utf-8").strip()
            if not value:
                raise SyncError(f"empty secret: {name}")
            return value
        modulo = os.environ["MODULO_BASE_URL"].rstrip("/")
        self.paperless = Paperless(os.environ.get("PAPERLESS_BASE_URL", "http://127.0.0.1:8000"),
                                   secret("paperless-read-token"),
                                   secret("paperless-write-token") if (secret_dir / "paperless-write-token").is_file() else None)
        modulo_http = Http(modulo, min_interval=float(
            os.environ.get("PAPERLESS_MODULO_REQUEST_INTERVAL_SECONDS", "0.65")))
        self.records = ModuloState(modulo, "paperless", secret("paperless-workload-token"),
                                   pathlib.Path(os.environ.get("PAPERLESS_GRANT_FILE", state_dir / "paperless-grant.json")),
                                   http=modulo_http)
        self.actions = ModuloState(modulo, "paperless-actions", secret("paperless-actions-workload-token"),
                                   pathlib.Path(os.environ.get("PAPERLESS_ACTIONS_GRANT_FILE", state_dir / "paperless-actions-grant.json")),
                                   http=modulo_http)
        expiry_file = secret_dir / "modulo-workload-expiry"
        self.workload_expiry = os.environ.get("PAPERLESS_WORKLOAD_EXPIRES_AT", "") or (
            expiry_file.read_text(encoding="utf-8").strip() if expiry_file.is_file() else "")
        self.full_interval = int(os.environ.get("PAPERLESS_FULL_RECONCILE_SECONDS", "21600"))

    def sync(self, force_full: bool = False) -> dict[str, Any]:
        started = utcnow()
        self.records.renew_if_needed()
        self.actions.renew_if_needed()
        lookups = self.paperless.lookups()
        last_full = parse_time(self.state.get("lastFull"))
        full = force_full or last_full is None or (dt.datetime.now(dt.timezone.utc) - last_full).total_seconds() >= self.full_interval
        documents = self.paperless.documents(None if full else self.state.get("lastSuccess"))
        current_records = {
            str(record["key"]): record
            for record in self.records.list()
            if isinstance(record, dict) and record.get("key")
        } if full else {}
        changed = 0
        restricted = 0
        seen: set[int] = set()
        for document in documents:
            document_id = int(document["id"])
            seen.add(document_id)
            current = (
                current_records.get(f"document-{document_id}")
                if full
                else self.records.get(f"document-{document_id}")
            )
            existing = current.get("value") if isinstance(current, dict) and isinstance(current.get("value"), dict) else None
            normalized = normalize_document(document, lookups, existing)
            assert_privacy(normalized)
            self.records.put(f"document-{document_id}", normalized, DOCUMENT_SCHEMA, current=current)
            changed += 1
            restricted += int(normalized["restrictedStub"])
        tombstones = 0
        if full:
            live_ids = {int(document["id"]) for document in documents}
            for record in current_records.values():
                if not str(record.get("key", "")).startswith("document-") or record.get("deleted"):
                    continue
                value = record.get("value")
                if not isinstance(value, dict) or int(value.get("paperlessId", -1)) in live_ids:
                    continue
                value = {**value, "deleted": True, "status": "missing", "sourceVersion": started}
                if value.get("restrictedStub"):
                    value = {key: item for key, item in value.items() if key not in RESTRICTED_FORBIDDEN}
                assert_privacy(value)
                self.records.put(record["key"], value, DOCUMENT_SCHEMA, current=record)
                tombstones += 1
        action_counts = self.process_actions(lookups)
        success = utcnow()
        self.state.update({"lastSuccess": success, "lastIncremental": success,
                           "lastFull": success if full else self.state.get("lastFull", ""),
                           "failures": 0})
        atomic_json(self.state_path, self.state)
        health = {
            "lastSuccess": success, "lastIncremental": success,
            "lastFull": self.state.get("lastFull", ""), "documentCount": len(documents) if full else -1,
            "changedCount": changed, "restrictedCount": restricted, "tombstoneCount": tombstones,
            "queueDepth": action_counts["queued"], "failedActions": action_counts["failed"],
            "failures": 0, "schemaVersion": SCHEMA_VERSION,
            "grantExpiresAt": self.records.grant.get("expiresAt", ""),
            "workloadExpiresAt": self.workload_expiry,
            "paperlessReachable": True, "mode": "full" if full else "incremental",
        }
        health_current = current_records.get("sync-health") if full else self.records.get("sync-health")
        self.records.put("sync-health", health, HEALTH_SCHEMA, current=health_current)
        return health

    def process_actions(self, lookups: dict[str, dict[int, str]]) -> dict[str, int]:
        queued = failed = 0
        for record in self.actions.list():
            if not str(record.get("key", "")).startswith("action-") or record.get("deleted"):
                continue
            action = record.get("value")
            if not isinstance(action, dict) or action.get("status") not in {"approved", "queued"}:
                continue
            queued += 1
            try:
                kind = action.get("kind")
                document_id = int(action["paperlessId"])
                payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
                if kind == "deletion.propose":
                    action["status"] = "awaiting-paperless-deletion"
                    action["result"] = "Proposal recorded; deletion remains a manual Paperless action."
                elif kind == "tag.add":
                    tag_id = int(payload["tagId"])
                    if tag_id not in lookups.get("tags", {}):
                        raise SyncError("unknown tag")
                    current = self.paperless.document(document_id)
                    tags = sorted(set(relation_ids(current.get("tags"))) | {tag_id})
                    self.paperless.patch_document(document_id, {"tags": tags})
                    action["status"] = "applied"
                    action["result"] = "Existing tag applied."
                elif kind in {"custom-field.set", "legal-hold.set"}:
                    field_id = int(payload["fieldId"])
                    if field_id not in lookups.get("custom_fields", {}):
                        raise SyncError("unknown custom field")
                    current = self.paperless.document(document_id)
                    self.paperless.patch_document(document_id, {
                        "custom_fields": merged_custom_fields(current, field_id, payload.get("value"))
                    })
                    action["status"] = "applied"
                    action["result"] = "Approved custom field update applied."
                else:
                    raise SyncError("unsupported action")
                action["processedAt"] = utcnow()
            except Exception:
                action["status"] = "failed"
                action["result"] = "Action failed; inspect the Pi-side service journal."
                action["processedAt"] = utcnow()
                failed += 1
            self.actions.put(record["key"], action, ACTION_SCHEMA, current=record)
        return {"queued": queued, "failed": failed}

    def record_failure(self) -> None:
        """Persist operational failure metadata without serializing the exception."""
        failures = int(self.state.get("failures", 0)) + 1
        self.state["failures"] = failures
        self.state["lastFailure"] = utcnow()
        atomic_json(self.state_path, self.state)
        try:
            self.records.renew_if_needed()
            self.records.put("sync-health", {
                "lastSuccess": self.state.get("lastSuccess", ""),
                "lastIncremental": self.state.get("lastIncremental", ""),
                "lastFull": self.state.get("lastFull", ""),
                "lastFailure": self.state["lastFailure"],
                "documentCount": -1,
                "changedCount": 0,
                "restrictedCount": 0,
                "tombstoneCount": 0,
                "queueDepth": -1,
                "failedActions": -1,
                "failures": failures,
                "schemaVersion": SCHEMA_VERSION,
                "grantExpiresAt": self.records.grant.get("expiresAt", ""),
                "workloadExpiresAt": self.workload_expiry,
                "paperlessReachable": False,
                "mode": "failed",
            }, HEALTH_SCHEMA)
        except Exception:
            pass


def main() -> int:
    once = "--once" in sys.argv
    force_full = "--full" in sys.argv
    interval = int(os.environ.get("PAPERLESS_SYNC_INTERVAL_SECONDS", "300"))
    while True:
        agent: Agent | None = None
        try:
            agent = Agent()
            health = agent.sync(force_full)
            print(json.dumps({"status": "ok", "mode": health["mode"],
                              "changed": health["changedCount"],
                              "tombstones": health["tombstoneCount"]}, separators=(",", ":")), flush=True)
        except Exception as error:
            if agent is not None:
                agent.record_failure()
            # Never print document fields, tokens, URLs, or response bodies.
            print(json.dumps({"status": "failed", "error": type(error).__name__},
                             separators=(",", ":")), file=sys.stderr, flush=True)
            if once:
                return 1
        if once:
            return 0
        time.sleep(max(60, interval))


if __name__ == "__main__":
    raise SystemExit(main())
