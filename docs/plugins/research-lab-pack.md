# Research Lab — Information Intake Modes

This pack implements the workflow documented in [Information Intake Modes](https://app.notion.com/p/3024e837793781c0b8c9f426eb7f6fe9). Its primary job is choosing the correct depth of engagement before information turns into clutter.

## Included surfaces

| Plugin | Contribution |
|---|---|
| Information Intake Router | Fast capture, the ten-mode decision model, timeboxes, PARA links, and downstream routing |
| Mode Workbench | Mode-specific guiding questions, execution checklists, stopping rules, session logs, and transitions |
| Information Outputs | Signals, exploration notes, research bundles, decisions, matrices, solutions, creations, playbooks, retrieval packs, iteration logs, and maintenance reviews |
| Information Intake Dashboard | Backlog, active work, mode distribution, awareness time, Deep Research WIP, transitions, review dates, and maintenance health |
| Research Workflow Dashboard | Cross-stage workload, blockers, review debt, transition history, and output-provenance coverage |
| Projects & Exploration Trails | Bounded questions, scope, definitions of done, three-topic WIP, source/note references, curiosity timeboxes, connections, and parking lots |
| Evidence & Synthesis | Stable references into Evidence Lab sources and claims; known, uncertain, unresolved, contradictory, confidence, and brief fields |
| Decisions & Problems | Decision criteria and options or problem hypotheses, evidence, rationale, verification, and revisit triggers |
| Outputs & Creation | Purpose, audience, acceptance criteria, feedback, validation, and references to Notes, Writing, and durable output artifacts |
| Learning & Transfer | Retrieval prompts, practice conditions, demonstration tests, scheduled review, and stable Education-node links |
| Experiment & Iteration | Hypotheses, baselines, changes, metrics, observations, results, versions, and rollback plans |
| Review & Maintenance | Scheduled health reviews covering stale records, broken links, duplicates, orphans, actions, and promotion destinations |
| Planner and Calendar | Scheduled mode sessions inside the shared eight day blocks |
| Modified PARA Core | Optional Project and Area relationships for created work and durable outputs |
| Markdown Notes | Durable long-form knowledge destination |

The pack does not include a Notion migrator.

## The routing model

1. Urgent or broken → **Problem-Solving**
2. Curiosity without a goal → **Exploration**
3. A choice must be made → **Decision Support**
4. Systematic understanding is required → **Deep Research**
5. Something must be built, written, taught, or shipped → **Creation**
6. Staying current → **Awareness**
7. Knowledge should work without recall → **Externalization**
8. Knowledge should become fluent capability → **Internalization**
9. Reality is testing an existing artifact → **Iteration**
10. The system is stale or messy → **Maintenance**

Awareness and Exploration remain intentionally lightweight. Deep Research keeps a three-active-topic limit and expands into the more detailed Source → Evidence → Concept/Claim → Brief/Model/Map bundle. Problem-Solving optimizes for getting unblocked, while Decision Support is bounded by a documented choice rather than domain completeness.

Every project and intake item has an explicit current mode and suggested next mode. A transition appends an immutable history record with its reason and optional output reference. Each mode exposes completion criteria, and blocked/paused states stay visible rather than silently disappearing from WIP. Records promote into Evidence Lab, Education, Writing, Notes, PARA, or the output library using stable IDs; data is not duplicated between specialist stores.

## Storage boundary

The research surfaces share a versioned `modulo-information-intake-v1` store because mode transitions and output provenance form one workflow. Existing version-1 intake data is parsed with empty workflow collections, so the expansion is backward compatible. Evidence Lab, Education, Writing, PARA, and Markdown notes remain in their own stores; the workflow saves only stable IDs linking back to them.
