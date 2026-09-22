# Life OS Integration & Portability

This pack adds a read-mostly command layer across Modulo's specialist life systems. It deliberately does not collapse PARA, planning, meals, workouts, research, hobbies, media, or other domains into a single master database. Each plugin remains the source of truth for its own records.

## Included plugins

- **Life OS Dashboard** summarizes indexed records, connected sources, recent activity, cross-plugin relationships, and data-health issues.
- **Universal Explorer** provides one local search, activity timeline, and artifact gallery, with links back to the owning plugin.
- **Cross-Plugin Relations** stores labeled links between stable entity identifiers without modifying either source record.
- **Integrated Weekly Review** captures whole-system signals, wins, friction, and next focus while preserving domain-specific reviews.
- **Data Health & Portability** detects broken cross-links, duplicate titles, and unreadable stores; exports data; and provides inspect-before-restore import.

## Portability contract

The JSON backup format is explicitly identified as `modulo-life-os-backup` and carries a schema version. It contains every recognized local specialist store and portable Markdown bodies for workspace notes. Restoring is conservative by default:

- existing local plugin stores are skipped;
- unknown store keys are reported and ignored;
- notes are additive and exact title/body duplicates are skipped;
- replacing existing local plugin stores requires an explicit checkbox.

CSV and Markdown exports are flat, human-readable indexes intended for inspection or use in other tools. They do not preserve the full specialist schemas; use JSON for backup and restore.

## Architecture

The integration index is generated locally from existing records. Cross-plugin relations and integrated review snapshots live in their own `modulo-life-os-v1` store. This boundary keeps future frontend-specific or independent data silos possible while still giving the user a coherent Life OS surface today.
