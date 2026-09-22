# Personal SOPs

Install **Personal SOPs** from the Marketplace, then open **Planning → Personal SOPs**.
The plugin depends on Markdown Notes for linked instructions and evidence.

## Procedures and runs

Create a procedure with a title, optional instructions, and one checklist step per
line. Link workspace notes for supporting material. Editing a procedure uses an
explicit Save/Cancel form; Ctrl/Cmd+Enter saves it. Archive procedures you no
longer use, and restore them from the archived list when needed.

Starting a run snapshots its title, instructions, ordered steps, and note links.
Each run has its own progress, notes, and evidence links. Later procedure edits
and archiving leave existing runs intact. Runs remain active across reloads.
Complete every step before completing a run, or cancel it with its progress
preserved. Finished runs are read-only and remain in Run history. Save or cancel
editing run notes before finishing the run.

## Storage and integration

Data is saved on this device in `modulo-personal-sops-v1`. The shared workspace
writer provides failed-save reporting and recovery journaling. Failed saves keep
editors open; concurrent procedure or run-note edits report a conflict instead
of silently overwriting newer text. This version does not synchronize SOPs
between devices or execute Blueprint automations.

Procedures and runs appear in the workspace's cross-plugin index. Data Health &
Portability JSON backups include the complete store. Restore validates its schema
and remaps linked note IDs for both procedures and run snapshots. Uninstalling
the plugin leaves its data on the device. Device storage is not a substitute for
an exported backup.

## Verification

`frontend/src/features/workspace/__tests__/sops.test.tsx` covers independent run
snapshots, completion rules, archive behavior, reload persistence, notes and
links, failed-save retry, malformed storage protection, catalog registration,
and portable restore with remapped note IDs.
