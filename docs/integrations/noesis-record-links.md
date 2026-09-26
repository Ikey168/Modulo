# Noesis from the dedicated Knowledge plugins

Issue: [#474](https://github.com/Ikey168/Modulo/issues/474) (current target:
start Noesis modes from the dedicated Knowledge plugins' own records, not from
a separate intake item). Code: `frontend/src/features/workspace/noesisRecordLinks.ts`,
`NoesisRecordPanel.tsx`.

## Link contract

A link is stored per record and mode in the account's `noesis-links` state
namespace (schema `modulo.noesis.record-link`, version 1):

| Part | Fields | Authority |
| --- | --- | --- |
| Modulo record | issuer, subject, workspace, plugin id, collection, record id | The plugin record stays authoritative for its content and edits |
| Noesis object | kind (`intake-session`), id, revision | Noesis is authoritative for the session and what it produces |
| Link | mode, request key, status, created/updated | Modulo |

The request key is written before Noesis is called and reused on every retry,
so a failed or interrupted start never creates a second session. Opening a
record refreshes each linked session's status and revision from Noesis. Calls
go through the signed-in server bridge (`/api/integrations/noesis/intake`);
Noesis credentials never reach the browser or the phone.

## Where the actions appear

The panel lists the modes the issue assigns to the plugin and offers **Start**
only for modes Noesis reports as startable (`preflight_intake_mode`). When
Noesis is not configured or unreachable, the reason is shown and existing links
stay visible.

| Available on the record page | Plugins |
| --- | --- |
| Yes (shared record page) | feeds-reading-inbox, web-watch, document-inbox-ocr, bookmark-read-later, web-archive-read-later, reading-annotations, evidence-library, evidence-claims, citation-manager, decision-journal, evidence-reproducibility, writing-manuscripts, writing-editorial, writing-publishing, flashcards-spaced-repetition, learning-goals, skill-tree, reminders-notifications |
| Not yet (own editors) | universal-inbox, notes-editor, canvas-board, todo-lists, executable-runbooks, living-documents, personal-sops, education-study, education-assignments, workspace-briefings, workspace-time-machine |

Some plugins in the first row render custom views (the self-hosted tools) and
show the panel only where they open the shared record page.

## Open items

- Noesis does not yet accept a back-reference to the Modulo record in
  `start_intake_mode`; the link is kept on the Modulo side until the shared
  identity contract (Noesis #1580) defines one.
- Plugins with their own editors need the panel placed in those editors.
- The mode-specific follow-ups in the issue (source-revision spans in Reading
  Annotations, durable findings in What Changed?, a Topics & Questions plugin
  if needed) and the live cross-repository journeys remain open.
