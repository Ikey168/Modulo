# Operational record storage

Issue: #422. The inventory below covers the shipped Productivity and Business
consumers, including their note panels and invoice renderer.

| Browser source | Durable destination | Classification |
| --- | --- | --- |
| `modulo-todos` | `todo-lists/record.<id>`, `modulo.todo` v1 | One document per personal task. These string-ID tasks are distinct from the existing relational task API; this migration does not copy relational tasks. Note links resolve through the authorized note API. |
| `modulo-time-entries` | `zeiterfassung/record.<id>`, `modulo.time-entry` v1 | One work-entry document per stable ID. |
| `modulo-euer-expenses` | `euer-datev/record.<id>`, `modulo.expense` v1 | One editable expense worksheet record per ID. |
| `modulo-euer-categories` | `euer-datev/categories`, `modulo.expense.categories` v1 | Bounded ordered configuration. |
| `modulo-euer-exported` | `euer-datev/exported-periods`, `modulo.expense.exported-periods` v1 | Advisory export history; concurrent edits require conflict resolution. |
| `modulo-invoice-seller` | `rechnung/seller`, `modulo.invoice.seller` v1 | Issuer profile configuration. |
| `modulo-gobd-classes` | `gobd-vault/classes`, `modulo.retention.classes` v1 | Ordered retention configuration. |
| `modulo-pipeline-stages` | `kanban/stages`, `modulo.pipeline.stages` v1 | Ordered pipeline configuration. |
| Invoice fences, income, engagement stages, retained documents and attachments | Existing owner-scoped notes, tags and attachment APIs | First-class domain data, already persisted. No second invoice or document database is introduced. |

The expense worksheet and export-warning flags are editable planning data. They
are not an immutable posted ledger. Regulated posting, legally enforced retention,
atomic invoice-number allocation and payment reconciliation require first-class
transactional domain services. Existing note anchoring remains the integrity
mechanism for finalized documents; this migration does not certify compliance.
Unpublished local workspace experiments are outside this shipped-store inventory.

## Migration and synchronization

Every store exposes an explicit **Import into this account** action. Browser-global
legacy values are never silently adopted by the next signed-in account. Validation
covers the whole source before writes, including duplicate IDs; original IDs are
preserved. Imports are create-only and retain source bytes when the server differs,
the client is offline, or any write remains pending or conflicted. A synchronized
migration marker precedes removal, and removal checks that another tab has not
changed the source. Recovery export contains plaintext legacy bytes, local edits
and the owner-partitioned cache.

Tasks, time entries and expenses use independent record keys. Saving a displayed
collection touches only changed or explicitly removed records, so unseen remote
records are preserved. Writes retain the displayed baseline when a shared cache
refreshes before a queued edit; a conflict preserves local, cached and server
values for review. Network conflicts use the existing versioned offline queue.
Configuration documents use the same account-partitioned cache and explicit
conflict controls. Logout closes clients and account changes reset task drafts,
running timers and seller forms.

DATEV CSV and invoice-line generation retain their calculation and escaping rules.
The same record content produces the same exports after migration; expense
collections are read in stable ID order. Invoice content remains in notes and
ZUGFeRD generation uses the synchronized seller profile. An exported-period flag
is a warning to the user, not a transactional guarantee that a recipient received
or accepted a file.

## Authorized automation

The API from [plugin-state-api.md](plugin-state-api.md) provides read/write/list and
CAS operations for these namespaces. An external workload requires its registered
namespace identity, active runtime and durable state permissions, and a separate
revocable owner grant. For example, an authorized `zeiterfassung` workload writes
`record.te-123` using schema `modulo.time-entry`, version 1; it cannot select another
plugin's namespace or another owner. Built-in schemas are namespace-bound and
server validation covers dates, types, bounds and entity-key agreement.

Arbitrary Blueprint nodes cannot borrow a browser session to access this data.
Blueprint execution integration is implemented through the separately tracked
execution and permission boundary; the external-plugin state contract already
supports authorized automation as required by #422.
