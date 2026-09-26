# Project Workspaces

Install **Project Workspaces** in Marketplace, or install the **Workspace Tools** pack. Open **Planning → Project Workspaces**, or `/app/project-workspaces`.

The plugin installs Notes Editor, Decision Journal, Executable Runbooks and Workspace Capsules as dependencies. Projects reference existing notes and plugin records in the current account. A note or decision can belong to more than one project; editing the source updates every project that references it.

## Create and organize a project

Choose **New project** and enter a name, purpose/outcome, status and optional deadline. Projects can be Active, On hold, Completed or Archived. Use the project selector and search to switch between them. The selected project and section are in the URL, so refresh and back/forward navigation retain the location.

- **Overview** shows membership and task progress, overdue tasks, decision reviews, failed runbook receipts and recently changed notes.
- **Notes** attaches existing notes or creates new project notes. Detaching a note removes its project membership and evidence/procedure roles, but retains the underlying note and attachments.
- **Tasks** reads Markdown checklists directly from project notes. Completion and new tasks write back to the source note using its reviewed version. Tasks support `due:: YYYY-MM-DD` and `📅 YYYY-MM-DD`; examples in code fences are ignored. Procedure checklists are excluded here so completing a task cannot bypass a runbook step.
- **Decisions** attaches existing journal records or creates a decision with an option, expected outcome and review date. Its link opens the real Decision Journal record for evidence, alternatives, confidence and outcome reviews.
- **Runbooks** attaches procedure notes with Markdown checklist steps. **Start run** records a project-associated run and opens it in Executable Runbooks. Actual actions still require the normal manual-step confirmation or Blueprint execution consent. History includes this project's runs and older unassigned receipts for the attached procedure; runs assigned to another project are excluded.
- **Evidence** marks member notes as supporting material. Open the note to inspect its content and attachments. Removing the evidence role keeps the note in the project.

Notes also gain a **Projects** detail panel. It lists project membership and lets you attach the current note or jump to its project. Archived projects remain accessible but their organization is read-only until their status changes. Deleting a project deletes only its organization; source notes, decisions, attachments and runbook receipts remain available.

## Export and restore a complete project

Choose **Export project capsule**. The capsule view preselects the project's member notes and required plugins. It also includes evidence notes referenced by its decisions, even if those notes are not explicit project members. Review contents and optionally exclude attachment bytes before downloading.

The project extension carries:

- Project metadata and note/evidence/procedure membership.
- Markdown task state inside the source notes.
- Linked decision records, supporting evidence and review history.
- Relevant runbook procedure snapshots and execution receipts.
- The capsule's normal internal note relationships, property definitions/values, attachment bytes and plugin/pack requirements.

Unavailable notes or decisions must be detached or made accessible before export. Existing capsule validation still requires all graph and note-property references to remain inside the bundle.

Install and enable Project Workspaces before importing a project capsule. Import creates new notes and fresh project/decision/receipt IDs, remaps membership and decision evidence-note references, and retains the original project. **Open imported project** appears in import history after completion. Imported receipts are historical: they cannot execute or resume workflows and do not link to foreign execution IDs. Start a new run from an imported procedure to perform it again under the receiving account's grants and approvals.

The importer records its destination project ID before creating data and acknowledges each plugin-state stage. Reopening the same file resumes an interrupted import without creating another set of project/decision/receipt records. Legacy capsules without a project extension remain supported.

## Storage and scope

Project organization lives in the account-scoped `project-workspaces` plugin-state namespace; decisions and runbook receipts remain in their existing namespaces. Synchronization conflicts and invalid data use the shared recovery controls. Project views are remounted when the account changes. Metadata edits and note-task writes reject stale changes rather than overwriting them.

The store supports up to 500 projects, bounded by the shared 1 MB record limit. Notes and attachments use their existing storage. This plugin does not migrate the older browser-only PARA, Todo or domain-specific project stores; its task surface uses project-note checklists. Project membership is organization within the current account, not a team permission or access-control boundary.

The existing capsule limitations still apply: Blueprint definitions/code, saved queries and arbitrary plugin databases are not imported by the project extension; external and inline attachment URLs may need updating. See [Workspace Tools](workspace-tools.md) for storage, attachment and capsule limits.
