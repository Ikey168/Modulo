# Modulo

**A self-hosted personal operating system: one place for your notes, your
records and the automations that act on them, running on infrastructure you
control.**

[![CI](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml/badge.svg)](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What Modulo is

Most personal software splits a life across a notes app, a task manager, a
budgeting spreadsheet, a reading list, a homelab wiki, some automation scripts
and an AI chat window. Each of these tools holds its own data, sets its own
rules, and doesn't connect to the others. Modulo puts all of them in one
workspace that you host yourself.

It is built from three ideas:

1. **A small, fixed core of knowledge.** Notes, links, tags and users are
   first-class types. Everything you write is Markdown with `[[wiki links]]`,
   typed properties and saved queries. The links form a knowledge graph that
   Modulo can search, visualize and cite.
2. **Everything else is a plugin, and plugins come in packs.** About 130
   plugins provide the planner, canvas, time tracking, finance ledgers,
   research evidence, a homelab inventory, a TTRPG campaign manager and more.
   The rail shows only what you have installed. A *pack* installs a complete
   experience in one step. Modulo ships 37 of them, covering areas such as
   Personal Finance & Wealth, Research Evidence Lab, Health & Training,
   Career Studio and Modified PARA.
3. **Automation you can stay accountable for.** Blueprints are visual
   workflows. Every run is recorded step by step, can be retried or cancelled,
   and can stop at an approval step until a person signs a decision. Automation
   gets exactly the authority you grant it, and no Blueprint can widen its own.

Modulo also serves as the user-facing front end for two sibling systems.
**Noesis** takes in research and knowledge. **Praxis** carries out tasks for
you. Modulo holds their credentials on the server, so the browser and the
phone never see a Noesis or Praxis token.

The same React app runs in the browser, as an Electron desktop app and as an
Android app. All three sync through your server and keep working offline.

## Principles

These rules are enforced in code and CI, not just written down.

- **Your data, your server.** Every resource belongs to the signed-in owner, and
  every query filters by the owner. Plugin data goes to versioned server-side
  state, not browser storage, so it survives a lost device and syncs to all of
  them. Exports and backups produce readable files.
- **Local by default.** Semantic search and Ask Modulo run on a local embedding
  provider that never sends note text anywhere. Ask Modulo answers
  *extractively*: every sentence it returns is quoted from one of your notes and
  cited, and when no note supports an answer it says so instead of making one
  up. Note text goes to a remote model only through the optional AI Summary
  plugin and the Blueprint summarization node, and both stay off until you
  configure an API key.
- **Untrusted code stays contained.** Custom Blueprint code runs in QuickJS
  compiled to WebAssembly. Each run gets a fresh instance with no host access, a
  32 MiB memory cap, a wall-clock timeout and a cap on output size. Third-party
  backend plugins never run in the core JVM. Each one runs as its own container
  and talks to the core over gRPC.
- **Trust you can check.** Before you install or upgrade anything, the
  marketplace's Trust Center shows its signatures, SBOM, scan results and
  publisher verification. If an upgrade adds permissions, it has to ask for
  consent again. Approval decisions are signed and can be exported as a
  verifiable evidence bundle.
- **Optional services stay optional.** The minimum install is the backend,
  PostgreSQL, Keycloak and the web app. If Neo4j, IPFS, Ethereum anchoring,
  NATS or external plugins are missing or down, Modulo logs it and continues to
  serve notes.

## What's inside

| Area | What you get |
|---|---|
| **Notes and knowledge** | Markdown editor, backlinks and mentions, typed properties and frontmatter, saved query views, embedded databases, a knowledge graph, semantic search, suggested links you accept or reject, and Ask Modulo |
| **Everyday workspace** | Dashboard, planner and daily notes, calendar, timeline, canvas, todos, time tracking, runbooks and SOPs, capture inbox, checkpoints, folder sync |
| **Domain packs** | Finance, research, career, writing, health, home, travel, media, business, education, security audits, homelab, electronics, music, TTRPG and more. See the [pack catalog](docs/reference/pack-catalog.md). |
| **Blueprints** | A visual editor for trigger → action → logic workflows, with capability grants, autonomy levels (manual, supervised, autonomous), webhooks, schedules and custom WASM nodes |
| **Execution Center** | Durable runs with step history, retries, cancellation, schedules that survive restarts, dead letters and alerts |
| **Approvals** | A reviewer inbox, resumable approval steps, signed decisions and portable evidence bundles |
| **Packs and Pack Studio** | Pack Manifest v2 with transactional install, upgrade and rollback, plus an editor for authoring your own packs |
| **Marketplace** | Plugins and packs with Trust Center evidence, and a submission pipeline for external plugins pinned by image digest |
| **Connected systems** | Noesis Information Intake (all ten intake modes), Praxis task submission with live progress, a Gmail newsletter connector, optional Ethereum/IPFS content anchoring, Azure Blob attachments |
| **Agent access** | An [MCP server](tools/modulo_mcp/README.md) that lets an AI assistant read and write your workspace through the same owner-scoped, version-checked API the app uses |
| **Clients** | Web, Electron desktop, and Android (phone and tablet) with an offline cache, share-to-Modulo and local reminders |

## Who it's for

Modulo is built by its owner for their own use and runs on their own
infrastructure: an Oracle production host, a home network and a Raspberry Pi
homeserver, all documented under [`docs/infrastructure/`](docs/infrastructure/README.md).
The code is published under the MIT license, and anyone can self-host it. It
supports multiple users with strict per-owner isolation, but it is not a hosted
SaaS product.

## Quick start

Requirements: Docker with Compose. For development without Docker, use
[mise](https://mise.jdx.dev/), which installs Java 17, Node 22 and Python from
[`.mise.toml`](.mise.toml).

```sh
git clone https://github.com/Ikey168/Modulo.git
cd Modulo
docker compose up          # or: npm run start
```

| Service | URL |
|---|---|
| App (production build) | http://localhost |
| Backend API | http://localhost:8080/api |
| API docs (Swagger UI) | http://localhost:8080/swagger-ui (spec at `/api-docs`) |
| Keycloak | http://localhost:8180 |

Sign in and the workspace opens at `/app/dashboard`. From there, open
**Marketplace → Packs** to install your first pack. For the Vite dev server,
running services individually, the desktop app and local secrets, see
[Local development](docs/getting-started/local-development.md).

## How it's built

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Redux Toolkit, React Flow. Feature code uses only the `@modulo/core` API. |
| Backend | Spring Boot 2.7 on Java 17: REST under `/api`, STOMP for live updates, gRPC for external plugins, the Blueprint interpreter and workflow engine |
| Data | PostgreSQL (source of truth, Flyway migrations, pgvector), Neo4j (derived link graph) |
| Identity | Keycloak OIDC with authorization code + PKCE |
| Sandbox | QuickJS on WebAssembly for scripts, and import-free WASM for compiled nodes |
| Native shells | Electron (`desktop/`), Capacitor for Android (`mobile/`) |

See the [architecture overview](docs/architecture/README.md) for how requests
and data move through the system, and the
[decision log](docs/architecture/decisions.md) for the reasons behind the
design choices.

## Checks

```sh
mise run check      # the full acceptance gate: repo, frontend, backend, WASM fixtures, infrastructure
```

Smaller loops: `npx vitest run` in `frontend/`, and `mvn -q test -Dtest=ClassName`
in `backend/`.

## Repository layout

| Path | Contents |
|---|---|
| `frontend/` | React 18 + TypeScript app (Vite, Vitest, Playwright) |
| `backend/` | Spring Boot 2.7 / Java 17 API, WebSocket and workflow engine |
| `desktop/` | Electron shell (standalone package) |
| `mobile/` | Android app (Capacitor) and device testing |
| `shared/` | Pack manifests and approval schemas shared by frontend and backend |
| `plugin-contract/`, `services/` | External-plugin contract and supporting services |
| `examples/` | Example WASM Blueprint nodes (AssemblyScript, Rust) |
| `smart-contracts/` | Solidity contracts (Hardhat) |
| `deploy/`, `helm/`, `k8s/`, `argocd/`, `terraform/` | Deployment definitions |
| `infra/personal/` | Ansible for the owner's personal infrastructure |
| `tools/` | MCP servers for Modulo and Docker |
| `docs/` | Documentation. Start at [docs/README.md](docs/README.md). |

## Documentation

- [Overview and glossary](docs/getting-started/overview.md)
- Features: [workspace](docs/features/workspace.md),
  [knowledge](docs/features/knowledge.md),
  [Blueprints](docs/features/blueprints.md),
  [workflows and approvals](docs/features/workflows-and-approvals.md),
  [plugins](docs/features/plugins.md), [packs](docs/features/packs.md),
  [integrations](docs/features/integrations.md),
  [mobile and desktop](docs/features/mobile-and-desktop.md)
- [Architecture](docs/architecture/README.md) and the [decision log](docs/architecture/decisions.md)
- [Deployment](docs/operations/deployment.md)
- [Roadmap](docs/project/roadmap.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
