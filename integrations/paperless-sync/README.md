# Paperless metadata sync

`paperless-sync` runs on the Raspberry Pi and makes outbound HTTPS requests to
Modulo. Paperless remains private and canonical. The process sends only the
allowlisted metadata in `paperless.document`; it never sends files, OCR text,
thumbnails, credentials, or restricted-record identifying fields.

The read identity has global view permissions only. A separate optional
write-back identity may change document metadata but cannot delete documents or
administer Paperless. Deletion actions stop at `awaiting-paperless-deletion` and
must be completed by a human in Paperless.

Grant tokens expire hourly and rotate through the dual-token callback endpoint.
Workload credentials expire after at most 90 days and are rotated by an owner.
Revoking a workload also revokes its active grants.

The container root filesystem and long-lived credentials are read-only. Only
the agent state directory is writable; it contains the rotating one-hour grant
files and the last successful reconciliation cursor.

Run tests with:

```sh
python3 -m unittest -v test_paperless_sync.py
```
