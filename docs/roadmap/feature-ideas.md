# Feature ideas & roadmap

Last reviewed: **2026-09-05** · Owner: repository maintainers · Tracking: [#451](https://github.com/Ikey168/Modulo/issues/451)

This inventory separates existing code from verified delivery. “Implemented” means
there is a working implementation in the repository; it does not assert deployment.
“Partial” names a remaining delivery gap. “Planned” means the stated outcome has
not been demonstrated. “Superseded” points to its current tracking issue. Local,
uncommitted workspace additions are not counted as shipped GitHub capabilities.

## Current capabilities and remaining gaps

| Capability | Status and evidence | Remaining work / tracking |
|---|---|---|
| Planner and daily notes | Implemented UI and date helpers: [PlannerView](../../frontend/src/features/workspace/PlannerView.tsx), [planner](../../frontend/src/features/workspace/planner.ts). The original proposal to introduce a Planner is superseded. | Authenticated ownership and multi-client correctness still require [#415](https://github.com/Ikey168/Modulo/issues/415) and [#423](https://github.com/Ikey168/Modulo/issues/423). A dedicated atomic daily-note API is not established. |
| Canvas / spatial boards | Partial: [CanvasView](../../frontend/src/features/workspace/CanvasView.tsx) and [canvasStore](../../frontend/src/features/workspace/canvasStore.ts) provide boards, cards and connections. | Browser-local layouts need versioned server state, migration, offline conflict handling and two-client acceptance: [#420](https://github.com/Ikey168/Modulo/issues/420). |
| Embedded Database, Todos and time tracking | Partial: [Database](../../frontend/src/features/workspace/database.ts), [Todos](../../frontend/src/features/workspace/todos.ts), [time tracking](../../frontend/src/features/workspace/timeTracking.ts). | Durable synchronized records and migration: [#421](https://github.com/Ikey168/Modulo/issues/421), [#422](https://github.com/Ikey168/Modulo/issues/422). |
| Note and schedule Blueprint triggers | Partial: [interpreter](../../backend/src/main/java/com/modulo/blueprint/interpreter/BlueprintInterpreterService.java) registers note events and cron jobs. The proposal to introduce triggers is superseded. | In-process schedules lack durable leases, waiting-run resume and dead-letter handling: [#428](https://github.com/Ikey168/Modulo/issues/428). Request-to-event coverage and ownership remain part of [#415](https://github.com/Ikey168/Modulo/issues/415). |
| Execution history | Partial: [BlueprintExecution](../../backend/src/main/java/com/modulo/blueprint/BlueprintExecution.java) exposes log summaries and executed nodes. | Persist structured run/step traces, redaction, retry, cancellation, alerts and operational UI: [#410](https://github.com/Ikey168/Modulo/issues/410). |
| External plugins | Implemented in merged [PR #407](https://github.com/Ikey168/Modulo/pull/407); [ADR 0004](../architecture/adr-0004-external-plugin-tier.md). | [#388](https://github.com/Ikey168/Modulo/issues/388) records completion and deliberately deferred register-on-sync, durable broker delivery, signature enforcement and mTLS. Signature enforcement is tracked in [#441](https://github.com/Ikey168/Modulo/issues/441). |
| WASM sandbox | Partial: [WasmScriptSandbox](../../backend/src/main/java/com/modulo/blueprint/sandbox/WasmScriptSandbox.java) exists; [selection](../../backend/src/main/java/com/modulo/blueprint/sandbox/ScriptSandboxConfig.java) still defaults to Rhino. | Staging release-cycle evidence, default flip, escape-hatch release, subsequent Rhino retirement and Pi verification: [#401](https://github.com/Ikey168/Modulo/issues/401). |
| Installable packs | Partial: [PackManifest](../../backend/src/main/java/com/modulo/pack/PackManifest.java) contributes nodes and Blueprints; [PackService](../../backend/src/main/java/com/modulo/pack/PackService.java) handles existing packs. | Complete workspace contributions, transactional lifecycle, authoring and guided audit journey: [#412](https://github.com/Ikey168/Modulo/issues/412). |
| Marketplace trust | Partial: [submission validation](../../backend/src/main/java/com/modulo/plugin/submission/PluginValidationService.java) enforces the external-plugin submission foundation. | Digest-bound signature/SBOM/scan evidence, publisher verification and safe upgrades: [#413](https://github.com/Ikey168/Modulo/issues/413). |
| Human approvals and portable workflow evidence | Planned: existing provenance services do not establish a resumable approval state machine or signed decisions. | [#411](https://github.com/Ikey168/Modulo/issues/411). |
| Typed note properties and query views | Planned: metadata and embedded Database records do not establish a typed, indexed note-property API. | [#445](https://github.com/Ikey168/Modulo/issues/445)–[#447](https://github.com/Ikey168/Modulo/issues/447). |
| Embeddings and semantic search | Planned delivery: closed [#255](https://github.com/Ikey168/Modulo/issues/255) is a prior input, not acceptance evidence; no working embedding pipeline was located in the reviewed backend. | Provider controls, pgvector schema, resumable backfill and evaluated owner-scoped retrieval: [#448](https://github.com/Ikey168/Modulo/issues/448), [#449](https://github.com/Ikey168/Modulo/issues/449). |
| Ask your notes / RAG | Planned delivery: closed [#256](https://github.com/Ikey168/Modulo/issues/256) does not demonstrate cited retrieval. [OpenAIService](../../backend/src/main/java/com/modulo/service/OpenAIService.java) implements summaries, not this outcome. | Sentence-level citations, privacy controls, authorized retrieval and injection tests: [#450](https://github.com/Ikey168/Modulo/issues/450). |
| Suggested links and AI tags | Partial foundation: [UnlinkedMentionsService](../../backend/src/main/java/com/modulo/service/UnlinkedMentionsService.java) matches titles. Closed [#257](https://github.com/Ikey168/Modulo/issues/257) does not establish semantic link/tag suggestions. | Explainable accept/reject link suggestions: [#449](https://github.com/Ikey168/Modulo/issues/449). Content-derived tag suggestions remain a proposal grounded in [OpenAIService](../../backend/src/main/java/com/modulo/service/OpenAIService.java) and [TagService](../../backend/src/main/java/com/modulo/service/TagService.java), without demonstrated delivery. |
| Verifiable revision history | Partial foundation: [BlockchainService](../../backend/src/main/java/com/modulo/service/BlockchainService.java) and [IpfsService](../../backend/src/main/java/com/modulo/service/IpfsService.java) support provenance. | A per-revision hash chain, historical diff/restore and verification UI remain proposals; single-content anchoring is not revision history. |
| Public digital garden | Partial foundation: [ShareController](../../backend/src/main/java/com/modulo/sharing/ShareController.java) supports sharing. | Publishing selected notes as an indexed content-addressed site remains a proposal; single-note sharing does not establish a garden. |

## Recommended delivery order

1. [#409 — synchronized state and tenant isolation](https://github.com/Ikey168/Modulo/issues/409): establish principal ownership (#415), state contract (#416), REST persistence (#417), offline client (#418), migrations (#419–422), then acceptance (#423).
2. [#410 — Execution Center](https://github.com/Ikey168/Modulo/issues/410): durable run/step model before instrumentation, UI, controls, scheduling and observability (#424–429).
3. [#411 — approvals and evidence](https://github.com/Ikey168/Modulo/issues/411): state machine, resumable nodes, reviewer UI, signatures, portable verifier (#430–434).
4. [#412 — Pack Studio](https://github.com/Ikey168/Modulo/issues/412): contract and recoverable install before authoring and the flagship audit/onboarding journey (#435–439). The audit journey also depends on #434.
5. [#413 — Trust Center](https://github.com/Ikey168/Modulo/issues/413): evidence model before verification, upgrade consent and publisher/health UI (#440–444). Upgrade work depends on pack lifecycle; health UI depends on execution visibility.
6. [#414 — structured knowledge](https://github.com/Ikey168/Modulo/issues/414): properties and frontmatter/query views (#445–447), then embeddings, retrieval and cited answers (#448–450). Property and embedding foundations can proceed after #415; query views also need #421.

This is a dependency order, not a dated delivery promise. Previous undated effort
estimates have been removed. WASM rollout (#401) must retain its operational soak
gate; code changes alone cannot establish a release cycle without regressions.

## Maintenance convention

The maintainer closing a child or tracking issue owns its roadmap update. In the
same delivery change, update the affected row, name any remaining gap, link the
implementation and acceptance evidence, and advance the review date. Close an
epic only when every child is verified complete or explicitly removed with a
recorded rationale. A closed historical issue alone is never evidence that a
feature works end to end. Preserve superseded proposals as links to their current
tracking issue instead of describing existing features as absent.
