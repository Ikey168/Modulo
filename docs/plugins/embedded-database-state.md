# Embedded database synchronization

Each authenticated owner stores a database at namespace `notion-database`, key
`database.{fence-id}`, schema `modulo.embedded-database` version 1. The document
contains its ID, title, typed columns, select options, rows, and optional table/board
view. Schema validation rejects malformed rows without dropping their source data.
Changing a column's display type preserves existing cell values for deliberate editing.

The fence remains a reference in Markdown. Migration does not rewrite note text.
The explicit browser import validates the entire legacy `modulo-databases` map,
creates missing records, and stops on differing remote data. It removes the source
only after every record and the migration marker synchronize. Partial imports are
idempotent. The recovery export contains raw legacy data, queued edits and cache.

## Note lifecycle and sharing

- Deleting a note or removing its fence retains database data. There is no automatic
  cascade because multiple notes can refer to the same fence ID. This also allows
  restoring a deleted note without losing its database. Retained data continues to
  count toward the owner's quota; the owner can explicitly delete its state record
  through the conditional state API after exporting it.
- Duplicating Markdown with the same fence ID deliberately references the same
  database within that account. Give the copied fence a new ID to start an independent
  database. The editor's insert action generates a new ID. No implicit copy occurs.
- Sharing or exporting Markdown shares the reference, not another owner's database
  contents. A different account gets its own namespace and can seed or import its
  own database. Collaborative/shared database grants are not implemented.
- Whole-document compare-and-set protects concurrent cell and column edits. A conflict
  keeps the local document and server version for explicit resolution; it does not
  silently apply a cell to a concurrently changed schema.

Validation covers fresh-cache discovery, idempotent migration, malformed data,
concurrent cell/schema changes, and retained records when a fence is removed or
replaced. The broader browser/Electron acceptance suite remains tracked by #423.
