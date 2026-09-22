# Workspace Tools completion — 2026-09-08

The seven new Workspace Tools plugins and the extended Decision Journal are implemented and available individually or through `pack-workspace-tools`. Usage, storage semantics, migration and portability limits are documented in [Workspace Tools](../plugins/workspace-tools.md).

## Changes completed

- Registered all views, lazy loaders, note fence renderers, editor action and the installable pack.
- Connected executable runbooks to the authenticated manual Blueprint endpoint, preserving request IDs and blocking progress until server-confirmed workflow success.
- Added account-scoped Decision Journal storage, supporting evidence and explicit legacy browser-data copying.
- Hardened the shared tool store against malformed/deleted records, unsupported schemas, account transitions and concurrent writes; added recovery export and acknowledged import progress.
- Fixed a StrictMode/native Web Lock race that forked the cache identity on reload and hid unsynchronized edits. Page-exit cleanup now releases the replica lease.
- Fixed folder scans to use current server notes, avoid export filename collisions and reject changes made after preview.
- Retained failed attachment uploads, including recorded audio, for retry; normalized browser audio MIME parameters.
- Added checkpoint import validation and ID mappings for recreated notes; retained optimistic concurrency checks and safety checkpoints.
- Validated capsule dependencies, references, property schemas and import progress; batched property reads to the backend's 100-note limit. Creation markers and acknowledged mappings support interrupted import recovery.
- Added removal/export controls for bounded histories and explicit error states.
- Remount plugin views when accounts change and use a compact hub view selector on phones.

## Verification

- Full frontend Vitest run: **108 suites, 1,096 tests passed**.
- After the final state-lifecycle regression was added: **37 focused tests passed**, including the additional StrictMode lease test (10 workspace-state-host tests total).
- Backend Maven targeted run: **46 tests passed**, including PostgreSQL workflow-state tests, interpreter/manual endpoint tests and attachment tests. Manual requests preserve owned note context, reject foreign resources and non-manual triggers, and do not rerun an existing request.
- Full Chromium smoke run: **19 tests passed**, including **15 Workspace Tools journeys**. The Workspace Tools browser suite covers all eight plugins, immediate reload, failed workflow blocking, stale restore rejection, invalid stored data, schema preflight, failed audio retry, partial import resume, and mobile layout.
- Strict TypeScript/production build passes. Output is in `.verification/workspace-tools-build`, preserving the existing `frontend/dist` files.
- Lint baseline check and architectural import-boundary check pass. The baseline still contains 95 pre-existing findings; Vite still reports large existing chunks.
- `git diff --check` and `python3 scripts/sync-pack-assets.py --check` pass.

## Reproduction

```sh
npm run test:run --workspace=frontend -- --maxWorkers=2
npm run lint:ci --workspace=frontend
npm run lint:boundary:ci --workspace=frontend
npm run build:strict --workspace=frontend -- --outDir ../.verification/workspace-tools-build
(cd frontend && npx playwright test --config playwright.smoke.config.ts)
(cd backend && mvn -B test -Dtest=ManualBlueprintControllerTest,BlueprintInterpreterServiceTest,WorkflowRunServiceTest,AttachmentServiceTest)
python3 scripts/sync-pack-assets.py --check
git diff --check
```

Backend verification used the Java 17 JDK in `.verification/2026-09-07/jdk17`. Browser checks use real React views, plugin installation/state logic, local persistence, Chromium and browser layout, with bounded authentication/API fixtures. File-system handles and upload responses are fixtures; live microphone hardware, real local directory permissions, identity-provider login and external attachment storage were not exercised. This task does not deploy the workspace or certify the many unrelated uncommitted changes already present in the checkout.
