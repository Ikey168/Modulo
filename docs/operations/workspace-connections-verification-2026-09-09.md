# Workspace connection verification — 2026-09-09

Implementation and usage: [Search, document capture, references and offline notes](../plugins/workspace-connections.md).

## Validation

- Full frontend unit suite: 112 suites, 1,117 tests passed. Subsequent focused checks passed 16 tests covering the final cache changes, search, provenance, account draft isolation and service-worker behavior.
- Chromium smoke regression: 31 scenarios passed in the full run. The remaining semantic-search navigation scenario used an invalid runbook state in its fixture; after correcting that fixture, the targeted scenario passed. All 32 scenarios have passed, including six new connection workflows.
- Backend: 12 focused tests passed, including local workspace ranking, remote-provider exclusion, input bounds, UTF-8 extraction, a real PDF extraction through Poppler, and the existing note semantic-search tests.
- Strict frontend production build passed. Lint and boundary checks passed; 95 preexisting baseline lint findings remain.
- Pack asset synchronization and whitespace checks passed.

Backend tests ran with Java 25 and `-Djacoco.skip=true`: the repository's JaCoCo version cannot instrument Java 25 classes. A bundled Java 21 runtime was also tried but lacked `java.net.http`; it could not compile the existing application. This verification does not claim backend coverage measurement. Application compilation continues to target Java 17.

## Coverage boundaries

Browser tests use the real workspace, plugin runtime, browser persistence and rendering with fixture identity and API responses. They verify source-note updates, reload/reconnect, conflict review, document import, reviewed attachment extraction, reverse references, and semantic-result navigation. They do not establish production identity-provider, live attachment-storage, or remote embedding integration.

Service-worker tests verify that API and external requests are not intercepted, runtime configuration has an offline fallback, and only already-loaded same-origin application assets are precached. A production browser session with expired authentication is not supported as an offline login bypass.

Plain-text and PDF extraction were exercised. Image OCR uses Tesseract, now included with Poppler in the backend Dockerfile; a live Tesseract installation and container build were not exercised here. Scanned PDFs require OCR before import. The feature has not been deployed.

The strict build output is retained under `.verification/workspace-gaps-build`. Existing project smoke screenshots also exercise the revised workspace layout at desktop and mobile sizes.
