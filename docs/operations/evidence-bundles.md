# Portable workflow evidence bundles

Owners export a terminal run from Execution Center's **Export evidence bundle**
section or `GET /api/workflow-runs/{id}/evidence-bundle`. Reviewers do not gain run
export access merely by reviewing a request. Export reads one repeatable database
snapshot. Active runs return a conflict rather than a misleading final package.

The deterministic ZIP contains:

- `manifest.json`: format version, run and Blueprint binding, omission markers,
  sorted artifact inventory, SHA-256 hashes, byte lengths, and an ordered hash chain.
- `run.json` and `blueprint.json`: retained run metadata and Blueprint version/digest.
- `steps/`: retained execution status, timings, and safe trace summaries.
- `references.json`: referenced artifact identities with content omission markers.
- `approvals/`, `decisions/`, and `signatures/`: retained approval evidence and
  independently verifiable signed decision envelopes when configured.

Raw inputs, note contents, private checkpoints, and full Blueprint configuration
are deliberately excluded. These exclusions are part of the hashed manifest.
Optional `omitSummaries`, `omitComments`, and `omitSignatures` query parameters
allow further omission. Omitting comments also omits signature envelopes because
the signed statement contains the comment. Omitted signature inventory entries
retain hashes and explicit `OMITTED` status, never their bytes.

Unchanged retained evidence with the same options produces the same logical root
and ZIP bytes. Archive order, timestamps, and compression level are fixed. The
manifest is a compact UTF-8 JSON array:

```text
["modulo.workflow.bundle.v1", runId, blueprintDigest, redactions, entries, finalChain]
entry = [path, sha256, byteLengthString, PRESENT_or_OMITTED, previousChain, chain]
chain = SHA256(compact_JSON(entry_without_chain))
root = SHA256(compact_JSON(manifest))
```

The first previous-chain value is 64 zeroes. Paths and inventory fields are ASCII;
artifact payloads are hashed as opaque bytes. Output is bounded to 56 MiB of
artifact data and the persisted run's bounded step count. Expired evidence cannot
be reconstructed by export; export required records before retention removes them.

## Verify independently

```sh
python3 scripts/verify-evidence-bundle.py workflow.zip EXPECTED_ROOT TRUSTED_SIGNING_KEY
```

Python's standard ZIP/hash libraries validate archive paths, duplicate entries,
size limits, all artifact hashes, the chain, and cross-artifact run bindings.
Node's standard cryptographic library verifies signed approvals and their
bindings to exported decision records. No service or blockchain connection is
needed. The root and signing fingerprint arguments are optional; without an
independently trusted root, output says `UNAUTHENTICATED_ROOT`. Self-contained
hashes alone cannot prove who created a package. Signing-key trust is reported
separately for each decision.

Results distinguish `VALID`, `INCOMPLETE_REDACTED`, `TAMPERED`, `UNSUPPORTED`, and
`UNVERIFIABLE`. Normal Modulo exports report `INCOMPLETE_REDACTED` with
`integrity: VALID` because private source material is explicitly omitted. This
means the included bytes verify, not that the omitted material was independently
reviewed. An unchanged package without omission markers can report `VALID`.

Anchoring is optional and is not performed by this exporter. The UI says **not
anchored**, and the verifier always reports `NOT_VERIFIED` for anchoring. No
placeholder transaction hash is generated.

The PostgreSQL reference test executes the sample approval workflow, signs a
review, resumes after the wait, exports twice, compares complete ZIP bytes, and
runs the standalone verifier. It also checks owner isolation and that comment
omission removes containing signatures. `python3 scripts/test-evidence-bundle.py`
covers valid, redacted, tampered, unsupported, and mismatched-root packages.
