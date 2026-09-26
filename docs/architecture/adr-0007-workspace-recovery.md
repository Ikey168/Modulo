# Workspace saving, recovery, and navigation

Status: Implemented

## Note saving

The note editor writes a local draft as text changes and debounces remote saves by 900 ms. One queue per note survives editor navigation, and workspace note updates are serialized as well. A completed request acknowledges only the text it submitted. Edits made during a request are sent afterwards. The editor displays Saved, Unsaved, Saving, or Save failed and offers Retry save. Reconnecting retries outstanding drafts; leaving the page with unconfirmed changes triggers the browser's unsaved-work prompt.

A local persistence failure leaves the draft in memory and displays a warning. Remote saving can still succeed. Previous note text is retained in a device-local revision history, with the most recent 100 versions available from Recovery. Restoring a version uses the same note update path.

## Trash and undo

Recovery is a built-in workspace view. Moving a note to Trash hides its ID on this device without deleting the server note or its links. Restore exposes the original ID and links again. This is device-local Trash; it does not synchronize deletion state to other clients. Exports include trashed notes and restore their state on the destination device.

Shared local stores record a recovery journal before committing a mutation. If the journal cannot be written, the mutation is rejected. Changes in the same synchronous action are grouped, including record deletion and cross-link cleanup. Recovery reverses only the changed fields and records. Unrelated later edits survive; conflicting later edits require undoing the newer change first. Note hierarchy moves use this same write contract.

The journal retains 40 recent edit groups and does not automatically expire groups containing deleted records. Security-tool stores are excluded from the journal to avoid adding copies of sensitive data. Older stores that bypass the shared writer do not gain undo automatically. The recovery journal itself is local and is not included in portable exports.

## Search and record links

Ctrl/Cmd+K and the navigation search button open the command palette. It searches notes, indexed specialist records, and installed views, and exposes quick note capture, recovery, and undo. Quick capture keeps its text after failed requests or closing the dialog, and persists a draft across reloads. Ctrl/Cmd+Enter submits capture.

Note URLs use `?note=<id>`. Specialist URLs use `?record=<encoded entity UID>`. The workspace opens a shared detail sheet for the exact record, including structured fields and cross-plugin relationships. Missing records display an unavailable state. The detail sheet can open the owning collection for editing. These URLs depend on the destination workspace containing the referenced data; they do not make private records public.

## Portable restore

Schema v1 remains readable. New exports include original note IDs, tags, explicit note links, Trash state, and note hierarchy. Unsaved local note drafts take precedence over server text in the export.

Restore validates store shapes and note references before remote creation. Matching title/content pairs reuse existing notes; duplicate source notes retain separate identities. Imported IDs are remapped in structured source-note fields, relationship UIDs, explicit note links, and hierarchy entries. Arbitrary prose and specialist IDs are not rewritten. Old exports without original note IDs remain usable when they contain no note references requiring remapping; otherwise restore reports the missing mapping rather than silently linking to an unrelated note.

Remote note creation, tags, and links happen before plugin-store changes. These remote operations are not a server transaction: a failed attempt may leave successfully imported notes, tags, or links. Retrying reuses those objects. Local store writes roll back to their previous values when a subsequent write fails. The default still restores missing stores only; replacement is explicit in the existing restore interface.

## Verification

Regression tests cover save failures, edits during saves, navigation before debounce, independent-tab drafts, Trash/restore, note moves, conflict-aware undo, quota failures, exact record navigation, quick capture failures, and reference remapping onto new note IDs. Browser checks exercise save/retry, keyboard capture, exact-record search, and mobile dialog sizing.
