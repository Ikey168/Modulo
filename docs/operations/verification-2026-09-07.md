# Modulo verification repair — 2026-09-07

Verified the working tree on `fix/plugin-state-contract`, based on `ddab6f07`.
These results describe the uncommitted working tree, not that commit alone.
Existing unrelated edits, test exclusions, coverage thresholds and lint baseline
were preserved. No commit, push, deployment or GitHub issue closure was performed.

## Repairs

- Added the missing `owner_id` and `blueprint_name` columns to the H2 test
  registry schema. Their absence caused 151 application-context errors in the
  previous full run. PostgreSQL migration and ownership tests remain enabled.
- Restored the missing shared approval canonicalization module, signature
  vectors and verifier tests from `origin/main`. Signed report and evidence-bundle
  export tests now execute their independent verification tools successfully.
- Replaced the obsolete provenance-warning assertion with enforced Trust Center
  behavior. Validation now fails closed when its verifier is absent, throws, or
  reports unknown, partial, failed, unavailable or stale evidence. Seven additional
  negative test cases cover these outcomes.
- Fixed React effect dependencies, stale ref-cleanup warnings, per-runtime
  operation queues, unused Markdown props and mixed component/helper exports.
  The normal lint baseline was not expanded.
- Updated the standalone boundary-lint configuration to load the React Refresh
  plugin referenced by existing inline directives. The import restriction is
  unchanged; an intentionally forbidden import was tested and rejected.
- Rebuilt the workspace browser fixture around the current account-scoped
  installation/state contract and correct workflow API response shapes. Tests
  cover persisted SOP checklists and explicit import of legacy browser settings;
  legacy settings are not silently claimed by an account.

## Results

| Check | Result |
| --- | --- |
| Backend `mvn -B verify` with Java 17 | Exit 0; 112 suites, 778 reported tests: 776 passed, 2 skipped, 0 failures, 0 errors |
| Frontend TypeScript | Passed |
| Frontend unit tests | 1,062 passed; 0 failed or skipped |
| Strict frontend production build | Passed |
| Frontend baseline-aware lint | Passed; 0 new findings, 95 existing baseline findings |
| Standalone boundary lint | Passed |
| Boundary negative probe | Forbidden workspace import rejected by `no-restricted-imports` |
| Workspace Chromium smoke tests | 2 passed; 0 flaky, failed or skipped |
| Audit onboarding desktop/mobile Chromium tests | 4 passed; 0 flaky, failed or skipped |
| Node approval/report verification tests | 3 passed |
| Python evidence-bundle tests | 1 passed |
| Pack schema/example synchronization | Passed |
| `git diff --check` | Passed |

The backend run includes Trust Center publisher/CLI policy tests, semantic
knowledge tests, PostgreSQL/pgvector migrations, workspace-pack transactions,
approval/report workflows and WASM execution suites.

## Reproduction

Use a Java 17 JDK, the repository's Node version, installed dependencies, Docker,
and the Playwright Chromium browser. From the repository root:

```sh
(cd backend && mvn -B verify \
  -Dlogging.level.root=WARN \
  -Dlogging.level.org.springframework=WARN \
  -Dlogging.level.org.hibernate=WARN)
npm run typecheck --workspace=frontend
npm run lint:ci --workspace=frontend
npm run lint:boundary:ci --workspace=frontend
npm run test:run --workspace=frontend -- --maxWorkers=2
npm run build:strict --workspace=frontend
(cd frontend && npx playwright test --config playwright.smoke.config.ts --workers=1)
(cd frontend && npx playwright test tests/audit-pack-onboarding.spec.ts \
  --project=chromium --project='Mobile Chrome' --workers=1)
node --test shared/approval/verification.test.mjs scripts/test-audit-report.mjs
python3 scripts/test-evidence-bundle.py
python3 scripts/sync-pack-assets.py --check
git diff --check
```

The recorded strict build used an output directory inside `.verification/` to
avoid replacing existing `frontend/dist` artifacts. The recorded Java 17 JDK is
under `.verification/2026-09-07/jdk17`; a normal Java 17 installation also works.

## Limits and remaining quality targets

**Successful default Maven verification does not mean coverage targets passed.**
JaCoCo reported instruction coverage 56% versus 85%, branch coverage 47% versus
80%, line coverage 55% versus 85%, and 134 missed classes versus a maximum of 3.
The existing default POM treats these as warnings (`haltOnFailure=false`). Those
settings were not changed; the stricter `ci` profile was not run. This repair
does not claim compliance with its coverage requirement.

`UserControllerTest` and `BlockchainServiceIntegrationTest` remain disabled as
they were before this repair. Existing POM exclusions for other legacy
contract/integration and repository/service tests also remain. The test counts
above cover the configured suite, not every source file in the repository.

Browser journeys use explicit local API/identity fixtures, so they do not prove
live OIDC login or a deployed backend. They exercise the actual workspace,
installation validation, state client, import consent and browser persistence.
No production authentication bypass was added by this repair.

Real staging soak, physical Raspberry Pi/arm64 validation, remote-provider
evaluation and live OCI artifact verification were not performed or represented
as passing. These results fix the previously reported local verification
failures; they are not blanket release-acceptance evidence.

## Saved evidence

Local outputs are in `.verification/2026-09-07-fixes/`:

- `summary.json` aggregates exit codes, test counts and remaining limitations.
- `backend-full.log` and `backend-full-reports/` contain Maven/Surefire evidence.
- `frontend-tests.json`, frontend logs and both `*-playwright.json` reports retain
  the frontend and browser results.
- `boundary-negative-probe.json` records the intentional import rejection.
- `changed-source-sha256.json` records the exact 19 fix-related source files.

The directory is local verification output, not a substitute for CI artifacts
from a future committed revision.
