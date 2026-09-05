# Open-issue implementation status

Objective: implement the open issues from the 2026-09-05 inventory and close each only after its acceptance criteria are verified. Preserve pre-existing workspace changes.

## Current delivery state

The working GitHub CLI credential has repository write access. The restricted environment token was overriding it; publishing now uses the CLI credential without exposing token values. Commits 4199432b and 1e25aedd have been published. Issues #388, #416, #418, #419, #420, #421 and #451 are closed after verification. State host and Canvas integration is published in d56ac6a8, workspace preferences in da81f541, and embedded databases in c1fdfd4e.

The state API, offline queue, authentication lifecycle, namespace-bound plugin context, Canvas, workspace preferences and embedded database migrations are published and tested. The PostgreSQL migration prerequisite is committed in 098b4d2c. Most epics remain incomplete; individual acceptance criteria below govern closure.

## Acceptance ledger

| Issue | Scope | Current status |
|---|---|---|
| [#388](https://github.com/Ikey168/Modulo/issues/388) | External plugins as Kubernetes workloads around the core (tracking) | Implemented in merged PR #407; closed. |
| [#401](https://github.com/Ikey168/Modulo/issues/401) | WASM sandbox W5: canary rollout, flip default, retire Rhino | Partial existing WASM implementation; release-cycle soak and subsequent retirement still required. |
| [#409](https://github.com/Ikey168/Modulo/issues/409) | EPIC: Trustworthy synchronized workspace state and tenant isolation | Open epic; child acceptance criteria remain incomplete. |
| [#410](https://github.com/Ikey168/Modulo/issues/410) | EPIC: Blueprint Execution Center and durable workflow controls | Open epic; child acceptance criteria remain incomplete. |
| [#411](https://github.com/Ikey168/Modulo/issues/411) | EPIC: Human approval, signed decisions, and evidence bundles for Blueprints | Open epic; child acceptance criteria remain incomplete. |
| [#412](https://github.com/Ikey168/Modulo/issues/412) | EPIC: Pack Studio and complete installable workspace experiences | Open epic; child acceptance criteria remain incomplete. |
| [#413](https://github.com/Ikey168/Modulo/issues/413) | EPIC: Marketplace Trust Center and safe plugin upgrades | Open epic; child acceptance criteria remain incomplete. |
| [#414](https://github.com/Ikey168/Modulo/issues/414) | EPIC: Structured note properties, query views, and private semantic knowledge | Open epic; child acceptance criteria remain incomplete. |
| [#415](https://github.com/Ikey168/Modulo/issues/415) | State P1: enforce authenticated ownership on notes, tags, links, attachments, and tasks | Merged in [PR #452](https://github.com/Ikey168/Modulo/pull/452); closed. Implemented: owner-scoped resource queries and caches, relationship guards, authenticated STOMP subscriptions/delivery, private attachments, authoritative audit actors, verified share grants and tested legacy backfill. See the [migration runbook](../operations/tenant-ownership-migration.md). |
| [#416](https://github.com/Ikey168/Modulo/issues/416) | State P2: ADR and contract for namespaced plugin state | ADR 0008 published; closed. |
| [#417](https://github.com/Ikey168/Modulo/issues/417) | State P3: implement versioned plugin-state persistence and REST API | Implemented locally: PostgreSQL CAS store and API, dual-token external owner grants, immutable schema registry, metadata-only private outbox and adversarial PostgreSQL/HTTP tests. Publication and full verification in progress. |
| [#418](https://github.com/Ikey168/Modulo/issues/418) | State P4: frontend plugin-state client with offline queue and conflict handling | Published client, plugin context, authentication lifecycle and remote discovery; 61 isolated-tree tests and typecheck pass. Closed. |
| [#419](https://github.com/Ikey168/Modulo/issues/419) | State P5: migrate plugin installs, hub preferences, and saved searches off localStorage | Account-scoped installs, hub tabs and saved searches implemented; migration, offline provider, dependency and account-switch tests pass in the isolated publishable tree (74 tests total). Published in da81f541; closed. |
| [#420](https://github.com/Ikey168/Modulo/issues/420) | State P6: migrate Canvas boards to synchronized plugin state | Published per-board synchronization, lossless create-only migration and recovery export; eight focused Canvas synchronization tests pass. Closed. |
| [#421](https://github.com/Ikey168/Modulo/issues/421) | State P7: migrate embedded Database records to synchronized plugin state | Published in c1fdfd4e: per-fence persistence, migration, view settings and retention policy. Full isolated frontend suite passes (479 tests); closed. |
| [#422](https://github.com/Ikey168/Modulo/issues/422) | State P8: migrate Todos, time tracking, and business plugin records to durable storage | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#423](https://github.com/Ikey168/Modulo/issues/423) | State P9: cross-client, offline, backup, and tenant-isolation acceptance suite | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#424](https://github.com/Ikey168/Modulo/issues/424) | Execution P1: structured workflow-run and node-step persistence model | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#425](https://github.com/Ikey168/Modulo/issues/425) | Execution P2: instrument Blueprint nodes with traces, timing, and redaction | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#426](https://github.com/Ikey168/Modulo/issues/426) | Execution P3: searchable Execution Center UI and real Dashboard activity | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#427](https://github.com/Ikey168/Modulo/issues/427) | Execution P4: safe retry, cancellation, idempotency, and duplicate-trigger controls | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#428](https://github.com/Ikey168/Modulo/issues/428) | Execution P5: durable schedules, waiting runs, resume, and dead-letter queue | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#429](https://github.com/Ikey168/Modulo/issues/429) | Execution P6: workflow alerts, metrics, retention controls, and load tests | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#430](https://github.com/Ikey168/Modulo/issues/430) | Approval P1: approval-state machine, authorization, expiry, and delegation contract | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#431](https://github.com/Ikey168/Modulo/issues/431) | Approval P2: implement request/wait/result Blueprint nodes and resume path | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#432](https://github.com/Ikey168/Modulo/issues/432) | Approval P3: reviewer inbox, decision detail, notifications, and audit trail UI | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#433](https://github.com/Ikey168/Modulo/issues/433) | Approval P4: cryptographically signed decisions and local verification | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#434](https://github.com/Ikey168/Modulo/issues/434) | Approval P5: portable evidence bundle export, verification tool, and optional anchoring | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#435](https://github.com/Ikey168/Modulo/issues/435) | Pack Studio P1: Pack Manifest vNext for complete workspace contributions | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#436](https://github.com/Ikey168/Modulo/issues/436) | Pack Studio P2: transactional install, upgrade, rollback, and uninstall engine | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#437](https://github.com/Ikey168/Modulo/issues/437) | Pack Studio P3: authoring, validation, preview, and publish workflow | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#438](https://github.com/Ikey168/Modulo/issues/438) | Pack Studio P4: flagship Security Audit Pack | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#439](https://github.com/Ikey168/Modulo/issues/439) | Pack Studio P5: guided onboarding, demo workspace, and end-to-end acceptance journey | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#440](https://github.com/Ikey168/Modulo/issues/440) | Trust Center P1: marketplace trust metadata and verification API | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#441](https://github.com/Ikey168/Modulo/issues/441) | Trust Center P2: verify image signatures, provenance, SBOM, and vulnerability results at submission and install | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#442](https://github.com/Ikey168/Modulo/issues/442) | Trust Center P3: version pinning, permission-diff consent, upgrade safety, and rollback | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#443](https://github.com/Ikey168/Modulo/issues/443) | Trust Center P4: publisher verification and accountable release ownership | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#444](https://github.com/Ikey168/Modulo/issues/444) | Trust Center P5: install review and plugin health UI | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#445](https://github.com/Ikey168/Modulo/issues/445) | Knowledge P1: typed note-properties model, schema, ownership, and API | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#446](https://github.com/Ikey168/Modulo/issues/446) | Knowledge P2: note property editor and Markdown frontmatter import/export | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#447](https://github.com/Ikey168/Modulo/issues/447) | Knowledge P3: saved property queries with table, list, card, and board views | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#448](https://github.com/Ikey168/Modulo/issues/448) | Knowledge P4: pluggable embedding service, pgvector schema, and resumable backfill | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#449](https://github.com/Ikey168/Modulo/issues/449) | Knowledge P5: semantic search and explainable suggested links | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#450](https://github.com/Ikey168/Modulo/issues/450) | Knowledge P6: cited Ask Modulo with provider privacy and prompt-injection controls | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#451](https://github.com/Ikey168/Modulo/issues/451) | Roadmap: reconcile feature-ideas document with shipped capabilities and new epics | Roadmap reconciliation published; closed. |

## Next implementation dependencies

1. #415 is merged and closed. Full Java 17 `mvn verify` passed: 699 backend tests, no failures/errors, three existing skips.
2. Finish #417 permissions/schema/event delivery and #422 operational-record migrations; run #423 before closing #409. Client and consumer migrations #418–421 are published.
3. Deliver #424–429, then #430–434, followed by the dependent Pack Studio, Trust Center and knowledge work in the [roadmap order](feature-ideas.md).
4. Keep #401 open until actual staging soak, release and Pi evidence satisfies its operational criteria.
5. Publish verified changes and close individual issues; update this ledger and roadmap with the acceptance evidence. Do not close epics based on foundational components alone.

## Published verification checkpoint

The exact publishable frontend tree passes `npm run typecheck` and all 479 tests in
53 Vitest files. Verification used an isolated archive of the Git index, so the
result does not depend on pre-existing uncommitted UI, pack or infrastructure work.
38 issues remain open; this checkpoint does not complete the overall inventory.

## Tenant isolation verification

The staged tenant-isolation tree passes frontend typechecking and 485 tests in
55 files, plus 133 backend tests in 20 suites. Backend verification includes real
PostgreSQL migrations and repository discovery, two-owner cache/relationship
checks, HTTP file isolation and real STOMP private-queue delivery. The operational
upgrade and explicit legacy backfill are documented in the tenant migration runbook.
