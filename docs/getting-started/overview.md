# Overview

This page explains what Modulo is, how its parts fit together, and the words the
rest of the documentation uses. Read it first. It links to the detailed pages for
every topic.

## What Modulo is

Modulo is a self-hosted personal workspace. It has four layers:

- **Knowledge.** Markdown notes with `[[wiki links]]`, tags, typed properties, a
  knowledge graph, semantic search and cited answers over your own notes.
- **Automation.** A visual Blueprint editor for building workflows. Their runs are
  durable and inspectable, and a step can pause for a human approval.
- **Composition.** Nearly everything you see is an installable plugin. Plugins are
  grouped into domain packs (security audits, personal finance, research, career,
  and so on) and installed from an in-app marketplace that shows trust evidence.
- **Connected systems.** Modulo is the user-facing surface for two sibling
  services: **Noesis** (research and knowledge intake) and **Praxis** (agentic task
  execution). It can also anchor content hashes on Ethereum and IPFS for
  provenance.

The same React frontend runs in the browser, in an Electron desktop shell and as
an Android app. Each signed-in user's data is owned by that user, and it syncs
across devices through the server.

## Main parts

| Part | Technology | Where |
|---|---|---|
| Web frontend | React 18, TypeScript, Vite, Redux Toolkit, React Flow | [`frontend/`](../../frontend/) |
| Backend | Spring Boot 2.7, Java 17, Maven | [`backend/`](../../backend/) |
| Primary database | PostgreSQL, schema owned by Flyway migrations | [`backend/src/main/resources/db/postgresql/`](../../backend/src/main/resources/db/postgresql/) |
| Identity | Keycloak (OIDC) | [`keycloak/`](../../keycloak/) |
| Desktop shell | Electron | [`desktop/`](../../desktop/) |
| Android app | Capacitor wrapper around the shared frontend | [`mobile/`](../../mobile/) |
| Shared pack manifests | JSON, consumed by backend and frontend | [`shared/packs/`](../../shared/packs/) |
| Smart contracts | Solidity, Hardhat | [`smart-contracts/`](../../smart-contracts/) |
| Deployment | Compose, Helm, Kubernetes, Argo CD, Oracle A1 host | [`deploy/`](../../deploy/), [`helm/`](../../helm/), [`k8s/`](../../k8s/) |
| Personal infrastructure | Ansible | [`infra/personal/`](../../infra/personal/) |

For how requests and data flow between these parts, see the
[system overview](../architecture/README.md).

## The workspace

After you sign in, the app opens at `/app/dashboard`. A left rail switches between
views: Dashboard, Notes, Graph, Blueprints, Executions, Approvals, Packs,
Marketplace, and any views that installed plugins contribute. The rail shows only
installed capabilities. If you uninstall a view plugin, it disappears from the rail
until you reinstall it. See [Workspace](../features/workspace.md).

## Glossary

| Term | Meaning |
|---|---|
| **Note** | A Markdown document owned by one user. Notes, links, tags and users are first-class core types by design ([decision log](../architecture/decisions.md)). |
| **Link** | A directed relationship between two notes, created from `[[wiki links]]` or explicitly. Links form the knowledge graph. |
| **Property** | A typed field on a note (text, number, date, select, …) defined by a property schema. Saved queries filter and display notes by property. |
| **Plugin** | An installable unit of UI and behavior: a workspace view, a note panel, an editor action, a Markdown fence renderer, or Blueprint nodes. Most plugins are built in and lazy-loaded. External plugins run as separate workloads. See [Plugins](../features/plugins.md). |
| **Plugin state** | Versioned, per-user, namespaced server storage that plugins use instead of browser storage, so their data syncs and survives device loss. See [Data and state](../architecture/data-and-state.md). |
| **Pack** | A versioned manifest that installs a complete experience in one step: plugins, Blueprints, property schemas, saved queries, templates, dashboards and optional demo data. See [Packs](../features/packs.md). |
| **Feature pack** | A frontend code module registered through `FeatureRegistry` that talks to the rest of the app only through `@modulo/core`. This is an internal boundary, distinct from installable packs. See [Frontend](../architecture/frontend.md). |
| **`@modulo/core`** | The public frontend API surface ([`frontend/src/core/index.ts`](../../frontend/src/core/index.ts)). Feature code must not import workspace internals. A lint rule enforces this. |
| **Blueprint** | A visual workflow: a graph of trigger, action, logic and data nodes, stored as an intermediate representation (IR) and executed by the backend interpreter. See [Blueprints](../features/blueprints.md). |
| **Node catalog** | The set of available Blueprint node types, defined in [`nodeCatalog.ts`](../../frontend/src/features/blueprint/nodeCatalog.ts). See [Blueprint nodes](../reference/blueprint-nodes.md). |
| **Sandbox** | The isolated engine that runs user-supplied code in Blueprint nodes. It is QuickJS compiled to WebAssembly. It has no host access, a fresh instance per run, a 32 MiB memory cap, a wall-clock timeout and an output-size cap. |
| **Workflow run** | One execution of a Blueprint, persisted with an ordered record of each step, its timings and its outcome. The Execution Center lists and controls runs. |
| **Approval** | A step in a workflow where a run pauses until an authorized person decides. Decisions are signed and can be exported in an evidence bundle. See [Workflows and approvals](../features/workflows-and-approvals.md). |
| **Evidence bundle** | A portable, verifiable export of a workflow's decisions and artifacts. |
| **Trust Center** | The marketplace view of a plugin's signatures, provenance, SBOM, scan results and publisher verification. |
| **Noesis** | A sibling service for research and knowledge intake. Modulo's Information Intake plugin drives it. |
| **Praxis** | A sibling control plane that executes tasks for signed-in users. Modulo submits and monitors Praxis processes. |

## Where to go next

- Run it locally: [Local development](local-development.md).
- Change code: [CONTRIBUTING.md](../../CONTRIBUTING.md), then the relevant
  [architecture](../architecture/README.md) page.
- Deploy it: [Deployment](../operations/deployment.md).
