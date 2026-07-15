# Modulo — Claude Code Context

## Stack

| Layer | Tech |
|-------|------|
| Backend | Spring Boot 2.7.18, Java 17, Maven |
| Frontend | React 18 + TypeScript, Vite 5, Vitest |
| Databases | PostgreSQL (primary), Neo4j (knowledge graph) |
| Blockchain | Hardhat (Ethereum local node) |
| Auth | Keycloak (OIDC), Spring Security |

## Repository layout

```
backend/          Spring Boot app (Maven, src/main/java/com/modulo/)
frontend/         React/TS app (src/ tree below)
  src/
    core/         @modulo/core — the public API surface for feature packs
    features/     Feature modules (workspace, notes, auth, blueprint, plugins…)
    components/   Shared UI (common/, layout/, mobile/)
    services/     Low-level REST/WS clients (api.ts, websocket.ts, …)
    store/        Redux store
desktop/          Electron shell (standalone package, NOT an npm workspace;
                  serve.js = embedded static+proxy server, main.js = main process)
docs/             Architecture docs, ADRs
  architecture/   ADRs, boundary audit (B2-boundary-audit.md)
  blueprint/      Blueprint system docs
```

## Key architectural concepts

### @modulo/core (B0 milestone — in progress)
The single public API surface that feature packs use instead of importing
from workspace internals. Entry point: `frontend/src/core/index.ts`.  
**Never import from `features/workspace/workspaceApi`, `features/workspace/types`,
or `features/workspace/useWorkspaceData` in feature-pack code. Use `@modulo/core`
instead.**

- `ModuloCoreAPI` interface — `src/core/ModuloCoreAPI.ts`
- `CoreAPIImpl` — the implementation, wraps `workspaceApi`
- `createCoreAPI()` — factory exported from the barrel
- Graph queries: `buildGraph`, `filterGraphByTags`, `neighbours`, `subgraph`
- Types: `CoreNote`, `CoreLink`, `CoreTag`, `GraphQueryResult`

### Blueprint system
- Node descriptors in `frontend/src/features/blueprint/nodeCatalog.ts`
- Interpreter in `backend/.../blueprint/interpreter/BlueprintInterpreterService.java`
- Capability map in `BlueprintCapabilityService.java`
- Sandboxed JS nodes: `SandboxedScriptService.java` (Rhino engine, 500k instruction limit, 2s wall timeout)

### Boundary enforcement (B9 #302)
ESLint `no-restricted-imports` rule in `frontend/.eslintrc.cjs` — **`error`** since B9.
All violations cleared in B4–B7. CI gate: `boundary-lint` job in `.github/workflows/ci.yml`.
- `npm run lint:boundary` — human-readable grep filter (always exits 0)
- `npm run lint:boundary:ci` — strict CI check (exits 1 on any violation)

## How to run tests

```sh
# Frontend (from frontend/)
npx vitest run                   # all tests
npx vitest run src/core/         # just core tests

# Backend (from backend/)
mvn test -pl . -Dtest=MyTest     # single test class
mvn -q test -Dtest=Foo,Bar       # multiple classes
mvn -q -o test -Dtest=Foo        # offline mode (faster, needs prior compile)
```

## Git protocol

- **Always use `--no-verify`** with commits (pre-commit hooks may block CI-only checks)
- Committer identity: `prod-claude@krasnjanski-mail.com` / `Ikey168`
- Branch naming: `claude/issues-NNN` or `claude/issues-NNN-MMM` for multi-issue branches

The shell has no global git identity configured, so always pass `-c` flags:

```sh
git add <specific files>
git -c user.email="prod-claude@krasnjanski-mail.com" -c user.name="Ikey168" \
  commit --no-verify -m "feat(#NNN): description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Active milestone

**Milestone 16 — Core/Experience Boundary Refactor (B0)**

| Issue | Title | Status |
|-------|-------|--------|
| #294 / B1 | Define public `ModuloCoreAPI` interface | Done |
| #295 / B2 | Boundary audit & inventory | Done |
| #296 / B3 | Feature-pack contract (FeatureRegistry) | Done |
| #297 / B4 | Wire workspace route to CoreAPIImpl | Done |
| #298 / B5 | Wire link parser to CoreAPIImpl | Done |
| #299 / B6 | Wire graph views to CoreAPIImpl | Done |
| #300 / B7 | Register note-workbench feature pack | Done |
| #301 / B8 | Decision record: core keeps first-class note types (non-goal guard) | Done (this branch) |
| #302 / B9 | Flip lint rule to `error`, add CI gate | Done |

## Common patterns

### Adding a blueprint node
1. Add descriptor to `frontend/src/features/blueprint/nodeCatalog.ts`
2. Add capability entry to `frontend/src/features/blueprint/capabilities.ts`
3. Add `case` to `BlueprintInterpreterService.java` → `executeNode()`
4. Add capability to `BlueprintCapabilityService.NODE_CAPABILITY_MAP`
5. Update test expectation for `listByCategory()` count

### Mocking workspace API in Vitest
Use `vi.hoisted()` to declare mocks before `vi.mock()` runs:
```ts
const { mockNotesApi } = vi.hoisted(() => ({ mockNotesApi: { list: vi.fn() } }));
vi.mock('../../features/workspace/workspaceApi', () => ({ notesApi: mockNotesApi }));
```

### TypeScript path alias
`@modulo/core` → `src/core/index.ts` (wired in both `vite.config.ts` and `tsconfig.json`)
