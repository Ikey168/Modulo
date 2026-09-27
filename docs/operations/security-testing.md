# Security testing

This page is for maintainers and operators. It lists the security checks that
exist for Modulo (static analysis, dynamic scanning, secret scanning, policy
tests, penetration tests), how to run each one locally and in CI, and how to
triage and fix what they find. The security design itself is in
[Security model](../architecture/security-model.md); handling a live incident is
in [Incident response](../security/incident-response.md); reporting a
vulnerability is described in [`SECURITY.md`](../../SECURITY.md).

## What runs where

| Check | Tool | Local | CI | Gate |
|-------|------|-------|----|------|
| Secrets in commits | Gitleaks | `pre-commit` hook, `gitleaks detect` | [`secret-scanning.yml`](../../.github/workflows/secret-scanning.yml) | Blocks PR |
| Authorization policy tests | OPA | `make policy-ci` | [`policy-ci.yml`](../../.github/workflows/policy-ci.yml) | Blocks PR |
| Dynamic scan (DAST) | OWASP ZAP | Docker | [`owasp-zap.yml`](../../.github/workflows/owasp-zap.yml) | Fails on any High |
| Static analysis (SAST) | CodeQL | CodeQL CLI | GitHub default code scanning (see below) | |
| Penetration tests | [`security-penetration-testing/`](../../security-penetration-testing) | `npm run test:security:all` | Manual | |
| In-app probes | `/api/security/testing/*` | [`scripts/security-assessment.sh`](../../scripts/security-assessment.sh) | Manual, non-production only | |
| Image signatures | Cosign, Kyverno | | see [Releases](releases-and-supply-chain.md) | |
| Dependency and image SBOMs | Syft, BuildKit | | release and signed builds | |

## Secret scanning

Configuration: [`.gitleaks.toml`](../../.gitleaks.toml) extends the default
Gitleaks rules with:

| Rule | Detects |
|------|---------|
| `modulo-api-key` | `modulo_api_key = <32–64 hex>` |
| `modulo-secret-key` | `modulo_secret = <32–128 hex>` |
| `blockchain-private-key` | `private_key = 0x<64 hex>` |
| `jwt-secret` | `jwt_secret = <32+ base64>` |

It also has allowlists for documentation placeholders, test fixtures, build
output, plugin-state store keys (`modulo-<name>-v<n>`), public key fingerprints and
the generated files under `docs/reference/generated/`, and skips some binary file
types.

Local setup, once:

```sh
./scripts/setup-security.sh     # installs pre-commit and gitleaks, installs the hooks, runs a first scan
```

[`.pre-commit-config.yaml`](../../.pre-commit-config.yaml) then runs on every
commit: whitespace and end-of-file fixers, YAML/JSON/TOML/XML checks, merge and
case conflicts, large files, `detect-private-key`, `no-commit-to-branch` (main,
master), Gitleaks, and black/isort/flake8 for Python.

```sh
pre-commit run --all-files               # everything, whole tree
gitleaks detect --config .gitleaks.toml  # full history scan
gitleaks protect --staged                # staged changes only
```

In CI the workflow runs the Gitleaks CLI (pinned to 8.28.0, the same version as
the pre-commit hook) with `.gitleaks.toml` on pull requests to `main`/`develop`,
pushes to `main` and manual runs. It scans only the commits being introduced (the
PR's base..head, or the pushed range) and prints findings, redacted, in the job
log. It does not scan the whole tree or history: the tree still contains known
development defaults (the dev JWT and encryption keys in
`backend/src/main/resources/application.*`, the Hardhat default account key and
the placeholders in `smart-contracts/.env.encrypted.example`), so a full scan
reports them. Run `gitleaks dir --config .gitleaks.toml .` to see them locally.

`.gitleaks.toml` uses the `[[allowlists]]` table form, which needs Gitleaks 8.25
or later.

When a secret is detected:

1. Treat it as compromised. Rotate it first (see
   [Deployment](deployment.md#secrets) and
   [Local development](../getting-started/local-development.md#local-secrets)).
2. Remove it from the code and load it from the environment or a secret store.
3. If it reached a pushed branch, rewriting history does not un-leak it; rotation
   is what matters.
4. If it is a false positive, add a narrow allowlist entry to `.gitleaks.toml`
   (path or exact regex), not a broad one.

Also enable GitHub secret scanning and push protection in the repository
settings; the workflow does not replace them.

## Policy CI

The OPA policies in [`policy/`](../../policy) (note RBAC/ABAC) and
[`infra/opa/`](../../infra/opa) (Envoy ext-authz) are code and are tested like
code. The rules themselves are described in
[Security model](../architecture/security-model.md).

| Command | Does |
|---------|------|
| `make policy-fmt` | `opa fmt --write` |
| `make policy-lint` | Fails if any file needs formatting |
| `make policy-validate` | `opa parse` |
| `make policy-test` | `opa test` on `policy/` |
| `make opa-test` | `opa test` on `infra/opa/` |
| `make policy-coverage` | Test coverage |
| `make policy-build` | Bundle to `dist/policy-bundle.tar.gz` |
| `make policy-security-scan` | Greps for `password`, `secret`, `token`, `key` literals |
| `make policy-ci` | fmt, lint, test, build |
| `make install-policy-ci` | Installs OPA 0.59.0 |

The CI workflow (triggered by changes under `policy/` or `infra/opa/`) pins OPA
0.59.0, the version the `opa` Compose service runs, and runs `opa fmt --list
--fail`, `opa check`, `opa test` on both directories, reports `policy/` test
coverage (currently about 60 %; there is no threshold) and uploads the built
bundles as an artifact. `infra/opa/` is loaded with `--ignore '*.yaml'` because
it also holds the OPA server configuration files.

Before merging a policy change: tests pass, coverage has not dropped, and every
new rule has a deny test as well as an allow test.

## Dynamic scanning with OWASP ZAP

[`owasp-zap.yml`](../../.github/workflows/owasp-zap.yml) stands up the full stack
(PostgreSQL, Neo4j, backend, frontend) with a staging `.env` and scans it. Because
that takes tens of minutes it is not a per-PR gate.

- Triggers: pushes to `main`, `develop`, `feature/*`, `release/*`; Sundays 03:00
  UTC; manual with `scan_type` (`baseline`, `active`, `full`) and an optional
  `target_url`.
- A matrix runs `baseline` and `active` in parallel.

| Scan | Script | Target |
|------|--------|--------|
| Baseline (passive spider) | `zap-baseline.py` | `http://localhost/` |
| Active | `zap-full-scan.py` | `http://localhost/` |
| API | `zap-api-scan.py` | `http://localhost:8080/api` |

Rules files are [`.github/zap/zap-baseline-rules.tsv`](../../.github/zap/zap-baseline-rules.tsv)
and `zap-active-rules.tsv`. Both are currently empty, so ZAP's default
thresholds apply. Add `<rule id>\tIGNORE|WARN|FAIL` lines to tune them, with a
comment explaining every `IGNORE`.

Gate: the job fails if any report contains a High-risk alert. Medium findings
are reported but do not fail. Reports (HTML, JSON, Markdown) are uploaded as
artifacts and SARIF goes to the Security tab.

Run locally against a running stack:

```sh
docker run --rm --network host -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://localhost/ -r zap-baseline.html
docker run --rm --network host -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t http://localhost/ -r zap-full.html
docker run --rm --network host -v "$PWD:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t http://localhost:8080/api-docs -f openapi -r zap-api.html
```

Only scan systems you own. Active scans send attack payloads.

## Static analysis (CodeQL)

[`.github/codeql/codeql-config.yml`](../../.github/codeql/codeql-config.yml)
configures the `security-and-quality` suite for `backend/src` and `frontend/src`
and ignores build output, `node_modules`, `.github`, `k8s` and `azure`. No
workflow in `.github/workflows` runs CodeQL. Analysis comes from GitHub's
default code-scanning setup in the repository settings, which runs `Analyze`
jobs on pull requests for `actions`, `go`, `javascript-typescript` and `python`.
Default setup does not read this config file, and it does not analyze Java, so
the backend has no SAST coverage. To cover it, switch to advanced setup with a
workflow that uses this config and adds `java`.
[`custom-queries.yml`](../../.github/codeql/custom-queries.yml) lists patterns of
interest (Spring Security misconfiguration, string-built queries, and similar)
but is not in CodeQL query-pack format and is not executed.

To run locally with the CodeQL CLI:

```sh
codeql database create /tmp/modulo-java --language=java --command="mvn -B -q -DskipTests package"
codeql database analyze /tmp/modulo-java codeql/java-queries:codeql-suites/java-security-and-quality.qls \
  --format=sarif-latest --output=java.sarif
```

## Penetration testing

[`security-penetration-testing/`](../../security-penetration-testing) is a Node
test harness.

```sh
cd security-penetration-testing
npm install
TEST_TARGET_URL=http://localhost API_TARGET_URL=http://localhost:8080 npm run test:security:all
```

| Script | Covers |
|--------|--------|
| `test:owasp` | OWASP Top 10 (2021) checks |
| `test:injection` | SQL, NoSQL, command, LDAP, XPath injection |
| `test:auth` | Password policy, sessions, JWT handling |
| `test:network` | TLS, security headers, CORS, rate limiting |
| `test:api` | API authentication, authorization, input validation, error handling |
| `test:dast` | Browser-driven dynamic tests |

Defaults are `http://localhost:3000` and `http://localhost:8080`; override with
`TEST_TARGET_URL`/`API_TARGET_URL` or `--base-url`/`--api-url`.

### In-app security probes

[`SecurityTestingController`](../../backend/src/main/java/com/modulo/security/testing/SecurityTestingController.java)
exposes `POST /api/security/testing/{vulnerability-scan, test-rate-limiting,
test-sql-injection, test-xss}`. Each requires all of:

- `modulo.security.testing.enabled=true`,
- a non-empty `modulo.security.testing.api-key` sent as `X-Security-Testing-Key`,
- a caller with the `ADMIN` role.

Unauthorized calls are logged to `SECURITY_AUDIT` and get 403. Enable this only
on a disposable environment, never in production.
[`scripts/security-assessment.sh`](../../scripts/security-assessment.sh) drives
the probes (`API_BASE_URL`, `SECURITY_API_KEY`).

### Hardening that the tests expect

| Control | Where |
|---------|-------|
| Per-IP rate limiting (100 requests/min, burst 20, HTTP 429) | [`RateLimitingFilter`](../../backend/src/main/java/com/modulo/security/RateLimitingFilter.java), `modulo.security.rate-limit.*` |
| Security headers and CORS for the `cloud` profile | [`CloudSecurityConfig`](../../backend/src/main/java/com/modulo/security/CloudSecurityConfig.java) |
| Security headers at the edge | [`frontend/nginx.conf`](../../frontend/nginx.conf) (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS); [`deploy/oci/Caddyfile`](../../deploy/oci/Caddyfile) (`X-Content-Type-Options`, `Referrer-Policy`, `Server` removed) |
| Security audit log | [`SecurityAuditLogger`](../../backend/src/main/java/com/modulo/security/SecurityAuditLogger.java) |
| Error responses without stack traces | `server.error.include-*=never` (`azure` profile) |
| TLS 1.2/1.3 only | `security` profile (`server.ssl.*`) |

## Triage and remediation

### Response times

| Severity | Respond | Typical action |
|----------|---------|----------------|
| Critical (for example SQL injection, remote code execution, authentication bypass) | Immediately, contain within 1 hour | Disable the affected feature or route, hotfix, security review |
| High (for example stored XSS, information disclosure, path traversal) | Within 24 hours | Fix, test, deploy |
| Medium (for example missing security headers, insecure cookie flags) | Within 1 week | Plan, fix, review |
| Low | Within 1 month | Scheduled maintenance |

For a Critical finding that may have been exploited, switch to
[Incident response](../security/incident-response.md).

### Triage steps

1. Reproduce on a non-production environment. Record the request, response and
   tool that found it.
2. Decide whether it is real. For a false positive, add a scoped suppression (ZAP
   rules TSV, Gitleaks allowlist) with a comment saying why.
3. Assign severity from impact and exploitability, not from the tool's label.
4. Fix at the source, add a regression test (unit, integration, or a policy
   test), and re-run the scanner that found it.
5. For Critical and High, note whether data was exposed and whether credentials
   need rotating.

### Where common findings get fixed in Modulo

| Finding | Fix here | Notes |
|---------|----------|-------|
| SQL injection | Repositories and `@Query` methods | Use bound parameters or Spring Data derived queries; never concatenate input into JPQL or native SQL. |
| XSS | Frontend rendering | Do not render untrusted HTML without sanitising; avoid `dangerouslySetInnerHTML`. |
| Missing security headers | nginx, Caddy, `CloudSecurityConfig` | Add at the edge so static assets are covered too. |
| Insecure cookies | `server.servlet.session.cookie.*` | `secure=true` and `http-only=true` behind HTTPS (the `azure` profile does this). |
| Information disclosure | `server.error.*`, actuator exposure | No stack traces or messages in errors; do not publish actuator on a public route. |
| Missing authorization on an endpoint | Controller and service ownership checks | Every owned resource must be checked against the authenticated account (see [Database operations](database.md#tenant-ownership-migration)). |
| Path traversal | File and attachment controllers | Resolve against the storage root and reject paths that escape it. |
| Rate limiting absent | `RateLimitingFilter` | Confirm it is enabled for the profile. |

### Emergency sequence for a Critical finding

1. Now: disable or firewall the affected functionality; preserve logs.
2. Within 1 hour: temporary mitigation in place.
3. Within 24 hours: permanent fix deployed through the normal signed release.
4. Within 48 hours: security review of related code.
5. Within 72 hours: post-incident review and updates to tests and this page.

Internal notification: the maintainer immediately, anyone deploying Modulo within
2 hours. Notify users if their data was exposed, and regulators where the law
requires it.
