# Roadmap

This page records what Modulo has delivered and what is proposed next. GitHub
issues are the source of truth for committed work. This page is the summary and
links to them. Update it in the change that opens or closes an epic.

## Where things stand

There are no open issues or epics. All planned epics are closed:

| Area | Delivered | Tracking |
|---|---|---|
| Core/experience boundary | `@modulo/core`, `FeatureRegistry`, boundary lint as a CI error | B0 milestone, #294–#302 |
| Synchronized state and tenant isolation | Owner-scoped resources, versioned plugin state API, offline client, migration of every browser-local plugin store | [#409](https://github.com/Ikey168/Modulo/issues/409) |
| Execution Center | Durable workflow runs and step history, retries, cancellation, durable schedules, dead letters, alerts | [#410](https://github.com/Ikey168/Modulo/issues/410) |
| Human approvals and evidence | Approval state machine, resumable approval nodes, reviewer inbox, signed decisions, portable evidence bundles | [#411](https://github.com/Ikey168/Modulo/issues/411) |
| Pack Studio | Pack Manifest v2, transactional install/upgrade/rollback, authoring, Security Audit Pack and guided onboarding | [#412](https://github.com/Ikey168/Modulo/issues/412) |
| Marketplace Trust Center | Digest-pinned trust evidence, signature/SBOM/scan verification, permission-diff upgrade consent, publisher verification | [#413](https://github.com/Ikey168/Modulo/issues/413) |
| Structured and semantic knowledge | Typed properties, frontmatter, saved query views, embeddings, semantic search, suggested links, cited Ask Modulo | [#414](https://github.com/Ikey168/Modulo/issues/414) |
| WASM sandbox | QuickJS-on-WASM is the only script engine. Rhino is removed. | [#401](https://github.com/Ikey168/Modulo/issues/401) |
| Android | Full plugin parity on phone and tablet, no plugin `localStorage`, signed release pipeline | [#478](https://github.com/Ikey168/Modulo/issues/478) |
| Noesis Information Intake | All ten intake modes operable from Modulo | [#474](https://github.com/Ikey168/Modulo/issues/474) |
| Praxis control plane | mTLS + bearer + delegated-identity client, task submission, live progress, approvals, publication | [#525](https://github.com/Ikey168/Modulo/issues/525) |

## Candidates for next work

None of these is scheduled. Open an epic with acceptance criteria before starting.
They are listed roughly by how directly they build on existing work.

1. **Praxis hardening.** The client is tested against Praxis's `fake` executor
   only. Next steps: exercise real executors, check SSE reconnect and cursor
   durability under failure, and connect Praxis approvals and auto-publication to
   Modulo's own approval inbox and Execution Center.
2. **Verifiable revision history.** Today a single piece of content can be
   anchored with `BlockchainService`/`IpfsService`. The proposal is a per-revision
   hash chain with historical diff, restore and a verification view.
3. **Public digital garden.** Today sharing works one note at a time
   (`ShareController`). The proposal is to publish a selected set of notes as an
   indexed, content-addressed site.
4. **Content-derived tag suggestions.** Semantic *link* suggestions have shipped.
   Accept/reject tag suggestions based on note content have not.

## How this page is maintained

- An idea becomes committed work only when it has a GitHub issue with acceptance
  criteria.
- Close an epic only when every child issue is verified complete or explicitly
  dropped with a recorded reason. A closed issue alone does not prove a feature
  works end to end.
- When an epic closes, move it into the table above in the same change.
