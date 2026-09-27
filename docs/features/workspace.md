# Workspace

This page covers the everyday workspace: notes and their views, the planner,
canvas, embedded databases, todos and time tracking, typed note properties and
saved queries, and the Workspace Tools suite (projects, runbooks, capture,
checkpoints, folder sync, briefings, living documents, capsules, decisions,
personal SOPs). It is written for users who want to know how a feature behaves
and for developers who need to know where its data lives and what limits apply.

For how plugin records are stored and synchronized in general, see
[Data and state](../architecture/data-and-state.md). Packs that bundle these
plugins are described in [Packs](packs.md) and listed in the
[pack catalog](../reference/pack-catalog.md).

## Where things live

Most workspace features are plugins from the catalog in
[`catalog.ts`](../../frontend/src/features/workspace/plugins/catalog.ts)
(IDs in [`plugins.ts`](../../frontend/src/features/workspace/plugins.ts)). A
view is reached at `/app/<view-id>`. The shell always provides Dashboard,
Blueprints, Marketplace and Recovery, plus the built-in views `executions`,
`approvals`, `property-queries`, `packs` and `pack-studio`
([`Workspace.tsx`](../../frontend/src/features/workspace/Workspace.tsx)).
Everything else appears only when its plugin is installed; opening an
uninstalled view offers to install it.

| Feature | Plugin ID | View / contribution |
| --- | --- | --- |
| Notes | `notes-editor` | `notes` view; **Document text** and **Referenced by** note panels |
| Outline | `obsidian-outline` | **Outline** note panel |
| Graph | `graph-view` | `graph` view (see [Knowledge](knowledge.md)) |
| Canvas | `canvas-board` | `canvas` view |
| Planner and daily notes | `daily-notes` | `planner` view (**Planner & Calendar**), **Insert daily plan** editor action |
| Calendar | `calendar-view` | `calendar` view under the planner |
| Timeline | `timeline-view` | `timeline` view |
| Tags, Saved Searches | `tag-explorer`, `saved-searches` | `tags`, `saved-searches` views |
| Embedded database | `notion-database` | `database` Markdown fence, **Insert database** editor action |
| Todos | `todo-lists` | `todo` view, **Tasks** note panel |
| Time tracking | `zeiterfassung` | `time` view, **Time logged** note panel |
| Personal SOPs | `personal-sops` | `personal-sops` view |
| Math, Mermaid | `latex`/`mermaid` plugins | `math`/`latex` and `mermaid` fences |

## Notes

Notes are server records (PostgreSQL). `[[Wiki links]]` in a note body become
graph links ([`deriveWikiLinks.ts`](../../frontend/src/features/workspace/deriveWikiLinks.ts)).
Open **Search and commands** with Ctrl/Cmd+K to search notes and the records of
enabled plugins (projects, decisions, runbook receipts, Life OS collections).
Title matches rank first; nested record text such as OCR output, checklists and
review history is searched too. Credential fields are excluded from search text.

### Referenced by

The **Referenced by** panel lists project membership, runbook receipts,
decisions, flashcards and other indexed records that explicitly reference the
note. It follows numeric note IDs, `sourceNoteId`, `note:<id>` sources and
serialized evidence references. Arbitrary numbers and prose mentions are not
treated as relationships. Note-to-note backlinks are shown separately (see
[Knowledge](knowledge.md#backlinks-mentions-and-related-notes)).

### Document text

In a note's **Document text** panel, choose **Extract text**, review or correct
the result, then **Add reviewed text to note**. The attachment is not changed.
A provenance marker prevents inserting the same extraction twice, and an edit
made to the note after review stops the insertion until it is reviewed again.
Added text takes part in search, semantic indexing and cited answers.

Extraction runs on the Modulo server
([`DocumentTextController`](../../backend/src/main/java/com/modulo/knowledge/DocumentTextController.java),
`POST /api/knowledge/extract`). Plain text needs nothing extra; PDFs use
Poppler's `pdftotext` and images use Tesseract. The backend Dockerfile installs
both; a native server install needs them on `PATH`, otherwise the endpoint
answers 503 naming the missing tools. Uploads are limited to 10 MB and
extracted text to 500,000 characters. Encrypted, empty or unreadable documents
fail; scanned PDFs need OCR first.

### Offline notes

After a signed-in account has loaded its notes online, the device caches
notes, tags and links. Edits to existing notes are queued durably with the
server version they were based on, survive reloads, and replay on reconnect or
with **Retry note sync**. The sync notice distinguishes edits saved on the
device from edits the server acknowledged.

If another client changed the note meanwhile, both copies are kept for review:

- **Keep local edit** writes against the displayed remote version. A further
  intervening edit needs another review.
- **Use server copy** discards the queued local edit.
- **Export local edits** downloads the recovery cache.

Caches and drafts are scoped to the account; another account cannot replay a
previous account's queue. Browser Web Locks serialize cache writes across
tabs, and a storage failure rejects the edit instead of reporting it saved.
Creating notes, uploading attachments, changing links or tags and running
workflows still need a connection. Offline use needs an existing
authenticated session and cached app assets; the service worker caches assets,
never API responses.

## Planner and calendar

The planner derives everything from notes: a day's note is the note titled
with its ISO date (`2026-07-21`), so there is no separate storage
([`planner.ts`](../../frontend/src/features/workspace/planner.ts)). New daily
notes use a template with a plan checklist and day blocks. Carry-over copies
yesterday's unchecked items into today's note and never changes the source
note. The Calendar view sits under the planner.

## Canvas

Canvas boards place note cards and draw connections between them. Each board
is a plugin-state record `board.<id>` (schema `modulo.canvas.board`) in the
`canvas-board` namespace, so boards synchronize between devices
([`canvasSync.ts`](../../frontend/src/features/workspace/canvasSync.ts)). Older
browser-only boards (`modulo-canvas` in localStorage) are imported once and the
browser copy is retired only after the import is acknowledged.

On touch devices the canvas and graph disable browser gestures on their
surface; drag moves cards, two-finger pinch zooms and pans.

## Embedded databases

Insert a database with the editor action; the note gets a `database` fence
whose body is the database ID. The data itself is stored per owner in the
`notion-database` namespace, key `database.<fence-id>`, schema
`modulo.embedded-database` version 1
([`databaseSync.ts`](../../frontend/src/features/workspace/databaseSync.ts)).
A database has an ID, title, typed columns (`text`, `number`, `select`,
`checkbox`, `date`), select options, rows and an optional table or board view.
Changing a column's type keeps existing cell values for you to fix
deliberately; malformed rows are rejected without dropping their source data.

Behaviour to know about:

- **Deleting a note or removing its fence keeps the database.** Several notes
  can reference the same fence ID, and keeping the data lets you restore a
  deleted note. Retained data counts toward the owner's quota; delete the
  state record explicitly (after exporting it) to reclaim it.
- **Copying a fence with the same ID shares the database** within that
  account. Give the copy a new ID to start an independent database. The insert
  action always generates a new ID.
- **Sharing or exporting Markdown shares only the reference.** Another account
  gets its own namespace. Shared database grants are not implemented.
- Concurrent edits use whole-document compare-and-set. A conflict keeps both
  the local document and the server version for explicit resolution.

The one-time browser import validates the whole legacy `modulo-databases` map,
creates missing records, stops on any record that differs on the server, and
removes the browser copy only after every record and the migration marker are
synchronized. Re-running a partial import is safe.

To turn database rows into typed notes, see
[Linked notes from a database](#linked-notes-from-a-database).

## Todos and time tracking

Todos (`todo-lists` namespace, schema `modulo.todo`) and time entries
(`zeiterfassung` namespace, schema `modulo.time-entry`) are synchronized
plugin-state collections
([`operationalSchemas.ts`](../../frontend/src/features/workspace/operationalSchemas.ts)).
The legacy browser keys `modulo-todos` and `modulo-time-entries` are imported
on first use. The **Tasks** and **Time logged** note panels show a note's todos
and logged time.

Markdown checklists inside notes are also tasks for several tools (projects,
briefings, runbooks). Due dates are written `due:: YYYY-MM-DD` or
`📅 YYYY-MM-DD`; checklists inside code fences are treated as examples and
ignored.

## Typed note properties

Typed properties are stored apart from the legacy string metadata map and
tags (Flyway V16; legacy data is untouched). A property definition belongs to
an owner and has a stable key, title, type and optional select choices. **Type
and choices are immutable**: use a new key for a different meaning. Titles use
optimistic revisions.

| Type | Stored as |
| --- | --- |
| Text | String |
| Number | JSON number (`2` and `2.0` compare equal) |
| Boolean | `true`/`false` |
| Date | ISO calendar date, no time zone |
| Instant | UTC, normalized to nine fractional digits so comparisons keep chronological order |
| Select / multi-select | One or more of the defined choices |
| Link | HTTP(S) URL without embedded credentials |
| Note reference | ID of a note the owner owns; reads as null if the target is deleted or transferred |

Explicit JSON `null` is stored as a value; an absent key has no row. In a
write, `set: {key: null}` and `remove: [key]` therefore mean different things.
References never expose another owner's note content.

### Editing properties

Open a note and expand **Properties**. Each property has a value state:
**Missing** removes it, **Null** stores an explicit null, **Value** enables the
typed editor. **Define a property** suggests common keys and types.

**Save properties and Markdown** writes the values and the managed
`moduloProperties` frontmatter block in one transaction. It checks both the
note version and the exact stored Markdown body. On conflict the inputs are
kept. **Load current version, keep input** refreshes the property version but
does not bypass the body check; if someone else changed the Markdown,
reconcile the document first. A pending Markdown autosave disables property
writes.

```yaml
---
author: Ada
moduloProperties:
  due: 2026-09-06
  status: Open
  owner: 42
---
```

**Import from current Markdown** stages known values for review. **Export
Markdown with properties** downloads a portable document without saving it.
Rules for the frontmatter:

- It must be a YAML 1.2 block mapping of at most 64 KiB. Dates stay strings.
- Unrelated top-level fields, comments and the body keep their original bytes
  and order (including CRLF). Known property keys are written in a fixed order.
- Unknown keys under `moduloProperties` are reported on import and preserved on
  export; they never become indexed properties without a definition.
- Duplicate keys, aliases, anchors, unsupported tags, non-mapping frontmatter
  and malformed values are reported without changing anything. Flow-style
  top-level mappings are not rewritten; fix them in the Markdown editor.

### Property API

All calls need an authenticated, provisioned account
([`NotePropertyController`](../../backend/src/main/java/com/modulo/knowledge/NotePropertyController.java)).

| Endpoint | Purpose |
| --- | --- |
| `GET`/`PUT /api/note-properties/definitions` | Read or write definitions; a new definition uses revision 0 |
| `POST /api/note-properties/read` | Values for up to 100 `noteIds` |
| `POST /api/note-properties/write` | Atomic batch of `changes` (`noteId`, expected note `version`, `set`, `remove`) |
| `POST /api/note-properties/query` | Up to ten AND-combined `filters`, cursor `after`, `limit` 1–100 |
| `POST /api/note-properties/document` | `{change, markdown, expectedMarkdown}`: values and frontmatter together |

A write batch increments each affected note's version. Any stale version,
missing note, invalid value or unavailable reference rolls back the whole
batch. A `409 PROPERTY_VERSION_CHANGED` means read the current values before
retrying; clients must not overwrite concurrent edits silently.

Query operators are `eq`; `gt`/`gte`/`lt`/`lte` for numbers, dates and
instants; `contains` for multi-select; `exists` and `missing`. `exists`
includes explicit null; ordered comparisons exclude null. Reads, writes,
queries and schema writes are audited with owner attribution but without
values or search terms.

Indexing: the equality/range index is keyed by owner and property key;
multi-select containment has a JSONB GIN index; text equality uses a hash
index plus exact JSONB comparison so values up to 4,096 characters work.
`NotePropertyServiceTest` checks with `EXPLAIN (ANALYZE, BUFFERS)` over 20,000
rows that a selective equality query uses the index. That is a regression
guard, not a latency guarantee.

## Saved property queries

Open **Property queries** (`/app/property-queries`). Choose property columns,
up to ten AND-combined filters, a sort, and an optional grouping property, then
save the query under a title. The same results switch between table, list,
card and board layouts; a board needs a grouping property. Calculated columns
support declarative `sum` (numbers; null if any input is missing) and `concat`
(skips missing inputs). Formulas never execute code.

Click a value to edit it; the edit checks the note version and writes the
value and frontmatter together, as in the property editor. Visible results
refresh every 15 seconds. Saving a stale query revision fails without
discarding your local configuration.

Link to a query with `/app/property-queries?query=<UUID>`, or embed it in a
note:

````markdown
```property-query
01234567-89ab-cdef-0123-456789abcdef
```
````

Embeds enforce the viewer's ownership; a copied query ID grants nothing to
another account.

Paging: 50 rows per page in the UI, at most 100 per request, page numbers up
to 10,000, and a three-second timeout per SQL statement. Sorts break ties by
note ID and put missing values last. Group headers and formulas describe the
current page only. Pages are live reads, so concurrent edits can move a note
between pages.

| Endpoint | Purpose |
| --- | --- |
| `GET`/`POST /api/property-queries` | List or save queries (Flyway V17) |
| `GET`/`DELETE /api/property-queries/{id}` | Read or delete an owned query (revision-checked) |
| `GET /api/property-queries/{id}/results?page=0&limit=50` | Run the query |
| `POST /api/property-queries/import-database` | Database-to-notes migration (below) |

### Linked notes from a database

In an embedded database, expand **Use rows as linked notes** and choose
**Create linked notes and query**. Up to 100 rows and 20 columns become typed
notes in one transaction, with deterministic namespaced property keys, plus a
saved query over them. The original rows are left untouched. Re-running the
import keeps existing notes, your edits, deleted-note tombstones and the query
identity. Schema changes need explicit reconciliation. This is a one-time
migration, not two-way sync: edit the notes afterwards.

## Workspace Tools

Install the **Workspace Tools** pack (`pack-workspace-tools`) from
Marketplace → Packs, or install each plugin on its own. Views appear under
Planning. Definitions:
[`workspaceTools/definitions.ts`](../../frontend/src/features/workspace/workspaceTools/definitions.ts).

| Plugin | Route | Use |
| --- | --- | --- |
| Project Workspaces | `/app/project-workspaces` | Group notes, tasks, decisions, runbooks and evidence per project; export a project |
| Executable Runbooks | `/app/executable-runbooks` | Run a note's checklist, record evidence, invoke manual Blueprints |
| Universal Inbox | `/app/universal-inbox` | Capture text, URLs, files, pasted images, `.eml` files and voice memos |
| Workspace Time Machine | `/app/workspace-time-machine` | Checkpoints; compare and selectively restore |
| Local Folder Bridge | `/app/local-folder-bridge` | Reviewed Markdown sync with a local directory |
| What Changed? | `/app/workspace-briefings` | Changes since your last briefing |
| Living Documents | `/app/living-documents` | Notes with live note excerpts and query results |
| Workspace Capsules | `/app/workspace-capsules` | Portable export/import of notes, relationships, attachments and schemas |
| Decision Journal | `/app/decision-journal` | Decisions with alternatives, evidence, confidence and reviews |

All of these store their history in account-scoped plugin state. Each tool
history record is limited to 1 MB (this bounds run, checkpoint and import
histories, not notes or attachments). Conflicts offer keep-local/use-server;
malformed records block editing and offer a recovery export. Changing account
remounts the views and revokes their state clients.

### Project Workspaces

**New project** takes a name, purpose, status (Active, On hold, Completed,
Archived) and optional deadline. The selected project and section are in the
URL. Projects reference existing notes and records, so a note can belong to
several projects and editing it updates all of them.

| Section | What it does |
| --- | --- |
| Overview | Membership and task progress, overdue tasks, decision reviews, failed runbook receipts, recent notes |
| Notes | Attach or create notes. Detaching removes membership and roles but keeps the note |
| Tasks | Markdown checklists from project notes; completion writes back to the note using its reviewed version. Procedure checklists are excluded so a runbook step cannot be bypassed |
| Decisions | Attach or create Decision Journal records |
| Runbooks | Attach procedure notes; **Start run** opens a project-associated run in Executable Runbooks |
| Evidence | Mark member notes as supporting material |

Notes gain a **Projects** panel for membership. Archived projects are
read-only until their status changes. Deleting a project deletes only its
organization; notes, decisions, attachments and receipts remain. Project
membership is organization, not an access-control boundary. The store holds up
to 500 projects in the `project-workspaces` namespace.

**Export project capsule** preselects member notes, required plugins, and
evidence notes referenced by the project's decisions. It carries membership,
task state, decisions with evidence and review history, runbook procedure
snapshots and receipts. Notes or decisions you cannot access must be detached
first. Importing needs Project Workspaces installed; it creates new notes and
new project/decision/receipt IDs and keeps the original project. Imported
receipts are historical only: they cannot resume workflows. Start a new run to
perform a procedure under the receiving account's grants. Reopening the same
file resumes an interrupted import without duplicating records.

### Executable Runbooks

Write a note with Markdown checklist steps, select it, and choose **Start
run**. A run keeps its own snapshot of the procedure and starts with every step
pending.

```markdown
- [ ] Inspect inputs and attach evidence
- [ ] Review release [blueprint:release-review#manual-review]
- [ ] Verify the deployment
```

A `[blueprint:<name>#<node-id>]` step must name an existing `trigger.manual`
node in a Blueprint the account owns. Manual steps need an explicit completion
checkbox. Automated steps need execution consent and run under the workflow
engine's current grants and approval gates; the source note is passed through
the trigger's `note` output. **Refresh execution** reads the authoritative
status; only `SUCCEEDED` unlocks the next step (failed, cancelled, waiting and
dead-lettered runs do not). After a failure, inspect it and start a new run.
Export receipts before deleting old history; deleting a receipt does not
delete workflow history or cancel a workflow. See
[Workflows and approvals](workflows-and-approvals.md).

### Universal Inbox

Capture text or a URL, pick a file, paste an image, drop an `.eml` file, or
record a voice memo. URLs are stored without fetching the page. Text, Markdown
and email files fill the note body; other formats stay attachments (no OCR or
transcription here). Review suggested tags, a destination tag and properties,
then **File capture**. A failed upload keeps its draft note and pending file
for retry. Files are limited to 10 MB and text bodies to 200,000 characters;
the server's attachment MIME allowlist also applies (see
[Integrations](integrations.md#azure-blob-storage-for-attachments)).

**Document Inbox & OCR** additionally imports text, Markdown, email text, PDF,
PNG, JPEG and WebP: it extracts text, creates a source note with the document
name, checksum and provenance marker, uploads the original, and links them. A
retry reuses the marked note and skips an already uploaded original.

### Workspace Time Machine

A named checkpoint copies notes, tags, graph links, the installed/enabled
plugin list and hub-tab preferences. **Compare and restore** shows current and
saved content; restores use the reviewed note version and reject an
intervening edit. A safety checkpoint is saved before every restore. Missing
notes are recreated with new IDs, which later relationship restores use.

Checkpoints are for recovery in the **same workspace** (they rely on note IDs);
use capsules to move content to another account. They do not roll back
attachment bytes, property values, themes, Blueprints, external services or
arbitrary plugin data. Export and delete old checkpoints before the history
reaches the 1 MB record limit.

### Local Folder Bridge

Needs a browser with the File System Access directory picker (desktop
Chromium) and your permission for the directory; reconnect it after a reload.
Select notes, then **Scan and preview**; apply each direction explicitly. If
both sides changed, compare and choose. Writes are rejected if the file or
note changed since the preview. Missing files or notes are never deleted
automatically. Titles round-trip in a Markdown comment. Attachments are
exported explicitly to `modulo-assets/<note-id>/`; relative asset links are not
rewritten. Scans skip hidden entries and accept at most 1,000 files, 12 levels,
200 KB per file and 10 MB in total. This is reviewed sync, not a file watcher.

### What Changed? and Living Documents

**Mark briefing read** stores the displayed note fingerprints and plugin list
as the next baseline. The briefing shows edits and removals since then,
overdue Markdown tasks, Decision Journal reviews, and up to 100 workflow runs
that failed since the baseline (older failures remain in Executions).

Living Documents adds two fences to ordinary notes:

````markdown
```living-note
123
```

```living-query
00000000-0000-0000-0000-000000000001
```
````

The first shows an excerpt of an owned note, the second a saved property
query. Both refresh every 15 seconds and do not expand nested living
documents. With the plugin disabled they remain plain code blocks.

### Workspace Capsules

Name a capsule, select notes and required plugins, optionally include
attachments, and review the preview (contents, tags, property values and
schemas, attachment names, sensitive-line hints, plugin and pack
requirements) before downloading. The format is plaintext JSON; sensitive-line
detection is only an aid.

Import preflight rejects invalid bundles, references to notes outside the
bundle, oversized attachments, unsupported versions and incompatible schemas
before creating anything. Imports create a separate project, remap graph and
property references and wiki/living-note references, and save progress after
each stage so reopening the file resumes. A completed capsule is not imported
again unless its import receipt is removed. Plugin and pack requirements are
descriptive: capsules never run imported code or grant capabilities. Saved
query IDs, external URLs and inline attachment URLs may still point to the
original workspace.

Limits: 30 MB per capsule, 25 MB of encoded attachments on export, 10 MB per
file. Blueprint definitions, saved queries and arbitrary plugin databases are
not included.

### Decision Journal

Records the chosen option, alternatives, evidence and an evidence note,
assumptions, expected and actual outcomes, confidence and dated reviews.
Export the journal for recovery. Older browser-only decisions have an explicit
preview-and-copy action; the browser journal is never silently assigned to an
account.

## Personal SOPs

Create a procedure with a title, optional instructions, one checklist step
per line, and linked notes. Ctrl/Cmd+Enter saves. Archive procedures you no
longer use and restore them from the archived list.

Starting a run snapshots the title, instructions, steps and note links; later
edits or archiving do not change existing runs. Complete every step to finish
a run, or cancel it with its progress kept. Finished runs are read-only in Run
history. SOPs do not execute Blueprints.

SOPs are stored as the synchronized workspace document
`modulo.workspace.personal-sops` (namespace `personal-sops`); the old
device-only key `modulo-personal-sops-v1` is imported on first use. Concurrent
edits to a procedure or run notes report a conflict instead of overwriting.
Full workspace backups include SOPs, and restoring remaps linked note IDs.

## Full workspace backup and recovery

**Recovery → Full workspace backup** exports every plugin record of the
account as one JSON file and restores it on any device. See
[Mobile and desktop](mobile-and-desktop.md#cross-device-sync-and-recovery) for
how restore and conflicts behave. Notes and attachments are server data and
are covered by the server backup ([Database operations](../operations/database.md)).
