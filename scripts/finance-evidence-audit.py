#!/usr/bin/env python3
"""Read-only Paperless evidence review; no originals, titles or secrets exported."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime, timezone


def review(documents, expectations=None):
    """Expectations are explicit safe refs, never inferred from absent records."""
    queue = []

    def issue(kind, ids, ref=""):
        identity = json.dumps([kind, sorted(ids), ref], separators=(",", ":"))
        queue.append({"id": hashlib.sha256(identity.encode()).hexdigest()[:24],
                      "reason": kind, "paperlessIds": sorted(ids), "reference": ref,
                      "status": "needs-human-review"})

    by_id = {}
    hashes = {}
    for doc in documents:
        doc_id = doc["id"]
        if type(doc_id) is not int or doc_id < 1 or doc_id in by_id:
            raise ValueError("invalid or duplicate document ID")
        by_id[doc_id] = doc
        if not doc.get("readable"):
            issue("original-unreadable", [doc_id])
        elif not doc.get("storedHash"):
            issue("original-hash-missing", [doc_id])
        elif doc.get("actualHash") != doc["storedHash"]:
            issue("original-hash-mismatch", [doc_id])
        if doc.get("actualHash"):
            hashes.setdefault(doc["actualHash"], []).append(doc_id)
        if not doc.get("retentionPresent"):
            issue("retention-metadata-missing", [doc_id])
    for ids in hashes.values():
        if len(ids) > 1:
            issue("duplicate-original", ids)
    if expectations is None:
        issue("expected-evidence-inventory-not-configured", [])
    else:
        refs = set()
        for expected in expectations:
            ref = expected["reference"]
            if not isinstance(ref, str) or not ref or len(ref) > 128 or ref in refs:
                raise ValueError("expectation references must be unique safe identifiers")
            refs.add(ref)
            doc_id = expected.get("paperlessId")
            if doc_id is not None and (type(doc_id) is not int or doc_id < 1):
                raise ValueError("invalid expected document ID")
            doc = by_id.get(doc_id)
            if doc is None:
                issue("expected-document-missing", [] if doc_id is None else [doc_id], ref)
            elif expected.get("sha256") and expected["sha256"] != doc.get("actualHash"):
                issue("expected-document-mismatch", [doc_id], ref)
    return {"schemaVersion": 1, "checkedDocuments": len(documents),
            "expectationsConfigured": expectations is not None,
            "originalsModified": False, "queue": sorted(queue, key=lambda x: x["id"])}


# Executed inside the existing application container. Only safe metadata leaves it.
PROBE = '''
from documents.models import Document
import hashlib,json
rows=[]
for d in Document.objects.select_related("document_type").all():
    if not d.document_type or "finance" not in d.document_type.name.casefold():
        continue
    fields={x.field.name:x.value for x in d.custom_fields.select_related("field").all()}
    actual=""
    try:
        with d.source_path.open("rb") as f:
            h=hashlib.sha256()
            for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
        actual=h.hexdigest()
    except OSError:
        pass
    rows.append(dict(id=d.pk,readable=bool(actual),actualHash=actual,
        storedHash=fields.get("Original SHA-256") or "",
        retentionPresent=bool(fields.get("Retention Rule Version") and fields.get("Retention Until"))))
print("EVIDENCE_AUDIT="+json.dumps(rows))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default="paperless-webserver")
    parser.add_argument("--expectations", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    expectations = json.loads(args.expectations.read_text()) if args.expectations else None
    if expectations is not None and not isinstance(expectations, list):
        raise ValueError("expectations must be an array")
    result = subprocess.run(["docker", "exec", args.container, "python", "manage.py",
                             "shell", "-c", PROBE], capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError("Paperless metadata probe failed; existing queue left unchanged")
    lines = [line for line in result.stdout.splitlines() if line.startswith("EVIDENCE_AUDIT=")]
    if len(lines) != 1:
        raise RuntimeError("invalid probe response; existing queue left unchanged")
    report = review(json.loads(lines[0].split("=", 1)[1]), expectations)
    report["checkedAt"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".evidence-review-", dir=args.output.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(report, output, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(tmp, args.output)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    print(json.dumps({"checkedDocuments": report["checkedDocuments"],
                      "reviewItems": len(report["queue"]), "originalsModified": False}))


if __name__ == "__main__":
    main()
