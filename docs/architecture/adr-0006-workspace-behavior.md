# ADR 0006: Shared workspace behavior

Status: Accepted

## Dates

Use `dayKey(date)` from `noteDates` for a user's local calendar day. `isoDate`
(Planner) and `isoDay` (PARA) delegate to it for compatibility. Keep full UTC ISO
timestamps for instants such as creation, synchronization, and audit timestamps.
Arithmetic on date-only strings stays in `addDays`/`weekOf`, which deliberately
uses UTC internally so daylight-saving changes cannot add or lose a day.

## Local persistence

Specialist stores and the shared Life, Media, Meal, and Workout collections use
`writeWorkspaceJson` and return a success boolean. Change events fire only after
storage accepts a write. `useWorkspaceStore` reads the latest persisted value
before applying functional updates, keeps the last saved state after a failure,
and subscribes to both collection events and `storage` (including backup restores).

The workspace displays a shared failed-save notice until the affected store is
successfully saved. Persistence failure is not a successful edit. This is a local
storage contract; it does not introduce cross-device synchronization.

## Editing

Record sheets, Life collections, and Media Library show read views first, with
explicit Edit, Save changes, and Cancel. New Life and Media records are drafts
until saved. Cancel does not persist a draft. Failed saves keep editors open.
Record sheets await async saves and disable duplicate submission while saving;
callbacks may return false or reject to report failure. Legacy void callbacks
that encounter a local-storage failure also keep their drafts open.

Ctrl/Cmd+Enter submits the active record editor. Enter inside a multiline input
continues to insert a newline. Global canvas and review shortcuts ignore form
controls, dialogs, handled events, key repeats, and IME composition.

## Fields, filters, and empty states

`Field` associates its label with either an existing control ID or a generated ID,
and preserves existing accessible descriptions when adding a hint. `SearchInput`
provides a clear button and Escape-to-clear while retaining input focus.
`EmptyPanel.onReset` exposes a consistent Clear filters action. Empty collections
offer creation; filtered empty lists offer reset. Life and Media use these shared
controls, and the existing view-kit consumers inherit the same behavior.

## Verification

`workspaceConsistency.test.tsx` exercises these contracts, including failed saves,
restore notifications, buffered edits, accessible field labels, search reset,
shortcut isolation, and local-day boundaries. Run its calendar tests in both
positive and negative UTC offsets. The existing workspace house-style checks,
frontend typecheck, ESLint, and unit suite also apply to shared behavior changes.
