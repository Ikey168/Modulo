# Open-issue implementation status

Objective: implement the open issues from the 2026-09-05 inventory and close each only after its acceptance criteria are verified. Preserve pre-existing workspace changes.

## Current delivery state

The working GitHub CLI credential has repository write access. The restricted environment token was overriding it; publishing now uses the CLI credential without exposing token values. Commits 4199432b and 1e25aedd have been published. Issues #388, #416 and #451 are closed after verification.

The state API, offline queue, authentication lifecycle, namespace-bound plugin context and Canvas migration are being integrated and tested. The PostgreSQL migration prerequisite is committed in 098b4d2c. Most epics remain incomplete; individual acceptance criteria below govern closure.

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
| [#415](https://github.com/Ikey168/Modulo/issues/415) | State P1: enforce authenticated ownership on notes, tags, links, attachments, and tasks | Partial local foundation: canonical principal resolver; existing resource and WebSocket paths still need enforcement. |
| [#416](https://github.com/Ikey168/Modulo/issues/416) | State P2: ADR and contract for namespaced plugin state | ADR 0008 published; closed. |
| [#417](https://github.com/Ikey168/Modulo/issues/417) | State P3: implement versioned plugin-state persistence and REST API | Partial local implementation: PostgreSQL store, migration and host REST API; external permissions, schema registry and event delivery remain. |
| [#418](https://github.com/Ikey168/Modulo/issues/418) | State P4: frontend plugin-state client with offline queue and conflict handling | Client, plugin context, auth lifecycle and remote discovery implemented locally; recovery and integration verification ongoing. |
| [#419](https://github.com/Ikey168/Modulo/issues/419) | State P5: migrate plugin installs, hub preferences, and saved searches off localStorage | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#420](https://github.com/Ikey168/Modulo/issues/420) | State P6: migrate Canvas boards to synchronized plugin state | Not implemented in this pass; retains original acceptance criteria and dependencies. |
| [#421](https://github.com/Ikey168/Modulo/issues/421) | State P7: migrate embedded Database records to synchronized plugin state | Not implemented in this pass; retains original acceptance criteria and dependencies. |
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

1. Complete #415 across every resource access path, including WebSocket subscriptions/broadcasts, graph, import/export and audit attribution; define and test legacy ownership migration.
2. Finish #417 permissions/schema/event delivery and #418 host integration before migrating existing storage (#419–422); run #423 before closing #409.
3. Deliver #424–429, then #430–434, followed by the dependent Pack Studio, Trust Center and knowledge work in the [roadmap order](feature-ideas.md).
4. Keep #401 open until actual staging soak, release and Pi evidence satisfies its operational criteria.
5. Publish verified changes and close individual issues; update this ledger and roadmap with the acceptance evidence. Do not close epics based on foundational components alone.
