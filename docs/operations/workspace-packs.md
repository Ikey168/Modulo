# Transactional workspace packs

Open **Packs** in the workspace, paste a v2 manifest, choose whether to create
optional demo notes, and review the install plan. The plan lists resource changes
and requested capabilities. Applying requires explicit confirmation. Release
history provides rollback plans; uninstall also has a reviewable plan. Operation
history records successes and classified failures.

## Plan and apply

`POST /api/workspace-packs/plans` accepts `{manifest, includeDemo}`. It validates
the v2 contract, resolves local resource order, checks installed dependencies and
resource-kind compatibility, and records an immutable plan. The response includes
an operation UUID, manifest digest, changes, and required capabilities.

`POST /api/workspace-packs/plans/{id}/apply` accepts `manifestDigest` and the exact
`acceptedCapabilities` list from the reviewed plan. It locks the owner's pack
operations, rechecks the active release and dependency snapshot, and applies all
configuration, demo-note, grant, and activation changes in one transaction.
Changed dependencies invalidate the plan instead of silently changing consent.
Concurrent changes for one owner serialize; other owners remain isolated.

A failed stage rolls back the installation transaction and leaves a separate
failed operation record. A process crash before commit leaves the plan reusable;
a retry after a successful commit returns the original result. The previous
release remains active until an upgrade commits. Release versions cannot be
rewritten with different manifest content.

Rollback plans use an existing immutable release. Dependency minimum versions
are rechecked, so rollback cannot break another installed pack's requirements.
Uninstall is blocked while another active pack depends on the target.

## Runtime and ownership

Blueprint definitions and their consented capabilities are persisted atomically.
A durable refresh journal then updates event/webhook listeners on each backend
instance. Each process observes journal revisions independently; one worker does
not consume updates for the others. Listener refresh is idempotent and retried;
after ten failed attempts it remains visible for an explicit retry from the pack
screen. The pending count reflects server acknowledgements, not a cluster quorum.
Scheduling already reads authoritative persisted Blueprint definitions.

Plugin resources bind to an existing **owned, active, digest-pinned deployment**.
Provision the image first. Preflight rejects missing/foreign deployments and
configuration mismatches before applying anything. The pack engine does not run
container deployment side effects inside a database transaction. Removing the
pack removes its binding and leaves the provisioned plugin intact.

Pack-owned configuration is replaceable. User-edited Blueprints are detected by
comparison with their installed baseline and preserved; uninstall detaches them
as user configuration instead of deleting them. A resource marked user-modified
is likewise retained. Stable resource IDs cannot change kind during upgrade.

Demo notes are created only with install-time opt-in. Their identities are tracked
separately, including tombstones for deleted notes. Upgrades, rollback, uninstall,
and reinstall never overwrite or recreate those records. Existing notes and
private plugin operational state are not removed. Demo import is quiet and does
not fire note-created workflows during a partially applied installation.

## APIs and evidence

- `GET /api/workspace-packs`: owner-scoped installations and runtime-pending counts.
- `GET /api/workspace-packs/history?page=0`: bounded operation history.
- `GET /api/workspace-packs/plans/{id}`: the original plan and final status.
- `GET /api/workspace-packs/resources`: available contributions and detached user configuration.
- `GET /api/workspace-packs/{pack}/releases`: immutable release history.
- `POST /api/workspace-packs/{pack}/rollback-plan`: select a release UUID.
- `POST /api/workspace-packs/{pack}/uninstall-plan`: prepare removal.
- `POST /api/workspace-packs/{pack}/retry-runtime`: retry listener reconciliation.

PostgreSQL tests inject failures at every install stage, including after the final
status update but before commit. They check no half-active pack or imported note
remains, failed upgrades retain the previous release, and edited content survives
upgrade/rollback/uninstall/reinstall. Further tests cover consent, duplicate apply,
stale plans, owner isolation, dependency conflicts, pinned plugin prerequisites,
multiple runtime workers, and durable refresh failures. The frontend tests require
plan review and explicit consent and expose failed operations without claiming
success.
