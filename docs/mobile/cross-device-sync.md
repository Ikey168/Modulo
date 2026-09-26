# Cross-device synchronization and recovery

Issue: [#496](https://github.com/Ikey168/Modulo/issues/496). Suite:
`frontend/src/__tests__/acceptance/crossDeviceSync.test.ts`.

The journeys run real `PluginStateClient`s: a desktop client on the IndexedDB
queue and an Android client on the SQLite queue behind the native-bridge
contract, against an in-memory server that implements the plugin-state
protocol (optimistic versions, tombstones, listings without tombstones, storage
generation).

| Criterion | Journey | Result |
| --- | --- | --- |
| Desktop data on Android and back, without export | Desktop creates, phone reads and edits, desktop refreshes | Passes |
| Pending edits survive force-stop, no duplicates | Offline edits, client killed, relaunch from the same queue, two sync passes | One server write per record |
| Deterministic conflicts, recoverable data | Different records edited on both devices; same field edited on both | Records merge; same-field edits become a conflict with both versions kept, resolved explicitly |
| Deletes do not reappear | Phone holds a cached record, desktop deletes it, phone reconnects | Tombstone wins; record stays deleted |
| Area checklist edits, including removed requirements | Requirement removed on the phone | Removal reaches desktop |
| Fresh device reconstructs acknowledged data | New replica with an empty queue | All records listed from the server |
| Server outage | Edits while the server is unreachable | Queued, delivered when it returns |
| Server restored from backup | Queued edit meets a new storage generation | Not replayed; surfaced for review with the local value kept |
| Backup and restore for every registered schema | Full workspace backup of one record per registered schema (42), restored into a fresh account on the other platform | Identical records; a second restore writes nothing |

Token expiry and account switching are covered by the auth and state-host
tests: an expired session keeps edits queued (`authService`, transport), and
an account switch closes every client of the previous account
(`legacyMigrationSafety`, `workspaceStateHost`). Migration of browser
`localStorage` with IDs, links and Area checklists is covered by the legacy
import suites (`services/legacy`).

## Conflict handling

For `modulo.workspace.*` documents, a version conflict is first resolved by a
record-level three-way merge (`stateMerge.ts`): changes to different records,
or different fields of one record, are combined. When both sides changed the
same value, nothing is overwritten: the entry is marked as a conflict with the
local and server versions, and the user chooses. Other schemas always go to
review. A server restored from a backup changes the storage generation; queued
edits made against the old generation are never replayed automatically.

## Full workspace backup

**Recovery → Full workspace backup** downloads every plugin record of the
account (all namespaces and schemas, listed by
`GET /api/workspaces/personal/plugin-state`) as one JSON file and restores it on
any device. Restore adds and updates through the normal queue and verifies
that every record reached the server; deleting records absent from the backup
is a separate option limited to the namespaces in the file. Notes and
attachments are server data covered by the server backup
(`deploy/oci/backup.sh`).

## Not verified here

These journeys exercise the same persistence adapters and protocol, but not a
physical device: Android killing the process, the real SQLite plugin and real
network loss are covered by the emulator job and the release checklist (#497,
#498).
