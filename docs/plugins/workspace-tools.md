# Workspace Tools

Install **Workspace Tools** from Marketplace → Packs to add all tools below, or install each plugin separately. Their views appear under Planning. Notes Editor is a dependency; runbooks invoke Blueprints already owned by the signed-in account.

| Plugin | Route | Use |
| --- | --- | --- |
| [Project Workspaces](project-workspaces.md) | `/app/project-workspaces` | Organize shared project notes, tasks, decisions, runbooks and evidence; export the complete project |
| Executable Runbooks | `/app/executable-runbooks` | Run a note's checklist, record evidence, and invoke manual Blueprints |
| Universal Inbox | `/app/universal-inbox` | Capture text, URLs, files, pasted images, email files, and recorded audio |
| Workspace Time Machine | `/app/workspace-time-machine` | Save checkpoints and compare/selectively restore notes, graph links, plugin activation, and hub preferences |
| Local Folder Bridge | `/app/local-folder-bridge` | Preview and apply Markdown changes between Modulo and a selected directory |
| What Changed? | `/app/workspace-briefings` | Review note edits, removals, overdue checklist items, decision reviews, workflow failures, and plugin installations |
| Living Documents | `/app/living-documents` | Compose Markdown with live source-note and saved-property-query embeds |
| Workspace Capsules | `/app/workspace-capsules` | Preview/export/import project notes, relationships, attachment bytes, schemas, properties, and pack requirements |
| Decision Journal | `/app/decision-journal` | Record alternatives, evidence, expectations, confidence, and review dates; compare actual outcomes |

## Executable runbooks

Create a note with Markdown checklist steps, then select it in Executable Runbooks and choose **Start run**. A run preserves its own procedure snapshot and starts every step pending, even if the source checklist was checked. Checklists inside code fences are examples and are ignored.

```markdown
- [ ] Inspect inputs and attach evidence
- [ ] Review release [blueprint:release-review#manual-review]
- [ ] Verify the deployment
```

The Blueprint name and trigger node ID must identify an existing `trigger.manual` node. Each manual step requires an explicit completion checkbox. Automated steps require execution consent and use the authenticated workflow engine's current capability grants and approval gates. The source note is passed through the trigger's `note` output. **Refresh execution** reads its authoritative status; only `SUCCEEDED` unlocks the next step. Failed, cancelled, waiting, and dead-letter executions do not count as completion. Execution links open receipts and approvals. Start a new run after inspecting a failed procedure; retries of an uncertain HTTP request reuse its original request ID.

Export receipts before removing old run history. Removing a receipt does not delete backend workflow history or cancel a workflow.

## Capture and filing

Enter text or a URL, select a file, paste an image into the capture form, or record a voice memo. Email capture accepts `.eml`; it does not connect to a mail account. URLs are stored without fetching their pages. Text, Markdown and email files also populate the note body. Other formats remain downloadable attachments; this tool does not perform OCR or transcription.

Review/edit suggested existing tags, add a destination tag, and use the note property panel before choosing **File capture**. Filing marks the inbox record reviewed and retains the note. **Show filed captures** reopens filed records. Failed uploads retain their draft note and keep the pending file in the open view for retry, including recorded audio. Finish the retry before leaving the view.

Attachment uploads require the configured backend attachment storage. Files are limited to 10 MB and text bodies to 200,000 characters. The backend's configured MIME allowlist still applies.

## Checkpoints and restoration

A named checkpoint copies the current notes, tags, graph links, installed/enabled plugin list and hub-tab preferences. Select a checkpoint and **Compare and restore** to inspect current and saved note content. Restores use the reviewed note version; an intervening edit is rejected. A safety checkpoint is saved before every restore. Missing notes are recreated and their new IDs retained for subsequent relationship restoration. Relationships and plugin activation are restored individually.

Checkpoint exports are for recovery in the **same workspace**, because note IDs identify its records. Imported checkpoints are validated and still require individual restore previews. Use capsules for moving a project to another account. Checkpoints do not roll back attachment bytes, structured property-table values, themes, Blueprint definitions, external services, or arbitrary plugin data. Hub-tab preferences are the settings currently included. Export and remove old checkpoints when history approaches the storage limit.

## Folder synchronization

Directory access requires a browser with the File System Access directory picker, such as desktop Chromium, and user-granted directory access. Reconnect the same directory after a reload. **Disconnect folder** retains notes and files and lets you establish a new set of bindings.

Select extra notes to export, then **Scan and preview**. Scans read current server notes and current files. Apply each direction explicitly. If both copies changed, compare them and choose the version to keep. Writes reject local files or server notes changed since preview. New exports select an unused filename. Missing files/notes are not automatically deleted: retain the surviving copy or disconnect the binding.

Titles round-trip in a Markdown comment; the rest of the document remains Markdown. Attachment import/export is explicit through the synchronized-note selectors. Exported assets live under `modulo-assets/<note-id>/`; existing files are preserved. Relative Markdown asset URLs are not rewritten automatically, so connect those references to the exported assets when editing outside Modulo.

Scans skip hidden entries and accept at most 1,000 files, 12 nested directory levels, 200 KB per Markdown file and 10 MB of Markdown in total. This is a reviewed sync operation, not a background file watcher.

## Briefings and living documents

**Mark briefing read** records the displayed note fingerprints and installed-plugin list as the next baseline. Subsequent edits and removals appear on the next visit. Overdue task detection recognizes unchecked Markdown tasks using `due:: YYYY-MM-DD` or `📅 YYYY-MM-DD`. Decision reviews use the enabled Decision Journal. Workflow failures show at most 100 failed runs created since the baseline; older runs that fail later are still accessible in Executions.

Living Documents inserts fences into ordinary notes:

````markdown
```living-note
123
```

```living-query
00000000-0000-0000-0000-000000000001
```
````

The first ID identifies an owned source note; the second identifies a saved property query. Source excerpts and query results refresh every 15 seconds while open. Source excerpts do not recursively expand more living documents. Disable the plugin and its fences remain ordinary Markdown code blocks. Manage queries in Property Queries; edit saved documents in Notes.

## Portable capsules

Project Workspaces can preselect and export a complete project, including membership, decisions and historical runbook receipts. Project imports remap these records into a new project; [see its guide](project-workspaces.md).

Name a capsule, select notes and required plugins, optionally include attachments, then prepare its preview. Review note contents, tags, property values, schema definitions, attachment names, sensitive-line hints, and plugin/pack requirements before downloading. The format is plaintext JSON. Sensitive-line detection is only a review aid.

Import preflight rejects invalid bundles, external graph/note-property references, oversized attachments, unsupported versions and incompatible existing schemas before creating notes. Imports create a separate project, retain originals, remap internal graph and property references, and rewrite included wiki-note/live-note references. Progress is saved after each stage; reopen the same file to resume a partial import. Creation markers allow recovery of a note created before its mapping was acknowledged. Completed capsule IDs are not imported again unless their import receipt is explicitly removed.

Required plugin and pack definitions are descriptive requirements. Install missing plugins through Marketplace; capsules do not execute imported code or silently grant capabilities. Saved-query IDs, external URLs and existing inline attachment URLs can still refer to their original workspace. Attachment files themselves are copied into the new notes' attachment lists. Capsule files are limited to 30 MB, with at most 25 MB of encoded attachment content on export and 10 MB per file.

## Decision journal and storage

The Decision Journal records chosen options, alternatives, supporting evidence, an evidence note, assumptions, expected/actual outcomes, confidence and dated review history. Archive or delete old decisions; export the journal for recovery. Earlier browser-only decisions have an explicit preview-and-copy action. The original browser journal remains intact and is never silently assigned to an account. Other older Life OS surfaces that read the browser journal do not automatically aggregate the new account journal.

Tool histories use the existing plugin-state service, partitioned by origin, identity issuer, account, workspace, namespace and tab replica. Pending changes are persisted locally and synchronize through optimistic versions. Conflicts expose keep-local/use-server actions; malformed records block editing and offer recovery export. Account changes remount plugin views and revoke their state clients. Replica locking preserves unsynchronized changes across immediate reloads while keeping cloned tabs separate.

Each tool history record has a 1 MB limit. This bounds stored run/checkpoint/import histories, rather than note or attachment storage. Capsule import progress additionally waits for server acknowledgement before proceeding. Local files, microphone access and external attachment storage depend on the browser and deployment configuration.
