# Contributing to Modulo

Thanks for contributing! This guide covers the conventions a change is expected
to follow, plus the architectural constraints that pull requests are reviewed
against.

## Getting set up

- **Backend:** Spring Boot 2.7 / Java 17 / Maven (`backend/`).
- **Frontend:** React 18 + TypeScript / Vite / Vitest (`frontend/`).
- See the root [README](README.md) for quick start and local development, and
  the [docs hub](docs/README.md) for topic guides.

## Running tests and lint

```sh
# Frontend (from frontend/)
npx vitest run                 # all tests
npm run lint                   # full lint
npm run lint:boundary:ci       # strict core/experience boundary check (mirrors CI)

# Backend (from backend/)
mvn test
```

## Commit conventions

Modulo uses [Conventional Commits](docs/CONVENTIONAL_COMMITS.md)
(`feat:`, `fix:`, `docs:`, …). Releases are derived from commit history, so
the prefix matters.

## Architectural constraints

These are reviewed on every PR. A change that violates one is rejected until it
is brought back into line (or the governing decision record is superseded).

### Core / experience boundary

Feature-pack code consumes the public **`@modulo/core`** API surface
(`frontend/src/core/index.ts`) — it must **not** import workspace internals
(`features/workspace/workspaceApi`, `features/workspace/types`,
`features/workspace/useWorkspaceData`) directly. This is enforced by the
`no-restricted-imports` ESLint rule (`error`) and the `boundary-lint` CI job.
Background: [B2 boundary audit](docs/architecture/B2-boundary-audit.md).

### The core stays concrete (non-goal guard)

`note`, `link`, `tag`, and `user` are **first-class core types** and stay that
way. Do **not** generalize the core into a typeless property graph, and do
**not** move the node catalog's built-in type system into plugins. This is a
deliberate, binding decision — read it before proposing any "make the core
generic" refactor:

> **[ADR 0002 — The core keeps first-class `note`/`link`/`tag`/`user` types](docs/architecture/adr-0002-core-keeps-first-class-types.md)**

Reopening it requires superseding the ADR with a new one, not a speculative PR.

## Architecture decision records

Significant architectural decisions are recorded as ADRs under
[`docs/architecture/`](docs/architecture/). Browse the
[docs hub](docs/README.md#architecture) for the current list. When a change
makes or reverses such a decision, add or supersede an ADR in the same PR.
