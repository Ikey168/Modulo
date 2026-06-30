# Modulo Documentation

This is the documentation hub for Modulo. Topic-specific guides live in the
themed folders below; component-local docs (backend, smart contracts, infra)
are linked from the [Component & infrastructure docs](#component--infrastructure-docs)
section at the bottom.

> New here? Start with the root [README](../README.md) for the project
> overview, quick start, and architecture summary.

## Architecture

- [B2 — Core/Experience boundary audit](architecture/B2-boundary-audit.md)
- [ADR 0001 — Encryption key derivation](architecture/adr-0001-encryption-key-derivation.md)
- [ADR 0002 — Core keeps first-class note/link/tag/user types](architecture/adr-0002-core-keeps-first-class-types.md)
- [ADR 0003 — Custom-code blueprint node sandbox](architecture/adr-0003-custom-code-node-sandbox.md)
- [Knowledge graph milestone](knowledge-graph.md)

## Plugins

- [Plugin system architecture & API design](plugins/architecture.md)
- [Plugin development guide](plugins/development-guide.md)
- [Plugin system summary](plugins/system-summary.md)
- [Plugin manager UI](plugins/manager-ui.md)
- [Plugin marketplace UI](plugins/marketplace.md)
- [Plugin submission system](plugins/submission.md)
- [Third-party plugin hosting](plugins/third-party-hosting.md)
- [gRPC plugin service](plugins/grpc-service.md)
- Frontend plugin module: [`frontend/src/features/plugins/README.md`](../frontend/src/features/plugins/README.md)

## Blueprint system

- [Visual editor](blueprint/editor.md)
- [Interpreter](blueprint/interpreter.md)
- [Node catalog](blueprint/node-catalog.md)

## Mobile

- [Mobile OAuth & blockchain authentication](mobile/oauth.md)
- [Mobile responsiveness](mobile/responsiveness.md)
- [Mobile performance testing & debugging](mobile/performance-testing.md)

## Sync & offline storage

- [Conflict resolution for simultaneous edits](sync/conflict-resolution.md)
- [Network reconnection & auto-sync](sync/network-sync.md)
- [SQLite offline storage](sync/sqlite-offline.md)

## Attachments & storage

- [Azure Blob Storage for attachments](storage/azure-blob-storage.md)

## Authentication & authorization

- [Frontend PKCE login flow](auth/pkce-login-flow.md)
- [Role/claim matrix & least-privilege defaults](authz/role-matrix.md)
- [Custom role migration guide](authz/migration-guide.md)
- [OAuth migration documentation](authz/migration.md)
- [Role implementation examples](authz/examples.md)
- [Admin & operator playbook](authz/operator-playbook.md)
- [Smoke-test checklist](authz/smoke-test-checklist.md)
- [Role matrix documentation tests](authz/test-coverage.md)

## Security

- [Encrypted note sharing — security model](security/encrypted-sharing.md)
- [Security testing & cloud deployment hardening](security/testing-and-cloud-hardening.md)
- [Security testing guide](SECURITY_TESTING_GUIDE.md)
- [Security findings remediation](SECURITY_FINDINGS.md)
- [Vulnerability remediation playbook](VULNERABILITY_REMEDIATION.md)
- [CodeQL code scanning](CODEQL_SECURITY_SCANNING.md)
- [OWASP ZAP scanning](OWASP_ZAP_SECURITY_SCANNING.md)
- [Secret scanning & pre-commit hooks](SECRET_SCANNING_IMPLEMENTATION.md)
- [Container image signing with Cosign](CONTAINER_IMAGE_SIGNING.md)
- Repo-wide [security policy](../SECURITY.md)

## Secrets management

- [Local development secrets (SOPS + direnv)](LOCAL_DEVELOPMENT_SECRETS.md)
- [External Secrets Operator](EXTERNAL_SECRETS_IMPLEMENTATION.md)

## Observability & operations

- [OpenTelemetry implementation](observability/opentelemetry.md)
- [Audit logging & decision tracing](AUDIT_LOGGING_DECISION_TRACING.md)
- [Health endpoints & Kubernetes probes](HEALTH_ENDPOINTS.md)
- [Service Level Objectives (SLOs)](SLO_SPECIFICATION.md)
- [Database backup & restore](operations/database-backup.md)

## Performance

- [Performance testing](PERFORMANCE_TESTING.md)
- [AuthN/Z performance & resilience benchmark](perf/authz-benchmark.md)
- [API response time optimization](perf/api-response-time-optimization.md)
- [Mobile performance testing](mobile/performance-testing.md)

## Deployment

- [Kubernetes deployment](deployment/kubernetes.md)

## CI, policy & release process

- [Policy CI gate](POLICY_CI_IMPLEMENTATION.md)
- [Policy directory](policy/README.md)
- [Conventional commits guide](CONVENTIONAL_COMMITS.md)
- [Release workflow test](RELEASE_TEST.md)

## Component & infrastructure docs

These live next to the code they describe:

- Backend: [Blockchain integration](../backend/BLOCKCHAIN_INTEGRATION.md) ·
  [IPFS integration](../backend/IPFS_INTEGRATION.md) ·
  [Config validation](../backend/CONFIG_VALIDATION_IMPLEMENTATION.md) ·
  [JaCoCo coverage guide](../backend/JACOCO_COVERAGE_GUIDE.md)
- Smart contracts: [README](../smart-contracts/README.md) ·
  [Deployment](../smart-contracts/DEPLOYMENT.md) ·
  [Polygon mainnet deployment](../smart-contracts/POLYGON_MAINNET_DEPLOYMENT_README.md) ·
  [Security audit report](../smart-contracts/SECURITY_AUDIT_REPORT.md)
- Azure: [Setup overview](../azure/README.md) ·
  [Application Insights setup](../azure/setup-app-insights.md)
- Kubernetes / infra: see the `README.md` in each [`k8s/`](../k8s) subfolder
  (observability, chaos-engineering, incident-response, cost-management, …)
- Load testing: [`k6-tests/`](../k6-tests)
