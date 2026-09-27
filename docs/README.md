# Modulo documentation

This is the map of Modulo's documentation. Pages are grouped by what you are
trying to do. The code is the source of truth. When a page and the code disagree,
the page is the bug: fix it in the same change.

## Start here

| If you want to… | Read |
|---|---|
| Understand what Modulo is and the vocabulary it uses | [Overview](getting-started/overview.md) |
| Run the stack locally, run tests, manage local secrets | [Local development](getting-started/local-development.md) |
| Contribute a change | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Know what's planned | [Roadmap](project/roadmap.md) |

## Architecture — how the system is built

| Page | Covers |
|---|---|
| [System overview](architecture/README.md) | Components, how they talk, where each concern lives |
| [Backend](architecture/backend.md) | Spring Boot application, package layout, API surface, events |
| [Frontend](architecture/frontend.md) | React app, `@modulo/core`, feature packs, boundary lint, plugin runtime |
| [Data and state](architecture/data-and-state.md) | PostgreSQL/Flyway, Neo4j, plugin state API, sync and offline, tenancy |
| [Security model](architecture/security-model.md) | Authentication, authorization, encryption, sharing |
| [Decision log](architecture/decisions.md) | Every architecture decision record (ADR), binding until superseded |

## Features — what Modulo does and how to use or extend it

| Page | Covers |
|---|---|
| [Workspace](features/workspace.md) | Notes, views, planner, canvas, embedded databases, properties and queries |
| [Knowledge](features/knowledge.md) | Knowledge graph, semantic search, Ask Modulo, suggested links |
| [Blueprints](features/blueprints.md) | Visual workflow editor, interpreter, triggers, WASM sandbox |
| [Workflows and approvals](features/workflows-and-approvals.md) | Workflow runs, Execution Center, human approvals, signing, evidence bundles |
| [Plugins](features/plugins.md) | Plugin model, development, external plugins, marketplace, Trust Center |
| [Packs](features/packs.md) | Pack manifest, install lifecycle, Pack Studio |
| [Integrations](features/integrations.md) | Noesis, Praxis, Gmail, blockchain/IPFS, Azure Blob, gRPC |
| [Mobile and desktop](features/mobile-and-desktop.md) | Android app, Electron desktop shell |

## Reference — look things up

| Page | Covers |
|---|---|
| [Blueprint nodes](reference/blueprint-nodes.md) | Every node in the catalog |
| [WASM node ABI](reference/wasm-node-abi.md) | Module contract for custom WASM nodes and sandbox behavior |
| [Pack catalog](reference/pack-catalog.md) | The domain packs that ship with Modulo |
| [Configuration](reference/configuration.md) | Backend and frontend configuration keys and environment variables |
| [`examples/`](reference/examples/) | Worked example files used by tests |
| [`generated/`](reference/generated/) | Machine-written evidence (Android parity/performance/accessibility, authz benchmark). Regenerate these with their scripts. Don't edit them by hand. |

## Operations — run Modulo in production

| Page | Covers |
|---|---|
| [Deployment](operations/deployment.md) | The Oracle production host, the Raspberry Pi, Kubernetes for external plugins, and the archived cloud stacks (commit `86644da`) |
| [Releases and supply chain](operations/releases-and-supply-chain.md) | Release pipeline, image signing, SBOMs, promotion |
| [Database](operations/database.md) | Flyway migrations, backup and restore |
| [Observability](operations/observability.md) | Health endpoints, OpenTelemetry, audit logging, SLOs, load testing |
| [Security testing](operations/security-testing.md) | CodeQL, OWASP ZAP, secret scanning, policy CI, vulnerability handling |
| [Runbooks](operations/runbooks.md) | Step-by-step operator procedures |

## Personal infrastructure and security

The devices, network and recovery procedures that host Modulo, Noesis and Praxis.
Scripts in `scripts/verify-*.py` check these pages, so keep their required
headings intact.

| Page | Covers |
|---|---|
| [Infrastructure overview](infrastructure/README.md) | Hosts, trust boundaries, how the pieces fit |
| [Devices](infrastructure/devices.md) | Device inventory and rebuild procedures |
| [Home network](infrastructure/home-network.md) | Topology, addressing, WireGuard, monitoring, recovery |
| [Data lifecycle](infrastructure/data-lifecycle.md) | Retention classes and the Noesis data lifecycle |
| [Recovery](infrastructure/recovery.md) | Disaster-recovery entry point for every loss scenario |
| [Records](infrastructure/records.md) | Dated acceptance and verification evidence |
| [Incident response](security/incident-response.md) | Playbooks for account, device and credential compromise |
| [Identity recovery](security/identity-recovery.md) | Tier-0 identity roots, recovery factors, remediation plan |

## Conventions for these docs

- One topic, one page. Extend the page that covers the topic before starting a
  new one, and add every new page to this index.
- Link to code with repo-relative paths so links survive refactors that keep the file.
- Record architecture decisions in the [decision log](architecture/decisions.md).
  Record dated acceptance evidence in [records](infrastructure/records.md) or in
  the relevant pull request, not in feature pages.
- Never put secret values in docs. Document variable names and where each secret is kept.
