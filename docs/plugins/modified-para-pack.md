# Modified PARA plugin pack

The Modified PARA pack installs a cohesive personal-system layer without
turning every future domain into a PARA record. Its canonical model is:

- **Projects** — finite outcomes with a finish line.
- **Areas** — ongoing responsibilities, health, focus, and an explicit
  definition of "under control."
- **Resources** — notes, sources, ideas, and reference material without an
  active commitment.
- **Archive** — a recoverable lifecycle view across all entity types, rather
  than a disconnected content bucket.
- **Tasks** — next actions related to Projects and Areas, with separate do
  dates, deadlines, and Notion-compatible day blocks.
- **Goals & Arcs** — direction spanning Projects and Areas.
- **Reviews** — the maintenance loop that keeps the structure trustworthy.
- **Dashboards** — read-only projections; original data is never created in a
  dashboard.

## Included plugins

| Plugin | Contribution |
|---|---|
| Modified PARA Core | Projects, Areas, Resources, and Archive tabs |
| PARA Capture & Router | Universal inbox and routing into the canonical types |
| PARA Tasks | Next, Waiting, Scheduled, Done, context, energy, priority, do date, deadline |
| Planner (Daily Notes) | One Day / Week / Month / Year surface with eight fixed Notion day blocks, editable Markdown checklists, and PARA task placement |
| Routines & Habits | Flexible recurring schedules, daily targets, streaks, and completion inside shared Planner blocks |
| Calendar | Unlocks Planner's Month and Year modes with day-planner and block-overview popovers |
| Meal Planner | Weekly meals, recipes, pantry-aware shopping generation, store trips, and day-block batch prep with leftover tracking |
| Workout Planner | Weekly sessions by type and day block, with exercise prescriptions and completion tracking |
| Health Tracker | Appointments, medication, symptoms, measurements, care checklists, and private logs |
| Home & Maintenance | Chores, repairs, appliances, warranties, manuals, and service history |
| Home Inventory | Possessions, storage, serials, receipts, lending, and insurance values |
| Finance & Subscriptions | Bills, subscriptions, budgets, savings goals, and payment history |
| Personal CRM | Relationships, birthdays, follow-ups, interactions, and gift ideas |
| Travel Planner | Trips, bookings, itineraries, packing, destinations, and documents |
| Hobby Studio | Projects, practice, skills, materials, equipment, and milestones |
| Wishlist & Purchases | Comparisons, prices, vendors, orders, returns, and warranties |
| Places Library | Saved places, planned visits, ratings, things to try, and visit history |
| Journal & Reflection | Mood, energy, gratitude, prompts, highlights, and lessons |
| Media Library | Written, watched, listened, played, learned, and live media with progress, ratings, and PARA links |
| Goals & Arcs | Core Arc, Goal, and Milestone records related to Projects and Areas |
| PARA Review Engine | Maintenance checklist and structural diagnostics |
| Life Command Center | Unified today agenda, routines and habits, meals and workouts, seven-day outlook, time-sensitive items, quick Life-module links, and the original PARA health lenses |
| Notion PARA Migrator | Dry-run import for CSV, Markdown, and Modulo PARA JSON |
| Markdown Notes | Durable note destination for imported Notion Markdown pages |

The pack is available in **Marketplace → Packs → Modified PARA**. Every module
is still independently installable and follows the normal runtime dependency
rules.

## Storage and extension boundary

The current implementation follows the other client-side workspace plugins and
persists a versioned envelope under `modulo-modified-para-v1` in local storage.
Use **Migrate → Backup** before clearing browser data or changing environments.
The model is deliberately versioned for a later backend store.

Routines & Habits, Meal Planner, Workout Planner, Media Library, and every Life
module use separate versioned stores (`modulo-routines-habits-v1`,
`modulo-meal-planner-v2`, `modulo-workout-planner-v1`,
`modulo-media-library-v2`, and `modulo-life-<plugin-id>-v1`) so their interfaces
can evolve without bloating the canonical PARA model. Other specialist plugins may follow the same boundary
and relate records to PARA through stable IDs and `externalRefs`:

```json
{
  "pluginId": "fitness",
  "entityType": "training-block",
  "entityId": "block-2026-q3"
}
```

The Calendar modes inside Planner keep these stores independent while projecting dated PARA tasks,
meals, workouts, Education study sessions, and daily-note checklist items into
one read-only block overview.

For example, a fitness plugin can own workouts and measurements while linking
a training block to the Health Area and a current Project. It can emit PARA
tasks without forcing workout records into the PARA schema.

## Migrating from Notion

1. Export the relevant Notion pages and databases as CSV and Markdown.
2. Unzip the export locally.
3. Install the Modified PARA pack.
4. Open **PARA → Migrate** and select the CSV and Markdown files together.
5. Review the dry-run counts and any skipped-file warnings.
6. Select **Import and merge**.
7. Review Projects without next actions, neglected Areas, and orphan Resources
   under **PARA → Review**.

The importer recognizes filenames for Tasks, Projects, Areas, Resources,
Sources, Notes, Ideas, Goals, Arcs, and Reviews. It maps common Notion property
names—including the Task database's `Block` select—recovers Project/Area
relations by title, and assigns stable source IDs.
Re-importing an updated export replaces matching source records without
deleting unrelated Modulo data.

ZIP archives are not read directly in the browser; unzip them before selecting
files. Unknown CSV databases are reported in the preview and left untouched.
