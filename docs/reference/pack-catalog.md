# Pack catalog

Every pack that ships with Modulo: its id, the plugins and Blueprints it installs,
and the boundaries it keeps. Use it to pick a pack or to check what an install will
add. How packs work is explained in [Packs](../features/packs.md).

Catalog packs come from `PACKS` in
[`packs.ts`](../../frontend/src/features/workspace/plugins/packs.ts) and are
installed from **Marketplace → Packs**. The plugin lists below are taken from that
file. Installing a pack also installs each plugin's declared dependencies (see
[`catalog.ts`](../../frontend/src/features/workspace/plugins/catalog.ts)). Every
plugin can also be installed, disabled, or removed on its own. Plugin data
belongs to the plugin, lives in authenticated workspace or plugin state (see
[Data and state](../architecture/data-and-state.md)), and survives uninstalling.

Some plugins recur in many packs:

- **Planner** is `daily-notes`, "Planner (Daily Notes)". Its day and week view uses
  eight fixed day blocks.
- **Calendar** is `calendar-view`. It unlocks Planner's month and year modes.

Packs whose records can be scheduled project them into these shared day blocks.
Unless a section says otherwise, a pack connects to no external bank, provider,
authority, or device service. Where an integration is mentioned, it is an optional
future adapter.

The two manifest-v2 reference packs, installed through the **Packs** view, are at
the end.

## Index

| Pack | Id | Category | Blueprints |
| --- | --- | --- | --- |
| [Workspace Tools](#workspace-tools) | `pack-workspace-tools` | productivity | none |
| [Deliberate Learning](#deliberate-learning) | `pack-deliberate-learning` | education | none |
| [Self-hosted Essentials](#self-hosted-essentials) | `pack-self-hosted-essentials` | productivity | none |
| [Connected Foundations](#connected-foundations) | `pack-connected-foundations` | productivity | none |
| [Digital Security & Identity](#digital-security--identity) | `pack-digital-security-identity` | security | none |
| [Personal Finance & Wealth](#personal-finance--wealth) | `pack-personal-finance-wealth` | wealth | none |
| [Research Evidence Lab](#research-evidence-lab) | `pack-research-evidence-lab` | evidence | none |
| [Career Studio](#career-studio) | `pack-career-studio` | career | none |
| [Writing & Publishing Studio](#writing--publishing-studio) | `pack-writing-publishing-studio` | writing | none |
| [Travel & Mobility](#travel--mobility) | `pack-travel-mobility` | mobility | none |
| [Audit Core Viewer](#audit-core-viewer) | `pack-audit-core-viewer` | audit | none |
| [Business Administration](#business-administration) | `pack-business-administration` | business | none |
| [Life OS Integration & Portability](#life-os-integration--portability) | `pack-life-os-integration-portability` | life-os | none |
| [Media Library](#media-library) | `pack-media-library` | media | none |
| [Health & Training](#health--training) | `pack-health-training` | life | none |
| [Home Operations](#home-operations) | `pack-home-operations` | life | none |
| [Reading & Learning](#reading--learning) | `pack-reading-learning` | education | none |
| [Film & Screen](#film--screen) | `pack-film-screen` | media | none |
| [Relationships & Social Life](#relationships--social-life) | `pack-relationships-social-life` | life | none |
| [Creative Studio](#creative-studio) | `pack-creative-studio` | writing | none |
| [Digital Archive](#digital-archive) | `pack-digital-archive` | productivity | none |
| [Collector's Cabinet](#collectors-cabinet) | `pack-collectors-cabinet` | life | none |
| [Freelancer Toolkit](#freelancer-toolkit) | `pack-freelancer-toolkit` | business | none |
| [Travel Journal](#travel-journal) | `pack-travel-journal` | life | none |
| [Homelab & Infrastructure](#homelab--infrastructure) | `pack-homelab-infrastructure` | homelab | none |
| [Wardrobe & Style](#wardrobe--style) | `pack-wardrobe-style` | style | none |
| [TTRPG Campaign Studio](#ttrpg-campaign-studio) | `pack-ttrpg-campaign-studio` | ttrpg | none |
| [Music Maker](#music-maker) | `pack-music-maker` | music | none |
| [Electronics Workbench](#electronics-workbench) | `pack-electronics-workbench` | electronics | none |
| [Full-Stack Hobbies](#full-stack-hobbies) | `pack-full-stack-hobbies` | hobbies | none |
| [Research Lab: Information Intake](#research-lab-information-intake) | `pack-research-lab` | research | none |
| [Education System](#education-system) | `pack-education-system` | education | none |
| [Personal Life](#personal-life) | `pack-personal-life` | life | none |
| [Modified PARA](#modified-para) | `pack-modified-para` | para | none |
| [Knowledge Base](#knowledge-base) | `pack-knowledge-base` | productivity | Summarize on save |
| [Project Tracker](#project-tracker) | `pack-project-tracker` | productivity | Tag new notes |
| [Automation Starter](#automation-starter) | `pack-automation-starter` | automation | Scheduled task, Anchor on save |
| [Knowledge Base (v2)](#knowledge-base-v2-manifest) | `org.modulo.knowledge-base` | manifest v2 | none |
| [Security Audit (v2)](#security-audit-v2-manifest) | `org.modulo.security-audit` | manifest v2 | Report approval |

## Workspace Tools

Capture, run procedures, review decisions and changes, compose living documents,
restore checkpoints, and move projects between Modulo and local files.

**Plugins:**

- Markdown Notes
- every entry in `WORKSPACE_TOOLS`: Project Workspaces, Executable Runbooks,
  Universal Inbox, Workspace Time Machine, Local Folder Bridge, What Changed?,
  Living Documents, and Workspace Capsules
- Decision Journal

The tools themselves are described in [Workspace](../features/workspace.md).

## Deliberate Learning

Review decisions against their outcomes, map skill prerequisites, and turn notes
into spaced-repetition cards.

**Plugins:** Markdown Notes, Decision Journal, Skill Tree, Flashcards & Spaced
Repetition.

- **Decision Journal** records the chosen option, alternatives, assumptions,
  expected outcome, confidence, and review date. A review records the actual
  outcome and lessons separately from the original prediction.
- **Skill Tree** connects skills and their prerequisites across education, career,
  and hobbies. It records practice and evidence of mastery. Prerequisite cycles are
  rejected.
- **Flashcards** can create cards from a passage in a note, and each card keeps a
  link to its source note.

## Self-hosted Essentials

Desktop-native replacements for feeds, web archiving, change detection, document
OCR, PDF work, managed files, CalDAV, and ntfy.

**Plugins:** Feeds & Reading Inbox, Web Archive & Read Later, Web Watch, Document
Inbox & OCR, PDF Toolkit, Managed Files, CalDAV Sync, and Remote Notification
Gateway (`SELF_HOSTED_PLUGIN_IDS` in
[`selfHostedTools.ts`](../../frontend/src/features/workspace/selfHostedTools.ts)).

Each tool works locally. Some can also pull from a self-hosted service when one is
configured: Miniflux or RSSHub for feeds, Karakeep or ArchiveBox for archiving,
and changedetection.io for web watching.

## Connected Foundations

Shared services that other plugins build on:

- **Plugins:** Metadata & Artwork Resolver, Media Diary & Reviews, Lists &
  Rankings, Universal Attachments, and Reminders & Notifications
  (`HIGHEST_VALUE_FOUNDATION_PLUGIN_IDS` in
  [`foundationTools.ts`](../../frontend/src/features/workspace/foundationTools.ts)).

## Digital Security & Identity

Security posture tracking that deliberately stays out of secret management.

**Plugins:**

- Security Inventory: accounts, devices, public wallet addresses, identities
- Keys, Backups & Recovery: rotation reminders, backup checks, recovery exercises,
  emergency access
- Incidents & Procedures
- Security Command Center

**No-secret boundary.** Only metadata and references to an external secret
manager belong here. The forms have no password, seed, mnemonic, passphrase, or
private-key fields. Writes to the security store are also rejected when they
contain PEM private-key blocks or common secret-assignment patterns, such as
`password: …` or `seed phrase = …`. Public wallet addresses are allowed.

## Personal Finance & Wealth

Provider-neutral balance sheet and cash flow.

**Plugins:**

- Accounts, Assets & Liabilities
- Cash Flow & Savings
- Investments & Goals
- Wealth Dashboard

Values are manual snapshots. The pack does not connect to banks or brokers,
initiate transactions, store banking credentials, calculate tax, or give financial
advice.

## Research Evidence Lab

Durable evidence structure for research.

**Plugins:**

- Sources & Bibliography: papers, books, web sources, datasets, quotations,
  citation keys, locators
- Claims & Evidence Map: claims, supporting evidence and counterevidence,
  confidence, dependencies
- Reproducibility Records: procedures, environments, datasets, versions, commits,
  runs, results
- Evidence Lab Dashboard

Source and claim ids are provider-neutral. A citation manager could later sync
metadata without owning the claims.

## Career Studio

Keeps durable career evidence separate from opportunity execution.

**Plugins:**

- Career Portfolio: roles, CV variants, accomplishments, evidence
- Applications & Interviews: applications, contacts, interview stages, offers
- Professional Development: skills, certifications, mentorship
- Career Dashboard

The pack does not submit applications, contact employers, or scrape job sites.

## Writing & Publishing Studio

A writing pipeline around Markdown Notes.

**Plugins:** Markdown Notes, Planner, Calendar, Manuscripts, Editorial Workflow,
Submissions & Publishing, and Writing Dashboard.

Markdown Notes remains the owner of the prose. The studio stores workflow
metadata, such as versions, feedback, submissions, rights, and word counts, and
links to drafts instead of creating another document format.

## Travel & Mobility

Extends Travel Planner with vehicles and paperwork, without duplicating trips.

**Plugins:**

- Travel Planner: still the owner of trips, bookings, and itineraries
- Planner and Calendar
- Vehicles
- Mileage & Maintenance
- Permits & Transport Passes
- Travel & Mobility Dashboard

No telemetry, insurer, mapping, or transport-operator connections.

## Audit Core Viewer

A read-only frontend for the JSON output of `audit-core`.

**Plugins:**

- Audit Core Browser
- Audit Core Phase Dashboard: `phase-ledger.json`, artifact coverage, waivers,
  compatibility warnings
- Audit Core Scope & Architecture
- Audit Core Threat Model
- Audit Core Findings & Evidence
- Audit Core Tests & Exploits
- Audit Core Severity & Report
- Audit Core Remediation: every artifact in `p9_remediation`

**Opening an output.** Open the Audit workspace, choose **Core Browser**, and
select an output directory. Browsers do not allow silent reads of arbitrary paths,
so the user has to pick the folder. The folder is held only in memory; after a
reload, select it again.

**Data boundary.** The output is never written to, uploaded, or treated as data
Modulo owns. The schema adapter matches on the phase-ledger version and the
artifact path, and falls back to raw JSON, so optional artifacts and new fields
stay visible. JSON files larger than 32 MiB are indexed but not decoded in the
interactive view.

This pack does not install or depend on the older audit plugins (findings tracker,
checklists, vulnerability knowledge base, reports, engagement pipeline).

## Business Administration

German-oriented business administration on top of the existing invoicing, time,
bookkeeping, retention, and tax tools.

**Plugins:**

- Business Directory: clients, contacts, VAT IDs, engagements, pipeline
- Proposals & Contracts: proposals, quotes, contracts, SOWs, NDAs, DPAs
- Expense Inbox & Reconciliation
- Filings & Obligations
- Vendors & Correspondence
- Business Command Center
- Rechnung (German Invoicing)
- Zeiterfassung (Time Tracking)
- Books (EÜR + DATEV)
- GoBD Vault
- Tax Automation
- Planner and Calendar

Tax Automation contributes three Blueprint nodes: `action.tax.deadline.reminder`,
`action.invoice.chase`, and `action.vies.check` (see the
[node reference](blueprint-nodes.md)).

Reconciliation is an administrative matching queue over existing records, not
automated bank reconciliation. Tax summaries, retention defaults, and deadlines
are operational aids, not legal or tax advice.

## Life OS Integration & Portability

A read-mostly command layer across the specialist life plugins. It does not merge
their stores; each plugin stays the source of truth for its records.

**Plugins:**

- Life OS Dashboard
- Universal Explorer: search, activity timeline, artifact gallery
- Cross-Plugin Relations: labelled links between stable entity ids
- Integrated Weekly Review
- Data Health & Portability

**Portability.** JSON backups are identified as `modulo-life-os-backup` and carry
a schema version. A backup contains every recognized specialist store and portable
Markdown bodies for notes. Restore is conservative:

- existing plugin records are kept unless **Replace existing server plugin
  records** is checked;
- notes are only ever added, and exact duplicates are skipped.

CSV and Markdown exports are flat indexes meant for inspection; use JSON for backup
and restore.

## Media Library

One shared library with a focused plugin per format: books, ebooks, audiobooks,
short stories, novellas, essays, articles, comics, manga, magazines, poetry,
movies, TV series, YouTube videos, animation, albums, songs, podcasts, video games,
courses, and live performances.

**Plugins:** Media Library, plus every plugin in `MEDIA_TYPE_PLUGIN_IDS` (see
[`mediaLibrary.ts`](../../frontend/src/features/workspace/mediaLibrary.ts)).

## Health & Training

Appointments, measurements, workouts, meals, habits, recovery, and time-blocked
planning.

**Plugins:** Planner, Calendar, Routines & Habits, Health Tracker, Workout Planner,
and Meal Planner.

## Home Operations

Maintenance, chores, possessions, warranties, household subscriptions, and planned
purchases.

**Plugins:** Planner, Calendar, Home & Maintenance, Home Inventory, Finance &
Subscriptions, and Wishlist & Purchases.

## Reading & Learning

Reading shelves, courses, curricula, study sessions, and learning projects linked
to PARA.

**Plugins:**

- Media Library, with the written-media and course format plugins: Book, Ebook,
  Audiobook, Short story, Novella, Essay, Article, Comic & graphic novel, Manga,
  Magazine & zine, Poetry, and Course
- the [Education System](#education-system) plugins
- Markdown Notes, Modified PARA Core, and PARA Tasks
- Planner and Calendar
- the knowledge-learning plugins: Reading Annotations, Flashcards & Spaced
  Repetition, Learning Goals, Bookmarks & Read Later, and Citation Manager

## Film & Screen

**Plugins:** Media Library, the Movie, TV series, YouTube video, and Animation
format plugins, and Calendar. Covers ratings, watch status, progress, artwork, and
release planning.

## Relationships & Social Life

**Plugins:** Planner, Calendar, Personal CRM, Places Library, Travel Planner,
Journal & Reflection, and Wishlist & Purchases. Covers people, follow-ups, shared
places, trips, reflections, gifts, and plans.

## Creative Studio

Research, references, manuscripts, editorial work, and a creative schedule.

**Plugins:**

- Markdown Notes, Modified PARA Core, and PARA Tasks
- Planner and Calendar
- Media Library
- Information Intake, Daily Briefing, Topic Watchlists, and Newsletter Inbox
- the four Writing & Publishing plugins

## Digital Archive

Durable notes and documents.

**Plugins:** Markdown Notes, Tag Explorer, Semantic Search, PDF Export, GitHub Sync,
IPFS Attachments, and Timestamp Proofs.

## Collector's Cabinet

Catalogs media, possessions, wardrobe pieces, and wanted items, with provenance.

**Plugins:** Media Library and every media format plugin, Home Inventory, Wardrobe,
Wishlist & Purchases, Tag Explorer, and Timestamp Proofs.

## Freelancer Toolkit

Clients, contracts, delivery, opportunities, time, invoices, expenses, filings, and
tax records.

**Plugins:**

- Modified PARA Core and PARA Tasks
- Planner and Calendar
- the four [Career Studio](#career-studio) plugins
- the [Business Administration](#business-administration) plugins, without its
  Planner and Calendar duplicates

## Travel Journal

**Plugins:** Planner, Calendar, Travel Planner, Places Library, Personal CRM,
Journal & Reflection, Media Library, Markdown Notes, and IPFS Attachments. Covers
trips, places, people, reflections, travel media, and attachments.

## Homelab & Infrastructure

Infrastructure as an independent graph: devices, networks, VLANs, VMs, containers,
services, and domains. An operations log records deployments, changes, incidents,
maintenance, backups, restore tests, and experiments.

**Plugins:**

- Hobby Stack
- Planner and Calendar
- Homelab Infrastructure, Homelab Operations, and Homelab Dashboard
- Information Intake
- Home Inventory and Wishlist & Purchases

The dashboard shows degraded or offline assets, failed work, backup coverage for
critical assets, and confidence from restore tests. Research outputs, equipment
ownership, and purchases stay with Information Intake, Home Inventory, and
Wishlist.

## Wardrobe & Style

Keeps the physical closet separate from creative style work.

**Plugins:**

- Hobby Stack
- Planner and Calendar
- Wardrobe: garments, fit, colour, seasons, care state
- Style Studio: outfits, capsules, silhouettes, archetypes, wears, experiments,
  repairs, alterations
- Style Dashboard
- Home Inventory and Wishlist & Purchases

## TTRPG Campaign Studio

System-agnostic campaign management, with no rules engine.

**Plugins:**

- Hobby Stack
- Planner and Calendar
- TTRPG Campaigns: status, system, cadence, players, tone, safety agreements
- World & Characters
- TTRPG Sessions: scheduling, attendance, prep, recaps, consequences, next hooks
- Campaign Dashboard
- Personal CRM
- Markdown Notes

Notes and Personal CRM stay the owners of freeform documents and of people.

## Music Maker

Music production and practice.

**Plugins:**

- Hobby Stack
- Planner and Calendar
- Track Lab: tracks, EPs, albums, sets, modular patches, stages, BPM and key,
  releases
- Instrument Practice: repertoire, theory, ear training, tempo progression
- Music Library & Studio: samples, presets, gear, references, setlists, signal
  chains
- Music Dashboard
- Media Library
- Learning Core
- Home Inventory
- Personal CRM

The reused plugins keep ownership of listening, formal study, insured equipment,
and people.

## Electronics Workbench

The maker flow from idea to finished build: idea, specification, research,
prototype, schematic, PCB, assembly, bring-up, testing, enclosure, done.

**Plugins:**

- Hobby Stack
- Planner and Calendar
- Electronics Projects
- Components & Procurement: parts, stock, BOM lines, vendors, orders,
  substitutions
- Prototype, Build & Test Lab: expected and observed measurements, firmware,
  enclosures, repairs
- Workbench Dashboard
- Information Intake
- Learning Core
- Home Inventory
- Wishlist & Purchases

## Full-Stack Hobbies

Active and queued hobby lanes, six-session experiments, practice in day blocks,
artifacts, fun matched to energy, and social-depth signals.

**Plugins:**

- Modified PARA Core
- Planner and Calendar
- Hobby Stack
- Hobby Practice & Artifacts
- Fun Menu
- Hobby Command Center
- Meal Planner and Workout Planner
- Media Library and Places Library
- Personal CRM
- Wishlist & Purchases and Home Inventory

**Operating rules the UI represents:**

- Keep active and aspirational lanes separate.
- Give an experiment six completed sessions before judging it.
- Make tools, location, and the next task explicit.
- Prefer artifacts over consumption.
- Match sessions to energy.
- Keep at least half of logged play restorative.
- Measure social depth by the people actually present.

**Load documented stack** idempotently merges the owner's documented hobby lanes
into the stack as starter records. It is not an importer.

## Research Lab: Information Intake

Signed-in information intake, with linked Noesis workflow sessions.

**Plugins:**

- Modified PARA Core
- Markdown Notes
- Planner and Calendar
- Information Intake: feed triage and Noesis workflow sessions, with preferences
  in durable plugin state
- Daily Briefing: one deduplicated queue over feeds, newsletters, and web changes
- Topic Watchlists: keyword watches linked to a PARA Area
- Newsletter Inbox

Topic Watchlists depends on Feeds & Reading Inbox and Web Watch, which are
installed with it.

The earlier, browser-local ten-mode intake suite (workbench, outputs, dashboards,
and trails) has been retired. Installations of those plugin ids are rewritten to
Information Intake through `RETIRED_PLUGIN_REPLACEMENTS`, and their browser data
is taken over by Information Intake's legacy importer. Noesis itself is covered in
[Integrations](../features/integrations.md).

## Education System

Structured learning management that does not turn courses into generic PARA tasks.

**Plugins:**

| Plugin | Covers |
| --- | --- |
| Learning Core | Programs and courses, providers, instructors, dates, outcomes, optional PARA links |
| Curriculum | A Program → Course → Module → Lesson → Activity hierarchy with completion |
| Study Planner | Weekly study sessions in the shared day blocks |
| Assignments & Assessments | Exercises, exams, projects, deadlines, submissions, scores, feedback |
| Education Dashboard | Progress, weekly study time, upcoming and overdue work |

All five share one education store (`modulo.workspace.education`). Deleting a
curriculum node also deletes its descendants and their study sessions and
assignments. Learning records can link to PARA Projects, Areas, and Goals while
the education system keeps ownership of them.

## Personal Life

The specialist life plugins behind a **Life** workspace mode. PARA keeps projects
and areas, and each plugin owns its own operational records.

**Plugins:** Planner, Calendar, Routines & Habits, Meal Planner, Workout Planner,
Health Tracker, Home & Maintenance, Home Inventory, Finance & Subscriptions,
Personal CRM, Travel Planner, Hobby Studio, Wishlist & Purchases, Places Library,
Journal & Reflection, and Media Library.

Plugins that support scheduling expose a date, recurrence, optional end date, and
day block. Disabling a plugin hides its view without deleting its data.

## Modified PARA

Canonical PARA plus capture, day planning, routines, meals, workouts, media, goals,
reviews, and a Life Command Center.

**The model:**

- **Projects** are finite outcomes.
- **Areas** are ongoing responsibilities, each with a definition of "under control".
- **Resources** are reference material.
- **Archive** is a recoverable lifecycle view across every type.
- **Tasks** are next actions, with a do date, a deadline, and a day block.
- **Goals & Arcs** give quarterly direction without owning Projects.
- **Reviews** keep the structure trustworthy.
- **Dashboards** are read-only projections; data is never created in a dashboard.

**Plugins:**

- PARA plugins: Modified PARA Core, PARA Capture & Router, PARA Tasks, Goals & Arcs,
  PARA Review Engine, Life Command Center, and Notion PARA Migrator
- Planning: Planner, Routines & Habits, and Calendar
- Life plugins: Meal Planner, Workout Planner, Health Tracker, Home & Maintenance,
  Home Inventory, Finance & Subscriptions, Personal CRM, Travel Planner, Hobby
  Studio, Wishlist & Purchases, Places Library, and Journal & Reflection
- Media Library and Markdown Notes

**Storage boundary.** PARA data is one workspace record (`modulo.workspace.para`).
Routines, meals, workouts, media, and each Life plugin keep separate versioned
stores. They relate to PARA through stable ids and `externalRefs`, such as
`{"pluginId": "fitness", "entityType": "training-block", "entityId": "block-2026-q3"}`,
instead of being forced into the PARA schema. Planner's calendar modes project
dated tasks, meals, workouts, study sessions, and checklist items into one
read-only overview.

**Migrating from Notion:**

1. Export the relevant Notion pages and databases as CSV and Markdown, and unzip
   the export. The browser cannot read ZIP files.
2. Open **PARA → Migrate** and select the CSV and Markdown files together.
3. Review the dry-run counts and any warnings about skipped files, then choose
   **Import and merge**.
4. Afterwards, check **PARA → Review** for Projects without next actions, neglected
   Areas, and orphan Resources.

The importer recognizes Tasks, Projects, Areas, Resources, Sources, Notes, Ideas,
Goals, Arcs, and Reviews. It maps common Notion properties, including the Task
`Block` select, recovers relations by title, and assigns stable source ids.
Re-importing replaces matching records and leaves unrelated data alone. Unknown CSV
databases are reported and left untouched.

## Knowledge Base

**Plugins:** Markdown Notes, Knowledge Graph, and Obsidian Outline.

**Blueprint template, "Summarize on save":** `trigger.note.saved` →
`action.ai.summarize`. It needs `ai:invoke`.

## Project Tracker

**Plugins:** Markdown Notes and Embedded Databases (tables and boards).

**Blueprint template, "Tag new notes":** `trigger.note.saved` → `action.tag.add`.
It needs `notes:write`. The template does not set a tag; set one before relying
on it.

## Automation Starter

**Plugins:** Markdown Notes.

**Blueprint templates:**

- **Scheduled task:** `trigger.schedule` → `action.code.execute`. It needs a cron
  on the trigger, code on the node, and `code:execute`.
- **Anchor on save:** `trigger.note.saved` → `action.note.anchor`. It needs
  `blockchain:anchor`.

## Knowledge Base (v2 manifest)

[`shared/packs/knowledge-base.v2.json`](../../shared/packs/knowledge-base.v2.json),
id `org.modulo.knowledge-base`, version 1.0.0. The reference manifest for the
**New Knowledge Base draft** in Pack Studio.

**Resources:**

- a record property schema
- a record template
- an "Open records" saved query
- a table view and a status-board view
- an overview dashboard
- a Knowledge Base workspace mode
- optional demo records

**Capabilities:** `dashboard:configure`, `notes:write`, `properties:schema`,
`queries:write`, `templates:write`, `workspace:configure`.

## Security Audit (v2 manifest)

[`shared/packs/security-audit.v2.json`](../../shared/packs/security-audit.v2.json),
id `org.modulo.security-audit`, version 1.1.0. It backs the **Security Audit**
workspace view and the **New Audit draft** in Pack Studio.

**Resources:**

- everything in the Knowledge Base manifest, applied to findings: finding
  template, open findings query, table and board views, dashboard, workspace mode,
  and demo records
- templates, saved queries, and views for engagement intake, audit checklists,
  vulnerability knowledge, and audit reports
- the "Report approval" Blueprint, which uses the human-approval nodes
- a review-consent permission preset

**Capabilities:** the Knowledge Base set plus `approval:request`,
`blueprints:write`, and `permissions:request`.

The guided journey, demo engagement, and receipt verification are described in
[Packs](../features/packs.md#security-audit-pack-journey).
