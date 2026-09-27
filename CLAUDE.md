# Modulo — Claude Code context

Read [AGENTS.md](AGENTS.md) first. Its rules on acceptance, safety and generated
files apply here too. This file adds the working details a coding agent needs.
For anything deeper, start at [docs/README.md](docs/README.md).

## Stack

| Layer | Tech |
|---|---|
| Backend | Spring Boot 3.5 (Jakarta EE 10, Hibernate 6), Java 17, Maven (`backend/`, package `com.modulo`) |
| Frontend | React 18 + TypeScript, Vite 5, Vitest, Playwright (`frontend/`) |
| Data | PostgreSQL with Flyway migrations (`backend/src/main/resources/db/postgresql/`) |
| Auth | Keycloak OIDC (code + PKCE), Spring Security, owner-scoped resources |
| Sandbox | QuickJS on WASM (`WasmScriptSandbox`): no host access, 32 MiB memory cap, wall-clock timeout |
| Clients | Browser, Electron (`desktop/`, standalone package), Android via Capacitor (`mobile/`) |
| Toolchain | `mise` pins Java 17, Node 22, Python (`.mise.toml`) |

## Where things live

```
frontend/src/
  core/          @modulo/core — the only API feature code may use
  features/      workspace, notes, blueprint, executions, approvals, packs, knowledge, praxis, …
  features/workspace/           workspace shell, core views, viewkit/, shared domain models and stores
  features/workspace/plugins/   plugin runtime, catalog (catalog.ts) and core built-in plugins
  packs/<pack>/  domain pack views, pack-only helpers, plugins/ entry modules, tests
  services/      low-level REST/WS clients, deviceDocuments, legacy migration readers
backend/src/main/java/com/modulo/
  blueprint/     interpreter, node registry, sandbox, execution (workflow runs), approval
  pack/ plugin/  pack install lifecycle, plugin manager, submission, marketplace trust
  state/         versioned plugin state API
  integrations/  Noesis, Praxis
  knowledge/     embeddings, semantic search, Ask Modulo
shared/          pack manifests and approval canonicalization shared by both sides
docs/            see docs/README.md; docs/reference/generated/ is machine-written
```

## Rules that fail builds

- **Boundary.** Feature code must not import `features/workspace/workspaceApi`,
  `features/workspace/types` or `features/workspace/useWorkspaceData`. Use
  `@modulo/core` (alias in both `vite.config.ts` and `tsconfig.json`). Enforced
  by ESLint (`error`) and the `boundary-lint` CI job. `npm run lint:boundary:ci`
  is the strict check.
- **Pack boundary.** Code in `src/packs/<a>/` must not import `src/packs/<b>/`.
  Shared code goes in `features/workspace/` (or `@modulo/core`, `@/ui`,
  `services/`). Same ESLint rule and CI job as the core boundary; the
  per-pack overrides are generated in `frontend/.eslintrc.boundary.cjs`.
- **No browser storage.** ESLint forbids `localStorage` and `sessionStorage`.
  Plugin data uses plugin state. Device-only documents use
  `services/deviceDocuments`.
- **Android inventory.** Adding or changing a plugin can make
  `docs/reference/generated/android/*` stale. Regenerate with
  `npm run inventory:android --workspace=frontend`. CI runs the `:check` variant.
- **Migrations are additive.** Add a new `V<n>__*.sql`. Never edit a shipped one.
- **Docs verifiers.** `scripts/verify-*.py` check required headings in
  `docs/infrastructure/*` and `docs/security/incident-response.md`.

## Running tests

```sh
mise run check                          # full acceptance gate

# Frontend (from frontend/)
npx vitest run                          # all unit tests
npx vitest run src/core/                # one directory
npm run typecheck

# Backend (from backend/)
mvn -q test -Dtest=Foo,Bar              # named classes
mvn -q -o test -Dtest=Foo               # offline, after a prior compile
```

## Common patterns

### Adding a Blueprint node
1. Add the descriptor to `frontend/src/features/blueprint/nodeCatalog.ts` and its
   capability to `frontend/src/features/blueprint/capabilities.ts`.
2. Backend: for an always-available core node, add its capability to
   `BlueprintNodeRegistry.CORE_CAPABILITIES` and implement it in
   `BlueprintInterpreterService.executeBuiltInNode`. A plugin-contributed node
   registers a `BlueprintNodeRegistration` with a `BlueprintNodeHandler` instead.
3. Update the `listByCategory()` counts in
   `frontend/src/features/blueprint/__tests__/nodeModel.test.ts`.
4. Add the node to `docs/reference/blueprint-nodes.md`.

### Mocking the workspace API in Vitest
Use `vi.hoisted()` so the mocks exist before `vi.mock()` runs:
```ts
const { mockNotesApi } = vi.hoisted(() => ({ mockNotesApi: { list: vi.fn() } }));
vi.mock('../../features/workspace/workspaceApi', () => ({ notesApi: mockNotesApi }));
```

## Git protocol

- Commit with `--no-verify`. The pre-commit hooks can block on CI-only checks.
- Use Conventional Commits: `type(#issue): description`.
- Branches: `claude/issues-NNN`, or `claude/issues-NNN-MMM` for work spanning several issues.
- The shell has no global git identity, so pass it on each commit:

```sh
git add <specific files>
git -c user.email="prod-claude@krasnjanski-mail.com" -c user.name="Ikey168" \
  commit --no-verify -m "feat(#NNN): description

Co-Authored-By: <the model's attribution line>"
```

## Current focus

No epics are open. See [docs/project/roadmap.md](docs/project/roadmap.md) for
what has shipped and the candidate next work.
