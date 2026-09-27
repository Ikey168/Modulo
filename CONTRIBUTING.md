# Contributing to Modulo

This guide covers how to set up, what a change must pass, and the architectural
rules reviewers enforce.

## Set up

Install [mise](https://mise.jdx.dev/) and run `mise install` in the repository
root. It provides the pinned Java 17, Node 22 and Python toolchains from
[`.mise.toml`](.mise.toml). Then follow
[Local development](docs/getting-started/local-development.md).

## Before you open a pull request

`mise run check` is the acceptance gate. It runs:

| Task | What it checks |
|---|---|
| `check-repository` | `git diff --check` (whitespace and conflict markers) |
| `check-frontend` | Typecheck, strict boundary lint, Vitest, strict production build |
| `check-backend` | `mvn -B verify`, including the coverage gate |
| `check-wasm` | Rebuilds the example WASM nodes and compares them to the checked-in fixtures |
| `check-infrastructure` | Structural gate for `infra/personal/` |

While iterating, run the smallest relevant test first:

```sh
cd frontend && npx vitest run src/core/          # one directory
cd backend  && mvn -q test -Dtest=Foo,Bar        # named test classes
```

Before declaring a change complete, run the affected parts of `mise run check`,
and say in the pull request which gates you did not run.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat(scope): …`, `fix: …`, `docs: …`). Commitlint enforces this in the
`commit-msg` hook, and release notes are generated from commit history, so the
type matters.

## Architectural rules

Reviewers reject a change that breaks one of these rules, unless it also
supersedes the governing decision in the
[decision log](docs/architecture/decisions.md).

1. **Feature code uses `@modulo/core`.** Feature-pack and plugin code must not
   import workspace internals (`features/workspace/workspaceApi`,
   `features/workspace/types`, `features/workspace/useWorkspaceData`). Use the
   public surface in `frontend/src/core/index.ts`. The ESLint
   `no-restricted-imports` rule enforces this as an error, and so does the
   `boundary-lint` CI job. See [Frontend](docs/architecture/frontend.md).
2. **The core stays concrete.** `note`, `link`, `tag` and `user` are first-class
   core types. Don't generalize the core into a typeless property graph, and don't
   move the node catalog's built-in type system into plugins. See
   [ADR 0002](docs/architecture/decisions.md#adr-0002).
3. **Plugins persist through plugin state.** Plugin data goes through the
   versioned plugin state API. ESLint forbids browser `localStorage` and
   `sessionStorage` in frontend code. Device-local documents go through
   `services/deviceDocuments`, and legacy migration reads live in
   `services/legacy`. See [Data and state](docs/architecture/data-and-state.md).
4. **Schema changes are additive, numbered Flyway migrations.** Never edit a
   migration that has shipped. See [Database](docs/operations/database.md).
5. **Every resource is owner-scoped.** New endpoints and queries must enforce the
   authenticated owner. See [Security model](docs/architecture/security-model.md).
6. **Domain pack code lives in `frontend/src/packs/<pack>/`, and packs don't
   import each other.** A pack's views, pack-only helpers and plugin entry
   modules go in its own folder. Code that the shell or several packs use
   stays in `features/workspace/`. Code in `src/packs/<a>/` may import
   `@modulo/core`, `@/ui`, the view kit, plugin types and shared modules, but
   never `src/packs/<b>/`: move what two packs need to a shared module first.
   `no-restricted-imports` enforces this as an error in `npm run lint` and the
   `boundary-lint` CI job. See
   [Domain pack folders](docs/architecture/frontend.md#domain-pack-folders)
   and [Pack boundary](docs/architecture/frontend.md#pack-boundary).
7. **No secrets in the repository.** Document variable names and where each
   secret is kept, never values.

## Documentation

Update the docs page that covers the behavior you change, in the same pull
request. Add new pages to the index in [docs/README.md](docs/README.md). When a
change makes or reverses an architectural decision, add an entry to the
[decision log](docs/architecture/decisions.md).
