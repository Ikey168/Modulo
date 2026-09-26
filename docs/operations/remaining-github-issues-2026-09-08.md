# Remaining GitHub issue implementation — 2026-09-08

The audit began with 13 open issues on `Ikey168/Modulo`. Existing uncommitted
implementations were preserved and extended. This file describes working-tree
implementation evidence and GitHub closure status, not a deployed release.

## Follow-up issue audit

The initial follow-up found the same 13 open issues. Closing the already implemented
#439 and its parent #412 was attempted first; both requests were rejected with
`GraphQL: Resource not accessible by personal access token (closeIssue)`.
The environment token lacked issue-write access and was overriding a working
GitHub keyring credential. Using the keyring credential with `GITHUB_TOKEN` and
`GH_TOKEN` unset for those commands resolved the failure without changing stored
credentials. All 13 issues are now closed: #401, #412–#414, #439–#444 and
#448–#450. A subsequent GitHub query returned no open issues.

The existing implementations cover #439–#444 and #448–#450, together with parent
epics #412–#414, subject to the operational limitations below. Their source is
still in the working tree, including untracked files; this audit does not claim
that it has been committed, pushed, or deployed.

The follow-up found and fixed a #449 edge case: suggested links rejected notes
longer than the 2,000-character interactive search limit. Internal suggestion
queries now use a bounded prefix, preserve UTF-16 surrogate pairs, and clamp the
requested result count before arithmetic. Interactive queries retain their
limit. A PostgreSQL integration regression covers long-note suggestions and
ensures suggestions do not create links automatically.

Follow-up verification passed: 51 backend tests on Java 17 (knowledge indexing,
retrieval, marketplace trust, artifact verification and WASM contracts), 14
knowledge/Trust Center frontend tests, four desktop/mobile audit browser tests,
four workspace/Trust Center browser tests, and seven Node signature/deployment
tests. `git diff --check` passed. The initial Java 25 run encountered JaCoCo
instrumentation warnings; the supported Java 17 rerun is the recorded result.

| Issues | Implementation and acceptance evidence |
| --- | --- |
| #448 | Durable PostgreSQL index queue, transactionally debounced updates, bounded resumable backfill, model generations, local/off privacy; `KnowledgeIndexIntegrationTest` |
| #449 | Stored-vector/lexical search, stale-vector invalidation, owner filtering, persistent suggestion decisions, normal link acceptance, Notes search UI; committed semantic evaluation fixture |
| #450 | Extractive answers, source citations and answer ranges, provider controls, cancellation, AI-off fallback, no tool execution; `KnowledgePanel.test.tsx`, knowledge integration tests |
| #440 | Immutable releases, normalized permission detail, separate evidence states/provenance, historical signing identity; Trust Center contract tests |
| #441 | Exact-digest checks, signed SBOM attestation verification, malformed-output rejection, bounded verifier output, publisher trust-root policy, install-time recheck; verifier fixtures |
| #442 | Explicit release consent, runtime permission enforcement, serialized upgrade decisions, digest-based Helm deployment, atomic-upgrade recovery and historical-config rollback; deployment command tests |
| #443 | Account-bound publisher applications, independent admin approval, impersonation prevention, signer history, revocation and expiry; publisher integration tests |
| #444 | Dedicated Trust Center review, risk descriptions, pinned version, evidence and failures, reporting, confirmation and operation history; component and responsive keyboard browser tests |
| #439 | Guided audit now continues through human review and local signature verification, with export; desktop/mobile Playwright fixture journeys |
| #412, #413, #414 | Parent epics covered by their existing completed children plus the work above; deployment acceptance remains separate |
| #401 | Existing WASM-only cutover implementation retained; local sandbox suite runs in backend verification. Staging soak and physical Pi acceptance remain outstanding |

## Operational acceptance still required

Issue #401 explicitly requires a release cycle of real staging traffic and an
actual Raspberry Pi/arm64 run. Neither can be established from this checkout.
The current source has already retired Rhino; this is not evidence that the
required earlier staging soak occurred. The user explicitly requested closure
of #401 despite this recorded limitation; its closure is not evidence that the
staging soak or physical hardware validation took place.

Browser journeys use local identity/API fixtures, including a generated signing
key for receipt verification. They prove the browser workflow, not live OIDC or
a production signing identity. Live OCI evidence, cluster deployment/rollback,
and staging hardware checks require their real environments.

Remote AI remains explicitly unavailable; the shipped implementation is local
and extractive. The hashing-provider fixture evaluates morphological similarity,
not a production remote language model.

## Reproduction

Verified in this working tree:

- Full backend `mvn verify`: 788 tests reported, 786 passed and two pre-existing
  skips; no failures or errors. A subsequent targeted run of the final knowledge,
  trust, submission, controller and migration changes passed 54 tests.
  The final plugin-health/lifecycle suite passed 16 tests, including owner-scoped
  failure links, persisted stop status and removal of event subscriptions.
- Full frontend unit suite: 1,069 passed. The final runtime-removal confirmation
  regression also passed in the targeted three-test Trust Center suite.
- TypeScript, production build, baseline-aware lint and boundary lint passed.
- Audit journey: four desktop/mobile checks passed, including signed receipt
  verification. The refreshed documentation screenshot was inspected.
- Workspace/Trust Center browser suite: four checks passed, including keyboard
  review at 390 px and 1280 px without document overflow.
- Seven Node verifier/deployment tests and one Python evidence-bundle test passed.
  Pack asset synchronization and `git diff --check` passed.
- Helm chart rendering uses `repository@sha256:...`; an invalid digest is rejected.

The default backend coverage gate still warns: instructions 58% versus 85%,
branches 48% versus 80%, lines 56% versus 85%, and 131 missed classes versus a
maximum of three. The normal frontend lint gate retains 95 existing findings
and reports no new findings. No exclusions or thresholds were loosened.

```sh
# Use Java 17 and the repository's configured dependencies.
(cd backend && mvn -B verify)
npm run typecheck --workspace=frontend
npm run lint:ci --workspace=frontend
npm run lint:boundary:ci --workspace=frontend
npm run test:run --workspace=frontend -- --maxWorkers=2
npm run build:strict --workspace=frontend
(cd frontend && npx playwright test tests/audit-pack-onboarding.spec.ts \
  --project=chromium --project='Mobile Chrome' --workers=1)
(cd frontend && npx playwright test --config playwright.smoke.config.ts)
node --test scripts/test-marketplace-deployment.mjs
node --test shared/approval/verification.test.mjs scripts/test-audit-report.mjs
python3 scripts/test-evidence-bundle.py
python3 scripts/sync-pack-assets.py --check
```

Existing backend exclusions, two disabled suites, coverage warning policy and
frontend lint baseline were retained. Passing the configured suite does not
establish the stricter CI coverage thresholds.
