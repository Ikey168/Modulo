# Blueprint node reference

Every node type the Blueprint editor and interpreter know about: its pins, the
capability it needs, the configuration it reads, and which plugin puts it in the
palette. Use it when you build or review a Blueprint, or when you add a node. For
how Blueprints work overall, see [Blueprints](../features/blueprints.md).

The tables are generated from the frontend descriptors, which are the source of
truth for pins and titles:

- [`nodeCatalog.ts`](../../frontend/src/features/blueprint/nodeCatalog.ts): `CORE_NODES` and `NOTES_NODES`
- [`auditAutomationNodes.ts`](../../frontend/src/features/blueprint/auditAutomationNodes.ts): `WEBHOOK_NODES`, `DIGEST_NODES`
- [`taxAutomationNodes.ts`](../../frontend/src/features/blueprint/taxAutomationNodes.ts): `TAX_NODES`
- [`noesisNodes.ts`](../../frontend/src/features/blueprint/noesisNodes.ts): `NOESIS_NODES`

Execution is in
[`BlueprintInterpreterService`](../../backend/src/main/java/com/modulo/blueprint/interpreter/BlueprintInterpreterService.java),
and capabilities in
[`BlueprintNodeRegistry`](../../backend/src/main/java/com/modulo/blueprint/BlueprintNodeRegistry.java).
All nodes listed here are version 1.

## Pins and types

Each node has execution pins and data pins.

- **Exec pins** decide when a node runs. A node has at most one exec input.
  Triggers have none, because they are entry points. A node can have several
  named exec outputs, such as `then`, or `true`/`false`.
- **Data pins** carry typed values. A source type must be assignable to the
  target type: the types are equal, or one side is `any`.

| Data type | Meaning |
| --- | --- |
| `string`, `number`, `boolean` | Primitive values |
| `note` | One note |
| `noteList` | A list of notes |
| `tag` | A tag |
| `link` | A note-to-note link |
| `user` | A user reference |
| `approvalRequest` | A reference to a pending human-approval request |
| `approvalDecision` | A reference to a committed approval decision |
| `any` | Wildcard, assignable in both directions |

Type ids are open strings, so a plugin can add its own.

## Availability

**Core** nodes are always in the palette, and the backend registers them under the
`modulo-core` owner. Every other node is contributed by a workspace plugin. It
appears in the editor palette only while that plugin is installed (see
[Plugins](../features/plugins.md)). The backend still executes the built-in
handlers for these nodes, so saved Blueprints keep running, with their capability
checks, even after the plugin is uninstalled.

## Triggers

| Type | Title | Exec out | Data outputs | Config | Provided by |
| --- | --- | --- | --- | --- | --- |
| `trigger.manual` | On Manual Review | `then` | `note: note` | none | Core |
| `trigger.schedule` | On Schedule | `then` | `firedAt: string` (ISO timestamp) | `cron` (six-field Spring cron), `zone` (IANA, default `UTC`), `retryMaxAttempts` (1–5, default 1), `retryBackoffSeconds` (5–3600, default 30) | Core |
| `trigger.note.saved` | On Note Saved | `then` | `note: note` | none | `notes-editor` (Markdown Notes) |
| `trigger.link.created` | On Link Created | `then` | `link: link`, `source: note`, `target: note` | none | `notes-editor` (Markdown Notes) |
| `trigger.webhook` | On Webhook | `then` | `payload: string` | `secret` (required) | `webhook-trigger` |

How each trigger fires:

| Type | Fires on |
| --- | --- |
| `trigger.manual` | `POST /api/blueprints/{name}/run` with `confirmed: true` and a note owned by the caller |
| `trigger.schedule` | The durable workflow scheduler, from the persisted cron definition |
| `trigger.note.saved` | `note.created` and `note.updated` bus events for notes owned by the Blueprint owner |
| `trigger.link.created` | `link.created` bus events where both notes belong to the Blueprint owner |
| `trigger.webhook` | `POST /api/public/blueprints/webhook/{blueprintId}/{nodeId}` with a matching `X-Webhook-Secret` header |

## Actions

| Type | Title | Data inputs | Data outputs | Capability | Provided by |
| --- | --- | --- | --- | --- | --- |
| `action.code.execute` | Custom Code | `note: note` | `output: string` | `code:execute` | Core |
| `action.wasm.execute` | WASM Module | `note: note` | `output: string` | `wasm:execute` | Core |
| `action.approval.request` | Request Approval | `context: any` | `request: approvalRequest` | `approval:request` | Core |
| `action.note.create` | Create Note | `title: string`, `content: string` | `note: note` | `notes:write` | `notes-editor` (Markdown Notes) |
| `action.tag.add` | Add Tag | `note: note`, `tag: string` | `note: note` | `notes:write` | `notes-editor` (Markdown Notes) |
| `action.note.anchor` | Anchor On-Chain | `note: note` | `txHash: string` | `blockchain:anchor` | `notes-editor` (Markdown Notes) |
| `action.ai.summarize` | Summarize (AI) | `note: note` | `summary: string` | `ai:invoke` | `notes-editor` (Markdown Notes) |
| `action.audit.reaudit` | Create Re-audit Note | `engagement: string`, `payload: string` | `note: note` | `notes:write` | `webhook-trigger` |
| `action.audit.digest` | Findings Status Digest | `engagement: string` | `summary: string`, `note: note` | `notes:write` | `scheduled-digest` |
| `action.tax.deadline.reminder` | Tax Deadline Reminder | none | `deadlines: string`, `note: note` | `notes:write` | `tax-automation` |
| `action.invoice.chase` | Chase Overdue Invoices | none | `overdueCount: string`, `draftsCreated: string` | `notes:write` | `tax-automation` |
| `action.vies.check` | VIES VAT-ID Check | `vatId: string` | `valid: boolean`, `status: string`, `checkedAt: string` | `network:vies` | `tax-automation` |
| `action.noesis.brief` | Noesis Daily Brief | `domains: string`, `since: string` | `title: string`, `markdown: string`, `status: string`, `itemCount: string` | `network:noesis` | `noesis-brief` |

Every action has one exec input and a `then` exec output.

### Action behaviour and configuration

| Type | Behaviour | Config |
| --- | --- | --- |
| `action.code.execute` | Runs a JavaScript function expression, `function(note) { … }`, in the script sandbox. The return value is converted to a string and truncated at 64 KiB. A script error or a limit breach fails the step and the run. See [WASM sandbox](wasm-node-abi.md#the-javascript-sandbox). | `code` (required) |
| `action.wasm.execute` | Runs a compiled WebAssembly module against the note. See [WASM node ABI](wasm-node-abi.md). Validation failures, traps, and limit breaches fail the step and the run. | `module` (base64, required), `moduleName`; the editor also stores `moduleSha256` and `moduleSize` |
| `action.approval.request` | Creates a run-bound approval request for a different user. Connect its `request` output to Wait for Approval. | `approverUserId` (required, must differ from the owner), `expirySeconds` (60–604800, default 86400), `reminders` (0–3), `message`. `approverRole`, `approverGroup`, `quorum` other than 1, and `delegation: true` are rejected. |
| `action.note.create` | Saves a new note. A missing title becomes `Untitled`. | none |
| `action.tag.add` | Creates or reuses the tag and attaches it to the note. | none |
| `action.note.anchor` | Registers the note content hash on-chain and waits up to 30 s. A failure fails the step. | none |
| `action.ai.summarize` | Calls the AI summarizer. A failure fails the step. | none |
| `action.audit.reaudit` | Creates a fix-review intake note tagged `engagement/<engagement>` and `stage/fix-review` that contains the webhook payload. | none |
| `action.audit.digest` | Counts findings by status (open, acknowledged, fixed, verified) across notes tagged `engagement/<engagement>` and writes a digest note. | none |
| `action.tax.deadline.reminder` | Creates one reminder note for the next USt-VA and ZM deadlines, tagged `tax/deadline`, and skips it when a note with the same title exists. This is scheduling help, not tax advice. | `cadence` (`monthly` or `quarterly`), `dauerfrist` (boolean, adds one month to USt-VA) |
| `action.invoice.chase` | Scans ```` ```invoice ```` fences for past-due, unpaid invoices and drafts one payment-reminder note per invoice, tagged `invoice/chase` and deduplicated by title. Nothing is sent. | none |
| `action.vies.check` | Validates a VAT ID against the EU VIES service. `status` is `valid`, `invalid`, or `unverified`. It is `unverified` when VIES is unreachable, so the flow continues. | none |
| `action.noesis.brief` | Fetches the daily brief from the Noesis instance at `noesis.brief.url` (`NOESIS_BRIEF_URL`). `domains` is a comma-separated subset, and empty means all. `since` is an ISO-8601 UTC floor, and empty means the last 24 hours. When Noesis is unreachable, `status` is `unavailable` and the content is empty. | none |

## Logic

| Type | Title | Exec out | Data inputs | Data outputs | Capability | Provided by |
| --- | --- | --- | --- | --- | --- | --- |
| `logic.branch` | Branch | `true`, `false` | `condition: boolean` | none | none | Core |
| `logic.wait` | Wait | `then` | none | none | none | Core |
| `logic.approval.wait` | Wait for Approval | `then` | `request: approvalRequest` | `request: approvalRequest` | none | Core |
| `logic.approval.result` | Approval Result | `approved`, `rejected`, `expired` | `request: approvalRequest` | `decision: approvalDecision`, `approved: boolean`, `outcome: string` | none | Core |
| `logic.notes.filter` | Filter Notes by Tag | `then` | `notes: noteList`, `tag: string` | `result: noteList` | none | `notes-editor` (Markdown Notes) |

| Type | Behaviour | Config |
| --- | --- | --- |
| `logic.branch` | Follows `true` when `condition` is `true`. A missing input counts as `false`. | none |
| `logic.wait` | Saves a checkpoint and pauses the run durably. The scheduler resumes it later, and no thread sleeps. | `seconds` (integer 1–86400, default 60) |
| `logic.approval.wait` | Saves a checkpoint and pauses until the request is decided, expires, or is invalidated. | none |
| `logic.approval.result` | Branches on the recorded outcome. An unknown or missing outcome is an error, never an approval. | none |
| `logic.notes.filter` | Keeps the notes that carry `tag`. | none |

## Capabilities

The capability a node declares is what the owner must grant before it runs. If a
capability has not been granted, the node is skipped: it is recorded as `SKIPPED`
with the code `CAPABILITY_DENIED`, and the flow continues through `then`. The
editor labels each capability through `CAPABILITY_LABELS` in
[`capabilities.ts`](../../frontend/src/features/blueprint/capabilities.ts).

| Capability | Nodes |
| --- | --- |
| `code:execute` | `action.code.execute` |
| `wasm:execute` | `action.wasm.execute` |
| `approval:request` | `action.approval.request` |
| `notes:write` | `action.note.create`, `action.tag.add`, `action.audit.reaudit`, `action.audit.digest`, `action.tax.deadline.reminder`, `action.invoice.chase` |
| `blockchain:anchor` | `action.note.anchor` |
| `ai:invoke` | `action.ai.summarize` |
| `network:vies` | `action.vies.check` |
| `network:noesis` | `action.noesis.brief` |

## Adding a node

1. Add the descriptor to the node set it belongs to. Use `CORE_NODES` only for
   generic workflow primitives. Anything domain-specific goes in a plugin's node
   list and is registered with `ctx.addBlueprintNode` in the plugin's `activate`.
2. Add a label to `CAPABILITY_LABELS` if the node introduces a capability.
3. Implement execution. A built-in node needs a `case` in
   `BlueprintInterpreterService.executeBuiltInNode` and an entry in
   `BlueprintNodeRegistry.CORE_CAPABILITIES` (core) or
   `LEGACY_BUILTIN_CAPABILITIES`. A backend plugin node uses a
   `BlueprintNodeProvider` instead; see
   [Blueprints](../features/blueprints.md#contributing-nodes-from-a-plugin).
4. Bump `version` whenever the pins change. Saved Blueprints reference
   `type@version` and keep resolving to the signature they were built against.
5. Update the node-count expectations in the catalog tests and this page.
