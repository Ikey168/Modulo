# Modulo

Modulo is a self-hosted personal workspace. It combines linked Markdown notes and
a knowledge graph with a visual workflow engine (Blueprints), durable and
approvable workflow runs, and a marketplace of installable plugins and domain
packs. The same frontend runs in the browser, as an Electron desktop app, and as
an Android app.

[![CI](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml/badge.svg)](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Highlights

- **Notes and knowledge.** Markdown with `[[wiki links]]`, tags, typed
  properties and saved query views, a knowledge graph, semantic search, suggested
  links, and Ask Modulo answers that cite your own notes.
- **Blueprints.** A visual editor for trigger → action → logic workflows. User
  code runs in a QuickJS-on-WebAssembly sandbox.
- **Workflow runs you can trust.** Every run is persisted step by step. Runs can
  be retried or cancelled, and schedules survive restarts. Approval steps pause a
  run for a signed human decision, and the decisions can be exported as a
  verifiable evidence bundle.
- **Composable workspace.** Views, note panels and editor actions are plugins.
  Packs install a complete experience in one step (plugins, Blueprints, property
  schemas, queries, templates). The marketplace shows signatures, SBOMs and scan
  results before you install or upgrade.
- **Synced, owned data.** Every resource belongs to its signed-in owner. Plugin
  data lives in versioned server state with an offline queue, not in the browser.
- **Connected.** Modulo is the front end for Noesis (research intake) and Praxis
  (agentic task execution). It can optionally anchor content hashes on Ethereum
  and IPFS for provenance.

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

Sign in and the workspace opens at `/app/dashboard`. For the Vite dev server,
running services individually, the desktop app and local secrets, see
[Local development](docs/getting-started/local-development.md).

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
| `deploy/` | Deployment definitions: the OCI production host and the Raspberry Pi |
| `helm/plugin/`, `argocd/`, `k8s/nats/` | Kubernetes deployment of external plugins and their NATS broker. Retired cloud stacks are in commit `86644da`. |
| `infra/personal/` | Ansible for the owner's personal infrastructure |
| `tools/` | MCP servers for Modulo and Docker |
| `docs/` | Documentation. Start at [docs/README.md](docs/README.md). |

## Documentation

- [Overview and glossary](docs/getting-started/overview.md)
- [Architecture](docs/architecture/README.md) and the [decision log](docs/architecture/decisions.md)
- [Features](docs/README.md#features--what-modulo-does-and-how-to-use-or-extend-it)
- [Deployment](docs/operations/deployment.md)
- [Roadmap](docs/project/roadmap.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
