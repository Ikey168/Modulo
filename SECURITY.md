# Security policy

## Reporting a vulnerability

Report vulnerabilities privately. Do not open a public issue.

Use GitHub's private reporting: **Security → Report a vulnerability** on
[Ikey168/Modulo](https://github.com/Ikey168/Modulo/security/advisories/new).
Include:

- the affected component and version or commit,
- steps to reproduce, or a proof of concept,
- the impact you expect, and any mitigation you know of.

You will get an acknowledgement, and the fix will be coordinated with you before
public disclosure. Reporters are credited in the advisory unless they ask not to be.

## Supported versions

Modulo is a self-hosted project released from `main`. Only the latest release
and `main` receive security fixes.

## Security model in brief

- **Authentication.** Keycloak OIDC (authorization code with PKCE) for web,
  desktop and Android.
- **Authorization.** Every note, tag, link, attachment, task, plugin-state record
  and workflow run belongs to its authenticated owner and is checked on every
  request and WebSocket subscription.
- **Sandboxing.** User code in Blueprints runs in QuickJS compiled to
  WebAssembly. It has no host access, a memory cap and a wall-clock timeout.
  External plugins run as separate, digest-pinned workloads.
- **Supply chain.** Images are signed, SBOMs are published, and marketplace
  installs verify signature, provenance and scan evidence.
- **Provenance is not confidentiality.** On-chain anchoring records a hash, not
  content. Content published to IPFS is readable by anyone who has its CID.

Details: [Security model](docs/architecture/security-model.md),
[Security testing](docs/operations/security-testing.md),
[Releases and supply chain](docs/operations/releases-and-supply-chain.md).

## For contributors

- Never commit tokens, passwords, private keys, recovery material, production
  data or `.env` files. Pre-commit and CI secret scanning will block most of these.
- Enforce owner scoping in every new query and endpoint, and add a two-owner test.
- Keep new dependencies pinned. Pin container images by digest.
