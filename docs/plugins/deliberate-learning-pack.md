# Deliberate Learning

Install **Deliberate Learning** from Marketplace → Packs, or install each plugin individually.

- **Decision Journal** appears in Planning. Record a chosen option, alternatives,
  assumptions, expected outcome, confidence, and review date. The Due filter
  surfaces pending reviews. Reviewing records the actual outcome and lessons
  separately from the original prediction, with a dated history. Decisions can
  be edited, archived, linked to a workspace note, or deleted with confirmation.
- **Skill Tree** appears in Knowledge → Education. Create skills across education,
  career, and hobbies; connect prerequisites in an interactive map; define mastery
  criteria; and log dated practice with durations. Marking a skill Mastered requires
  evidence and mastered prerequisites. Cycles are rejected. A prerequisite must
  be unlinked from dependent skills before it can be deleted.
- **Flashcards & Spaced Repetition** appears in Knowledge → Education. This extends
  the existing plugin and preserves its cards, decks, and scheduling history.
  Choose Create from a note, select text in Source passage, use it as the answer,
  and enter a question. Cards retain a source-note link and can reference a skill.
  Reveal answers before grading Again, Hard, Good, or Easy; review progress and
  deck limits persist. Keyboard shortcuts apply outside form controls and dialogs.

Decision Journal now uses account-scoped synchronized storage, with an explicit
copy action for older browser records. See [Workspace Tools](workspace-tools.md)
for its evidence fields, export, migration, and synchronization behavior.

Skill Tree and Flashcards data is stored locally in the existing versioned Life collections and is included
in Life OS search and JSON backups. Deck review limits are included in backups as
well. Failed writes in the new editors and review queue show an error and retain
the current draft or card. Uninstalling a plugin leaves its data available for
reinstallation. Source-note links use workspace note IDs; importing notes into a
different backend does not remap those IDs. Review dates are in-app dates, not
background notifications, and those two plugins are not synced between devices.
