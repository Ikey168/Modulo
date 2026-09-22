# Finance evidence review — 2026-09-21

Source: `scripts/finance-evidence-audit.py`; tests:
`python3 -m unittest -v scripts/test_finance_evidence_audit.py`.
The script and 11 tests execute on Desktop and Pi 5. The live runtime is
`/home/ik/scripts/records-intake` on Pi 5, reading its existing Paperless container.

The review never changes originals, stored hashes, document metadata or retention.
It writes an atomic mode-0600 queue at
`/home/ik/records-intake/state/finance-evidence-review.json`.
Stable queue identifiers allow comparisons between runs. It checks finance-classified
documents for unreadable original files, missing/mismatched original hashes,
identical originals and absent retention metadata. File readability is not a claim
that a PDF renders correctly or that OCR is accurate. The queue contains only safe
document IDs, issue categories and explicitly supplied safe references, not file
content, titles, hashes or credentials. Access remains limited to the Pi account;
no public service is introduced.

`finance-evidence-review.timer` runs daily, with a persistent catch-up. Inspect:

```sh
systemctl --user status finance-evidence-review.timer finance-evidence-review.service
cat /home/ik/records-intake/state/finance-evidence-review.json
```

An expected-document inventory is deliberately not fabricated. Without one the
queue includes `expected-evidence-inventory-not-configured`, never a green
completeness result. Supply a protected JSON array through `--expectations PATH`:

```json
[{"reference":"safe-statement-ref","paperlessId":123}]
```

An optional `sha256` expectation verifies the exact expected original. Configure
the service argument only after the owner supplies authoritative safe references.
The generic mechanism is tested; bank/broker/statement coverage is not accepted.
Failures leave the last queue unchanged, so check its `checkedAt` and service
status before using it. No external alert destination is assumed.

Live review found two stored-original-hash mismatches (Paperless IDs 2 and 3).
Do not overwrite hashes to make the check pass: first establish whether these are
fixture hashes, original/transformation differences, or changed original files.
Both documents have retention dates and rule versions, but no finance-domain link.

The existing offsite restore drill ran independently on Desktop: snapshot
`cd347821`, 4 snapshots/14 packs checked, 180 files restored, all 179 manifest
checksums verified, 3 documents imported, 6 access-control table row counts matched
(57 rows), no host ports, 63 seconds. Temporary restore containers and files were
removed by the drill. This confirms backup transport/runtime recovery, not that
the pre-existing stored-original hashes are correct or permissions are semantically
equivalent merely because row counts match.

No full repository acceptance run: this change is a standalone standard-library
Python operational tool, verified through unit tests on both tagged hosts and an
actual read-only Pi run. Frontend/backend and real-source financial acceptance
are not claimed.
