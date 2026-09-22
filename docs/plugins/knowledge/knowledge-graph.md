# Knowledge Graph Milestone (#250–#254)

Projects notes and their `[[links]]` into Neo4j as a derived read model and builds the
graph-powered note features on top. **Postgres remains the source of truth**; Neo4j is an
eventually-consistent projection that can be down without affecting note writes.

## Architecture

```
Note/Link write (Postgres, JPA)
        │  publishes async PluginEvent (note.*, link.*)
        ▼
GraphProjectionEventListener ──► GraphProjectionService ──► Neo4j (:Note)-[:LINKS_TO]->(:Note)
                                        ▲
GraphController (REST /api/graph) ──────┘  (backlinks / related / neighborhood / status / backfill)
UnlinkedMentionsService ────────────────────► Postgres full-text scan (#252, no Neo4j)
```

The projection uses the **Neo4j Java driver directly** (raw Cypher), not Spring Data Neo4j,
so the JPA `Note` entity is untouched and Neo4j stays optional.

## Issues

| # | Feature | Backend | Frontend |
|---|---------|---------|----------|
| 250 | Neo4j projection + backfill | `GraphProjectionService`, `GraphProjectionEventListener`, `GraphBackfillService`, `LinkEvent.LinkDeleted` | — |
| 251 | Backlinks panel | `GET /api/graph/notes/{id}/backlinks` | `BacklinksPanel` |
| 252 | Unlinked mentions | `UnlinkedMentionsService`, `GET …/unlinked-mentions`, `POST …/link-from/{sourceId}` | `UnlinkedMentionsPanel` |
| 253 | Related notes | `GET …/related` (shared-neighbor Cypher) | `RelatedNotesPanel` |
| 254 | Local subgraph + saved views | `GET …/neighborhood?depth=` | `LocalGraphPanel` + `savedViews.ts` |

All four panels are surfaced in the note view via `graph/GraphPanels.tsx` (tabbed).

## Configuration

| Property / env | Default | Purpose |
|----------------|---------|---------|
| `modulo.graph.enabled` / `MODULO_GRAPH_ENABLED` | `true` (`false` in `dev`) | Toggle the projection. When off, no `Driver` bean exists and all graph ops are no-ops. |
| `modulo.graph.backfill-on-startup` / `MODULO_GRAPH_BACKFILL_ON_STARTUP` | `false` (`true` in docker stack) | Project all existing notes/links on startup. |
| `spring.neo4j.uri` / `SPRING_NEO4J_URI` | `bolt://localhost:7687` | Neo4j bolt URI. |
| `spring.neo4j.authentication.{username,password}` | `neo4j` / `test` | Credentials (docker stack overrides to `stagingpassword123`). |

The `dev` docker-compose stack does **not** run Neo4j, so the projection is disabled there and
the graph panels render empty states. Run the full `docker-compose.yml` stack (includes Neo4j)
to exercise the graph end-to-end.

## Resilience (#250 acceptance)

- Projection **writes** are best-effort: failures are logged and swallowed so note/link
  operations never fail because Neo4j is unavailable.
- Graph **reads** return empty results when Neo4j is down/disabled.
- Backfill is idempotent (Cypher `MERGE`) and safe to re-run: `POST /api/graph/backfill`.

## Tests

- `GraphProjectionServiceTest` — graceful degradation when the projection is disabled.
- `UnlinkedMentionsServiceTest` — word-boundary matching, self/already-linked exclusion, snippets.

## Tooling

A read-only Neo4j Cypher MCP is wired in `.mcp.json` (`neo4j`) for inspecting the projection
during development against the full docker stack.
