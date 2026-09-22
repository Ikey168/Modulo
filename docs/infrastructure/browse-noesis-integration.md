# BROWSE: Noesis research, intake and evidence monitoring

Implementation date: 2026-09-21. Oracle is the authoritative Modulo instance.

Open **Knowledge → Deep Research → Research with Noesis** (`/app/research-noesis`). The Notes plugin supplies this view and a note panel. Record detail sheets supply the same action for PARA projects, areas, resources, tasks and other records, including research questions, ideas and decision cases. A reviewed public question is sent to Noesis; object text and Modulo credentials are not forwarded.

## Task coverage

- INTEGRATE-02: contextual research actions and a standalone research view.
- INTEGRATE-03: stable object references, related-object links, reusable research IDs, explicit linking of existing results, and output backlinks.
- INTEGRATE-04: owner-scoped, versioned results in `workspace-noesis-research`; request-key replay; compare-and-swap refreshes; bounded compact evidence snapshots. Raw corpora stay in Noesis. Ordinary notes, tasks and user edits are not overwritten by refreshes.
- INTEGRATE-05 / MON-04: the previous snapshot, eight previous runs, added/removed/revised findings and sources, verdict changes and materiality. JSON key ordering, source order and retrieval timestamps do not produce false changes. Failures preserve the previous result. Loss of evidence or new contradiction is visible.
- INTEGRATE-06 / MON-05: a reviewed finding and action rationale can create an actual note, a decision-input note, a PARA inbox task, or an appended project update. Evidence, uncertainty and the Noesis reference accompany the output. Result receipts and work commit in one transaction. Retries and unchanged refreshes cannot duplicate the same output. An observation can be reviewed without creating work; insufficient-evidence refusals cannot produce work.
- MON-03: per-research public corpus, allowed publishers, configured primary publishers, required languages/regions and maximum source age. Host filters are enforced. Primary status is a configured source preference, not a truth judgment. Missing primary evidence and unavailable language/geography/recency metadata are explicit coverage gaps. A citation is not proof; unresolved independence and contradictions remain review obligations.
- INTAKE-05: feed synchronization preserves durable IDs and Saved/Archived state; canonical URLs remove only tracking parameters; external IDs are scoped to their feed/source. Briefing revisions ignore delivery identity/time and duplicate content. Same-title unrelated items remain separate. A preferred delivery channel can be selected per publisher and reset without deleting evidence.

## Operating boundaries

Noesis's public `POST /api/v1/kb/cross-domain/answer` searches **already acquired** sources. A refresh does not crawl the web or subscribe to a feed. Domain visibility is enforced by that public Noesis surface. The operator endpoint is `noesis.research.url`, defaulting to `http://noesis:8000` in the Oracle Docker network; no user-supplied URL is fetched by Modulo. Noesis responses are bounded to 512 KB, time-limited, and redirects are not followed.

The Noesis answer contract does not currently carry enough source metadata to verify language, geography or publication age. These requirements are recorded and flagged for review, never reported as satisfied without evidence. The run reference is a KB query receipt (domain, observation time and snapshot hash), not an invented persistent Noesis research-loop ID.

MON-01/02 topic/cadence selection and manual acceptance remain separate tasks. Disabled watchlists stay disabled. The existing AI watchlist was not enabled. No background acquisition schedule or external subscription was invented. Source inventory at implementation: empty synchronized feed collection, no imported newsletter records, no web-watch collection, and no configured feed URL in synchronized settings. There were no recorded subscriptions to cancel. Preferred delivery affects the Modulo briefing; external email/push subscriptions must be disabled at their provider once selected during intake setup.

## Storage and recovery

Research results use schema `modulo.workspace.noesis-research`, version 1, one state record per result. Backend APIs under `/api/research/noesis` resolve the signed-in owner through the existing state store. Refresh and output operations require the current result version. A conflict is returned to the user for reload/review. There is no blind retry over another device's edits.

- Create: `PUT /api/research/noesis/{request-uuid}` with question, domain, policy, optional local object reference and `publicQuestionConfirmed: true`.
- Refresh: `POST /{id}/refresh` with `requestId` and `expectedVersion`.
- Link: `POST /{id}/links` with `reference` and `expectedVersion`.
- Output: `POST /{id}/outputs` with current version/run, finding, kind, title, rationale and optional linked project.

Generic plugin-state export supports recovery of results. Keep source corpus backups in Noesis and owner-state/notes backups in Modulo. Deployment backups contain the exact replaced source files and prior image IDs. Roll back frontend/backend images together; the new research namespace is additive and needs no destructive schema migration.

## Verification commands

- `npm run build:strict --workspace frontend`
- `npm run test:run --workspace frontend -- src/features/workspace/research/__tests__ src/features/workspace/awareness/__tests__`
- Navigation and RecordSheet regression suites under their existing `__tests__` directories.
- `npx playwright test -c playwright.research.config.ts --project firefox` from `frontend`: real Firefox, bounded identity/API fixtures, desktop flow plus phone viewport. A separate port avoids accidentally reusing the local Grafana service on port 3000.
- Maven: `mvn -Dtest=ResearchEvidenceTest,NoesisResearchServiceTest,NoesisGatewayTest test`. The service tests use real PostgreSQL via Testcontainers; HTTP gateway tests use a local server. Tests cover owner isolation, stale writes, failures, replay, canonical deltas, source policy, evidence loss, contradictions, output deduplication and transaction rollback.

Live verification uses the authenticated Oracle Modulo API and deployed Noesis. Test records are explicitly identified and removed afterward; real PARA data is preserved.

## Verified deployment

Oracle backend and frontend images are `modulo-oci-backend:browse-20260921` and `modulo-oci-frontend:browse-20260921`; both health checks pass. To avoid deploying unrelated pending backend work, the backend artifact preserves every entry from the prior application JAR and adds only the four compiled `com.modulo.research` classes. The normal source build also compiles and passes the targeted tests.

Validation: 13 backend tests; 57 frontend tests across research, intake, navigation and RecordSheet suites; strict production frontend build; Firefox browser journey (desktop plus 390px phone viewport); six live Oracle checks, including real Noesis refusal/refresh and actual note/task/decision/project-update persistence with duplicate replay checks. Live fixtures were removed afterward. Chromium rendering on this workstation fails even on a standalone paragraph outside Modulo; Firefox supplied the browser acceptance check.

Rollback source, environment and prior image identities: `/srv/modulo/deploy/oci/backups/browse-agentic-20260921`. Build artifacts: `/srv/modulo/.browse-agentic-20260921/build`. Source workspace: `/srv/modulo`; matching local implementation workspace: `/home/ik/Modulo-browse-agentic`. The standalone Firefox capture extension remains in `/home/ik/noesis-browser-capture`.
