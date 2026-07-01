# Feature ideas & roadmap

Status: **proposal** · Owner: TBD · Last updated: 2026-06-30

This document scopes candidate features for Modulo, grouped by the existing
capability each one builds on, with enough detail to turn each into a GitHub
issue. It is a planning artifact, **not** an approved roadmap — priorities and
sequencing are still open.

## Why these and not others

Modulo already covers the note-app basics (Markdown editor, full-text search,
tags, `[[wiki-links]]`, the knowledge graph) and a lot more: real-time collab
(Yjs presence/comments/notifications), AI summaries, tasks + Google Calendar,
the Blueprint automation engine, a plugin marketplace, encrypted sharing, and
on-chain / IPFS provenance. The highest-leverage *new* features are therefore
the ones that exploit what makes Modulo different from a plain note app — its
**knowledge graph**, its **provenance infrastructure**, and its **Blueprint
automation engine** — plus the few table-stakes PKM features it is still
missing.

## Priority summary

| # | Feature | Builds on | Effort | Differentiation | Suggested priority |
|---|---------|-----------|--------|-----------------|--------------------|
| 1 | Daily notes / journaling | Templates, CalendarView | S | Low (table stakes) | **P0 — quickest win** |
| 2 | Semantic search + AI auto-linking | OpenAIService, Neo4j, UnlinkedMentions | M–L | High | **P1** |
| 3 | Verifiable version history | BlockchainService, IpfsService | M | Very high (unique) | **P1** |
| 4 | "Ask your notes" (RAG chat) | #2 embeddings, AI summary | M | High | P2 |
| 5 | Note automations / Blueprint triggers | Blueprint interpreter, NoteService | M–L | High | P2 |
| 6 | Canvas / spatial view | Sigma/Graphology graph render | M | Medium | P2 |
| 7 | Public "digital garden" publishing | IpfsService, sharing | M | High | P3 |
| 8 | AI auto-tagging | OpenAIService, TagService | S | Low–Medium | P3 |

Effort: S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks for one engineer.

---

## 1. Daily notes / journaling (P0)

**What** Auto-created, date-stamped notes (`2026-06-30`) reachable from a
calendar picker and a "Today" shortcut, optionally seeded from a template.
Optional periodic notes (weekly/monthly).

**Why** The single most-used feature in Obsidian/Roam/Logseq-style tools, and
Modulo has none. It also gives tasks and meeting notes a natural home.

**Architecture hooks**
- Reuse `frontend/src/features/notes/editor/TemplateManager.tsx` +
  `templateApi.ts` for the daily-note template.
- Reuse `frontend/src/features/tasks/CalendarView.tsx` for the date picker;
  surface a "Today" entry point in the workspace nav.
- Backend: a `GET /api/notes/daily/{date}` "get-or-create" endpoint on
  `NoteController` backed by `NoteService`; idempotent on date + owner.
- Tag daily notes with a reserved tag (e.g. `daily`) so the graph and search
  treat them as a first-class collection.

**Scope cuts for v1** No periodic (weekly/monthly) notes; no rollover of
unfinished tasks. Ship daily-only, add periodic later.

**Open questions** Timezone source of truth (client vs. server)? Should an
empty daily note be persisted on open, or only on first edit?

---

## 2. Semantic search + AI auto-linking (P1)

**What** Compute an embedding per note; offer (a) "search by meaning" that
ranks notes by vector similarity and (b) *suggested* `[[links]]` based on
semantic similarity rather than literal text matches.

**Why** Direct successor to `UnlinkedMentionsService` (which only matches
literal titles). Makes the knowledge graph fill itself in and is the
foundation for #4 (RAG chat).

**Architecture hooks**
- Embeddings via `OpenAIService` (already wraps OpenAI) — add an
  `embed(text)` path; make the provider pluggable for a local model.
- Vector store: either `pgvector` in PostgreSQL (new Flyway migration +
  `vector` column) or vectors on `:Note` nodes in Neo4j. **Recommendation:**
  pgvector, since notes are already the PostgreSQL system of record and Neo4j
  is the projection.
- Recompute embedding on note save (debounced) via `NoteService`; backfill
  job for existing notes.
- New `POST /api/search/semantic` endpoint; a "suggested links" affordance in
  the editor next to the existing unlinked-mentions UI.

**Scope cuts for v1** Suggested links surfaced read-only in a side panel; no
auto-insertion. Single embedding model, no re-ranking.

**Open questions** Per-note embedding cost/rate limits on large vaults?
Privacy: send note text to OpenAI vs. require a local embedding model for
private deployments? (Ties into the data-protection model in the root README.)

---

## 3. Verifiable version history (P1)

**What** Full note revision history with a diff view, where each revision is
hash-chained to the previous one and (optionally) anchored on-chain — turning
the existing single-hash anchor into a verifiable timeline.

**Why** The most differentiated feature in this list. Modulo already anchors a
SHA-256 of note content via `BlockchainService`; almost no other note app can
offer *tamper-evident history*. Plays directly to the provenance positioning.

**Architecture hooks**
- New `note_revision` table (Flyway migration): `note_id`, `seq`, `content`,
  `content_hash`, `prev_hash`, `created_at`, `author`, optional `anchor_tx`.
- Write a revision on save in `NoteService` (or via an entity listener);
  compute `content_hash` and chain `prev_hash`.
- Anchoring is opt-in per note and batched through the existing
  `BlockchainService` / `BlockchainAccessControlService` path; store the tx
  reference on the revision.
- Frontend: a "History" tab on the note view with a revision list, a
  side-by-side / inline diff (reuse an existing markdown-diff lib), "restore",
  and a "verify chain" badge.

**Scope cuts for v1** Off-chain hash chain first (verifiable locally); make
on-chain anchoring a follow-up toggle. Diff for text only.

**Open questions** Retention/compaction policy for long histories? Storage cost
of full-content revisions vs. storing diffs.

---

## 4. "Ask your notes" — RAG chat (P2)

**What** A chat panel that answers questions grounded in the user's own notes,
with citations linking back to source notes.

**Why** Natural extension of the existing AI-summary feature; high user value;
cheap to build *after* #2 provides embeddings + retrieval.

**Architecture hooks**
- Retrieval reuses the #2 vector store; generation reuses `OpenAIService`.
- New `POST /api/ai/ask` endpoint: retrieve top-k notes → prompt with sources →
  return answer + cited note IDs.
- Frontend: a chat surface alongside `features/ai-summary`; render citations as
  links into the workspace.

**Dependencies** Best built on top of #2. **Scope cut:** no multi-turn memory
in v1.

**Open questions** Same provider/privacy trade-off as #2; per-user token
budgeting.

---

## 5. Note automations / Blueprint triggers (P2)

**What** "When a note is tagged `X` (or created/updated), run Blueprint `Y`" —
e.g. summarize it, create a task, or anchor it. Turns Blueprint from a
standalone tool into an automation layer for the whole app.

**Why** Connects two existing systems (Blueprint engine + note lifecycle) into
something neither delivers alone, and is extensible via the plugin marketplace.

**Architecture hooks**
- Emit note lifecycle events (created/updated/tagged) — likely on
  `WebSocketNotificationService` / a new internal event bus — and a
  `trigger` registry mapping events → Blueprint IDs.
- Execute via `BlueprintInterpreterService.java`; reuse the existing
  `SandboxedScriptService` limits (500k instructions / 2s) for safety.
- A "Trigger" node category in `nodeCatalog.ts` / `capabilities.ts`
  (see the "Adding a blueprint node" checklist in `CLAUDE.md`).

**Scope cuts for v1** Tag-added trigger only; synchronous, best-effort
execution; per-user automation cap.

**Open questions** Failure handling / retries / visibility into automation
runs (an audit surface)? Guardrails against trigger loops.

---

## 6. Canvas / spatial view (P2)

**What** A free-form whiteboard (a 5th workspace view alongside Notes, Graph,
Dashboard, Marketplace) where notes are arranged spatially with drawn
connections — Obsidian-Canvas style.

**Why** Reuses the Sigma/Graphology rendering already in the project; gives a
spatial/visual-thinking mode the force-directed graph doesn't.

**Architecture hooks**
- New workspace view registered through the workspace route / `@modulo/core`
  surface (respect the B0 boundary — no deep imports from `features/workspace`).
- Persist canvas layout (node positions, free-floating cards, edges) in a new
  table or as a note of a `canvas` type.

**Open questions** Is canvas a *note type* or a separate entity? Reuse Sigma or
introduce a dedicated canvas lib (e.g. tldraw)?

---

## 7. Public "digital garden" publishing (P3)

**What** Publish selected notes as a public, content-addressed mini-site.

**Why** Turns the existing `IpfsService` provenance infra into a user-facing
publishing flow — a differentiator most note apps can't match.

**Architecture hooks**
- Reuse `IpfsService` for content-addressed publishing and the existing
  `features/notes/sharing` flows for selection/visibility.
- Render a read-only public note view (already partially present:
  `SharedNotePage.tsx`); generate an index page for a published set.

**Open questions** Confidentiality caveat from the root README applies — IPFS
content is **public and unencrypted**; the UI must make that unmistakable.
Custom domains / ENS later.

---

## 8. AI auto-tagging (P3)

**What** Suggest tags from note content on save; user accepts/rejects.

**Why** Small, self-contained, improves graph density and search.

**Architecture hooks** `OpenAIService` for suggestion, `TagService` to apply;
surface inline in the editor near the existing tag UI. Suggestions only — never
auto-apply without confirmation.

---

## Suggested sequencing

1. **#1 Daily notes** — ship the quick win, validate the template/calendar reuse.
2. **#2 Semantic search + auto-linking** — lands the vector store that #4 needs.
3. **#3 Verifiable version history** — the flagship differentiator; independent
   of #2, so it can run in parallel.
4. Then #4 / #5 / #6 as capacity allows; #7 / #8 as polish.

## Next step

Convert the agreed-upon items into GitHub issues (one per feature, linked back
to this doc). Each section above maps to an issue body: *What / Why /
Architecture hooks / Scope cuts / Open questions*.
