# Tenant ownership migration

Issue #415 makes the authenticated, provisioned account the authority for private
notes, tags, links, files, tasks, offline queues, collaboration and audit access.
The canonical actor is the numeric `users.id` resolved from the verified issuer
and subject (or an authenticated local `UserDetails` principal). Request headers,
request owners and editor names cannot select a different account. Unknown
accounts fail closed; provision their verified provider subject before use.

## Upgrade and legacy records

Stop application writes and back up PostgreSQL, the SQLite offline database and
local/blob attachments together. Restore and rehearse the migration on a copy.
Run the existing schema migration entrypoint through V4 before starting the new
application. Unmanaged databases must pass the immutable V1 baseline check before
adoption. Do not use Hibernate schema updates to adopt PostgreSQL.

V4 splits each shared legacy tag into one tag per owning note account and rewires
the relationships. Tag names can then be independently reused by each account.
Original tags on unowned notes remain intact. Unowned notes and SQLite queue rows
remain inaccessible until reviewed; logging in never claims legacy data.

Historical share tokens and audit actors were derived from caller-supplied
headers. V4 preserves these records but marks them unverified. Owners must create
new share links. Old audit records remain available to database administrators
for historical investigation but are excluded from the user audit API. Do not
bulk-mark them verified. New public share grants resolve their stored, verified
owner explicitly and stop working if the note no longer belongs to that owner.

## Explicit note backfill

Prepare a reviewed UTF-8 CSV with no header, one `note_id,owner_id` per line.
Resolve each target against `public.users` and verified provider subjects. Mixed
workspaces require individual assignments; email or a legacy editor string alone
is not ownership evidence. Keep the mapping with the backup/change record.

Set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and
`SPRING_DATASOURCE_PASSWORD` through your normal secret environment. From `backend`,
with the application stopped:

```sh
mvn -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile=/tmp/modulo-classpath
java -cp "target/classes:$(cat /tmp/modulo-classpath)" com.modulo.migration.OwnershipBackfillTool preview /secure/reviewed-owners.csv
java -cp "target/classes:$(cat /tmp/modulo-classpath)" com.modulo.migration.OwnershipBackfillTool apply /secure/reviewed-owners.csv
```

Preview performs the same validation and relationship changes in a transaction
and rolls it back. Apply commits the complete mapping atomically. Missing notes,
missing users, already-owned notes and duplicate assignments reject the batch.
The tool preserves note IDs and content, resolves tags to the target owner's
namespace and leaves original legacy tags intact. It never transfers owned notes.

Review legacy links and task relationships separately: a relationship crossing
owners is inaccessible. Do not copy another person's task merely to restore a
previously global link. Unassigned records can remain quarantined indefinitely.

## SQLite, files and collaboration

The offline SQLite schema adds nullable `user_id` through its existing schema
updater. Back up the file first and verify `PRAGMA table_info(offline_notes)` after
startup. Assign a legacy row only after checking its `server_id` against the
reviewed PostgreSQL note owner; for never-synced rows review the actual source
account. Use a transaction and an explicit list of row IDs, with
`WHERE user_id IS NULL`. Leave unresolved rows unowned. PostgreSQL's legacy offline
table receives the same column in V4, but does not replace the SQLite backup.

Background jobs without an authenticated principal no longer replay global
queues. Authenticated manual synchronization replays only that account's queue;
per-account locks prevent duplicate concurrent replay. A durable background
worker must carry independently verified owner authority before it is enabled.

Local file URLs now require authentication and are served with `private,
no-store`. The note renderer and attachment panel fetch private bytes with the
login token and revoke temporary image URLs when their account or source changes.
Azure containers are initialized as private; existing container ACLs are reset
at startup. Confirm that the storage identity can change ACLs. Disable public
blob access at the storage-account level and purge any old CDN caches before
reopening service. Previously public cached bytes cannot be recalled by changing
the application alone. Blob download grants are read-only and expire after five
minutes; existing grants remain valid until expiry.

STOMP CONNECT authenticates the login token. Note topics require ownership at
subscription and again on delivery; generic note and notification updates use
private user queues. Expired sockets stop receiving data. Token renewal reconnects
with a new token; switching accounts closes the old client's callbacks.

## Verify before reopening

Use two separately provisioned accounts. Create identically named tags and private
notes, then confirm that lists, searches, caches, exports, task relationships,
attachments and graph paths cannot cross accounts. Attempt forged owner/editor
headers and foreign IDs for reads and mutations. Confirm public shares work only
for newly created verified grants, and audit filters cannot impersonate an admin.
Restore the complete backup to roll back; do not deploy the previous global-access
application over newly private data or selectively roll back only tag mappings.
