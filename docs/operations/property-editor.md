# Property editor and Markdown portability

Open a note and expand **Properties**. Every defined property has a value-state control: Missing removes it, Null stores an explicit null, and Value enables its type-specific editor. Date inputs represent calendar dates without a timezone. Instants use an explicit UTC ISO 8601 input; note references select an owned note by title and stable ID. **Define a property** offers common key/type suggestions and explicit select choices.

**Save properties and Markdown** atomically writes the property values and the managed `moduloProperties` frontmatter mapping. It checks both the expected note version and the exact stored Markdown body. A conflict retains the local inputs and document. **Load current version, keep input** refreshes property concurrency state; it does not bypass the document-body check. If another editor changed the Markdown, reconcile that document before retrying. Pending Markdown autosave disables property writes.

**Import from current Markdown** stages known property values for review. **Export Markdown with properties** downloads a portable document without saving it. Unknown property keys are reported during import and preserved during export; their internal YAML formatting may normalize. All unrelated top-level YAML fields, comments and the Markdown body retain their original bytes and order, including CRLF line endings. Known property keys serialize in deterministic order.

The supported format is a YAML 1.2 block mapping. Dates remain strings; there is no implicit timestamp conversion. Unknown fields never become indexed properties without a definition. Duplicate keys, aliases, anchors, unsupported tags, non-mapping frontmatter, malformed values, and frontmatter over 64 KiB are reported without modifying input. Flow-style top-level mappings are not rewritten by the editor. Use the ordinary Markdown editor to reconcile unsupported source explicitly.

Example:

```yaml
---
author: Ada
moduloProperties:
  due: 2026-09-06
  status: Open
  owner: 42
---
```

`POST /api/note-properties/document` accepts `{change, markdown, expectedMarkdown}`. It shares the property batch's ownership checks and transaction and records a value-free document-write audit event. The browser acceptance fixture verifies keyboard navigation, labeled controls, saving and overflow at 360 px; component tests verify conflict input retention, and PostgreSQL tests verify atomicity.
