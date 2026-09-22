# Audit Core Viewer

The Audit Core Viewer pack replaces frontend-owned audit workflow state with a read-only presentation layer for `audit-core` output JSONs.

## Plugins

- **Audit Core Browser** opens a local output directory and validates its JSON artifacts.
- **Phase Dashboard** renders `phase-ledger.json`, including run status, artifact coverage, properties, specialists, waivers, and compatibility warnings.
- **Scope & Architecture** presents scoping, fingerprinting, call-graph, inheritance, control-flow, and data-flow artifacts.
- **Threat Model & Invariants** presents attack trees, trust boundaries, hypotheses, flow specifications, review queues, risk clusters, and invariant categories.
- **Findings & Evidence** filters findings across automated triage, manual review, exploit validation, severity triage, and reporting.
- **Tests, Traces & Exploits** summarizes dynamic test results and exposes counterexamples, proofs, validated findings, and exploit sequences.
- **Severity & Report** renders final severity distribution, executive summary, coverage limitations, traceability, provenance, and report findings.
- **Remediation Comparison** discovers and displays every JSON artifact emitted in `p9_remediation`.

## Opening an output

Install the **Audit Core Viewer** pack, open the Audit workspace, choose **Core Browser**, and select a directory such as one of the `*-audit-output` folders under `/home/ik/audit-targets`.

Browser security prevents Modulo from silently reading an arbitrary absolute path, so the folder must be selected by the user. The selected output is kept only in memory; reloading the browser requires selecting it again.

## Data boundary

The source output is immutable. Modulo parses `*.json` files into an in-memory bundle and never writes into, patches, uploads, or treats its own stores as authoritative for audit facts. The schema adapter uses the pair `(phase-ledger.version, artifact path)` when possible and renders raw JSON as a fallback, allowing optional artifacts and additive fields to remain visible. Individual JSON files over 32 MiB are indexed but not decoded in the interactive view, preventing raw tool dumps and very large exploit-search artifacts from freezing the browser.

The legacy Findings Tracker, Audit Checklists, Vulnerability Knowledge Base, Audit Reports, and Engagement Pipeline remain independently available, but the Audit Core Viewer pack does not install or depend on them.
