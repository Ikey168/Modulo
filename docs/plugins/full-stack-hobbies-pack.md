# Full-Stack Hobbies plugin pack

This pack implements the portfolio described in the current [Hobbies architecture](https://app.notion.com/p/2fd4e837793780e6a383fa2296eadbf9), together with the six-session definition of done in [Hobby Lane Reboot](https://app.notion.com/p/e1da78e5749c4af0a330bb559e0c22bc) and the energy-aware recovery model in [Play, Fun & Personal Enjoyment](https://app.notion.com/p/b98058d6053f49e3a68df1c395fac8ef).

## Included hobby plugins

| Plugin | Responsibility |
| --- | --- |
| Hobby Stack | Active and queued lanes, Artifact/Body/People anchors, six-week trials, energy and social modes, frictionless setup, and a pre-selected next action |
| Practice & Artifacts | Planner-block sessions, six-session progress, people present, energy before/after, and tangible outputs |
| Fun Menu | Low/medium/high-energy and solo/social options, restorative and screen flags, and quick session logging |
| Hobby Command Center | Anchor coverage, session-seven readiness, weekly fun blocks, restorative share, artifacts, and people-you-can-text |

The pack also installs the existing Planner, Calendar, Meal Planner, Workout Planner, Media Library, Places Library, Personal CRM, Wishlist, Home Inventory, and PARA Core. Those remain independent specialist stores. Hobby sessions are projected into shared day blocks rather than copying their data into a new calendar.

## Documented-stack starter

The **Load documented stack** action creates local starter records for the fourteen lanes documented in Notion: Tech; Weightlifting; Running; Cooking; Music Production; Guitar + Piano; Reading + Zettelkasten; Urbex; Fashion + Style; Makerspace + Modular Synths; TTRPGs; Combat Sports; Bouldering; and Fermentation. It is idempotent and is not a Notion importer or migrator.

The initial Artifact, Body, and People anchors are Tech, Weightlifting, and Urbex. They are defaults, not hard constraints, and can be edited in the Stack view.

## Operating rules represented in the UI

- Keep active and aspirational lanes visibly separate.
- Give an experiment six completed sessions before evaluating it.
- Remove setup friction by making tools, location, and the next task explicit.
- Prefer artifacts—tracks, modules, meals, notes, photos—over passive consumption.
- Match sessions to available energy and protect two intentional fun or recovery blocks per week.
- Keep at least half of logged play restorative.
- Measure social depth with actual people present, surfaced as “people I can text.”
