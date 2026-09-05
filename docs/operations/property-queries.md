# Saved property queries

Open **Property queries** in the workspace. Choose displayed property columns, up to ten AND-combined filters, a sort key/direction, and an optional grouping property. Save the query under a title. The same query results can switch between table, list, card, and board projections without creating another record. A board requires a grouping property.

Calculated columns support declarative `sum` and `concat` operations over named properties. Sum accepts numeric properties and returns null when an input is missing/null; concatenation skips missing/null inputs. Formulas never execute JavaScript or arbitrary expressions.

Click a property value to edit it with the corresponding typed input. The edit reads the current owned note, checks its version, then commits the typed value and its Markdown frontmatter together. Conflicts retain input. Successful edits notify workspace consumers to refresh notes, search inputs, graph data and open query results. Other tabs/devices read authoritative saved configuration and values; visible results refresh every 15 seconds. Saving a stale query revision fails without replacing the local configuration.

Query links use `/app/property-queries?query=<UUID>`. Embed a saved query in any note:

````markdown
```property-query
01234567-89ab-cdef-0123-456789abcdef
```
````

Embeds enforce the viewing account's ownership and expose the same result views. Note links select the owned note in the workspace. A copied query ID does not grant another account access.

Results paginate on the server, with 50 rows in the UI and a hard maximum of 100 per request. Sorts include a stable note-ID tie-breaker and missing values sort last. Group headers and formulas describe the current page; they are not global aggregates. Pages are live reads, so concurrent edits may move a note between pages. The server limits page numbers to 10,000 and gives each SQL statement in a results transaction a three-second timeout.

In an embedded Database block, expand **Use rows as linked notes** and select **Create linked notes and query**. Up to 100 rows and 20 columns migrate atomically into typed notes. Column identities receive deterministic namespaced property keys; original database rows remain untouched. Repeated imports preserve existing notes, user edits, deleted-note tombstones and the saved-query identity. Schema type/option changes require explicit reconciliation rather than silently changing existing properties. Later editing occurs in the linked notes/query; this is a one-time migration, not bidirectional row synchronization.

Flyway V17 adds owner-scoped saved configurations and migration identity tables. `/api/property-queries` provides list/save; `/{id}` provides owned read/delete with revision checks; `/{id}/results?page=0&limit=50` executes the configuration; `/import-database` performs the explicit migration. Existing note/property indexes serve filters, and notes remain the sole record source for all projections.
