# Marketplace Trust Center

The Trust Center separates mutable marketplace listings from immutable,
digest-pinned releases. Flyway V20 records release identity, publisher identity,
permission sets, verification evidence, publisher review history, installation
and rollback history, and user reports.

## Evidence states

Signature, SLSA provenance, SBOM, and vulnerability evidence are evaluated
independently. Each record includes its source, summary, evaluation time,
expiry, and raw normalized payload. States are `VERIFIED`, `FAILED`,
`UNAVAILABLE`, and (when evidence expires) `STALE`; missing evidence is
`UNKNOWN`. Missing tools or evidence are never displayed as verified.

The default verifier invokes `cosign` against an exact `image@sha256:...`
reference (including signed SPDX SBOM attestations) and `grype` for vulnerability results. A mutable tag cannot satisfy
the install check. Critical vulnerabilities fail policy. Re-checking appends new
evidence rather than rewriting historical evaluations, so trust-root or policy
rotation remains inspectable.

## Publishers and releases

Publisher verification is an administrative action and cannot be self-assigned
by submission metadata. Levels are `UNVERIFIED`, `DOMAIN`, `IDENTITY`, and
`ORGANIZATION`; verified publishers require a signing identity. Approval,
expiry, revocation, and the reviewer actor are preserved in publisher history.
Revocation changes future trust decisions without rewriting old release facts.

Built-in plugins appear in the Trust Center as bundled software even when no
external OCI evidence applies. EXTERNAL marketplace releases expose their exact
digest, publisher/signing identity, permissions, and latest evidence.

## Install, upgrade, rollback, and health

Install-time verification rechecks evidence and fails closed unless the release
is VERIFIED. Runtime attachment also checks that the workload digest is exactly
the reviewed release digest. Permission increases require renewed consent;
declining leaves the existing release untouched. Applied upgrades and rollbacks
record actor, release IDs, old/new permission differences, consent, outcome, and
time without deleting plugin-owned user data.

The marketplace detail view exposes evidence before install and shows prominent
failure/permission information. Installed-plugin health combines runtime status,
trust status, release history, and user-report controls so failures can be
investigated without presenting unavailable evidence as healthy.

Publisher applications are submitted through
`POST /api/marketplace/trust/publishers/applications` with a name, proposed signing
identity and ownership evidence. Only an independent admin can approve them.
Applications never set the verification level or active signing identity.
Release ownership is bound to the authenticated account, not the submitted email.
Submission cannot rename an existing publisher or take over an existing plugin.
V22 preserves the historical release signer; identity rotation cannot rewrite it.

The Marketplace **Trust Center** tab exposes external release details, permission
consequences, consent, evidence expiry, reporting and operation history. Missing
health data is unavailable, never an inferred bundled/verified status. The API
returns permission arrays rather than PostgreSQL-specific JSON wrappers.

## Deployment and rollback

Approval pins a desired release; it is distinct from deploying a workload. All
code-digest changes require consent, and automatic upgrades are disabled. Runtime
attachment rejects unapproved versions and permissions beyond the approved set.

The operator command defaults to a read-only preview:

```sh
node scripts/deploy-marketplace-release.mjs \
  --api https://modulo.example \
  --release RELEASE_UUID --helm-release example-plugin --namespace modulo
```

Set `MODULO_API_TOKEN` to an operator access token. After inspecting the preview,
add `--apply --consent` to deploy. The command rechecks evidence, records the
approval, and invokes `helm upgrade --install --atomic --reuse-values` with the
exact `image.digest`. It records deployment success/failure separately from
approval. A failed upgrade restores its former approval pin when one exists.

For rollback, select a previous approved release UUID and add `--rollback
--apply --consent`. The command finds its historical Helm revision, checks the
revision's plugin and digest, and restores that revision's configuration with
`helm rollback`. Plugin-owned records and volumes are never deleted. A failed
rollback requires operator inspection; it is not reported as successful.

These commands require a configured cluster and Helm context. Local command
fixtures and chart rendering verify command construction and recovery decisions;
they do not establish that a live cluster or OCI registry has passed verification.
