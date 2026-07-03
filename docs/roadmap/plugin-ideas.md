# Plugin ideas & catalog candidates

Status: **proposal** · Owner: TBD · Last updated: 2026-07-03

A comprehensive list of **new plugins to consider for Modulo**, grouped by the
category each one lives in and mapped onto the existing plugin infrastructure so
that every entry can become a real backend/renderer/pack plugin, not just a
marketing card. It is a planning artifact, **not** an approved roadmap —
priorities and sequencing are still open.

## Scope & how this relates to what exists

Modulo already ships a plugin system with real extension points, so these ideas
are grounded in the hooks that are actually there:

- **Runtimes** — `JAR` (internal Spring bean), `GRPC`/`REST` (external, isolated
  process), `BLUEPRINT` (a node pack), and **renderer** plugins
  (`NoteRenderer`, e.g. the existing `MindMapRenderer`). See
  `docs/plugins/architecture.md`.
- **Plugin APIs** — `NotePluginAPI`, `UserPluginAPI`, `SearchPluginAPI`,
  `NoteProcessorPlugin`, `UserProcessorPlugin`, `NoteRenderer`.
- **Event bus** — Note (`created/updated/deleted/shared`), Link, User
  (`loggedIn/registered/profileUpdated`), System
  (`started/stopping/configUpdated`), Blockchain
  (`noteRegistered/integrityVerified/transactionCompleted`).
- **Permissions** — `notes.read|write|delete`, `users.read|write|preferences`,
  `attachments.read|write`, `blockchain.read|write`, `system.config`,
  `system.events.publish`.
- **Distribution** — the client marketplace catalogue
  (`frontend/src/features/workspace/plugins.ts`), the Blueprint **Packs** tab,
  submission/validation pipeline, and remote (HTTPS) plugin hosting.

### Already covered — do not re-propose

- **Catalogue plugins today** (`plugins.ts`): Markdown Notes, Knowledge Graph,
  LaTeX Math, AI Summarizer, GitHub Sync, Mermaid Diagrams, PDF Export, Graph
  Analytics, Web3 Identity, Focus Timer.
- **Backend impls today**: `AINotesSummarizationPlugin`,
  `CalendarTaskManagerPlugin`, `MindMapRenderer`, `SampleLoggingPlugin`.
- **Already scoped in `feature-ideas.md`** (tracked there, cross-referenced
  below, not re-detailed here): daily notes, semantic search + AI auto-linking,
  verifiable version history, RAG "ask your notes", note automations / Blueprint
  triggers, canvas view, digital-garden publishing, AI auto-tagging.

Everything below is **new**.

## Legend

- **Runtime** — `JAR` internal · `EXT` external gRPC/REST · `PACK` Blueprint node
  pack · `RENDER` `NoteRenderer` · `UI` frontend-only marketplace plugin.
- **Effort** — S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks for one engineer.

## Priority summary — top picks

| # | Plugin | Category | Runtime | Effort | Differentiation | Priority |
|---|--------|----------|---------|--------|-----------------|----------|
| 1 | Backlinks & local-graph panel | knowledge | UI | S | Table stakes | **P0** |
| 2 | Kanban board renderer | render | RENDER | M | Medium | **P0** |
| 3 | Web clipper (browser → note) | integration | EXT + ext | M | High | **P1** |
| 4 | Spaced-repetition / flashcards | productivity | JAR + UI | M | Medium–High | **P1** |
| 5 | Local-LLM (Ollama) AI provider | ai | EXT | M | High (privacy) | **P1** |
| 6 | OpenTimestamps notarization | provenance | JAR | S–M | Very high (unique) | **P1** |
| 7 | Zotero / bibliography | integration | EXT | M | High (research) | P2 |
| 8 | Audio transcription (Whisper) | ai | EXT | M | High | P2 |
| 9 | Table / database view renderer | render | RENDER | L | High | P2 |
| 10 | Webhook + HTTP Blueprint pack | automation | PACK | S | High | P2 |

---

## 1. Editor & rendering plugins

Custom visualizations via the `NoteRenderer` interface (same slot as
`MindMapRenderer`) or client-side render plugins in the `render` category.

- **Kanban board** `RENDER` · **M** — parse task lists / front-matter status
  into draggable columns; write status changes back through `notes.write`.
  Highest-value renderer after mind map; pairs with the tasks feature.
- **Timeline / Gantt** `RENDER` · **M** — render dated notes and task ranges on
  a horizontal timeline. Reuses date parsing from daily-notes.
- **Table / database view (Notion-style)** `RENDER` · **L** — treat a set of
  notes as rows with typed columns from front-matter; sortable/filterable grid.
  Flagship renderer; big surface, so scope to read-first for v1.
- **Slides / presentation** `RENDER` · **M** — split note on `---` into a
  reveal.js deck; export ties into PDF Export.
- **Excalidraw / hand-drawn diagrams** `RENDER` + `UI` · **M** — embed and edit
  sketch canvases; store scene JSON as an attachment (`attachments.write`).
- **PlantUML / Graphviz** `RENDER` · **S** — server-side render UML/DOT blocks
  to SVG. Complements the existing Mermaid plugin.
- **Callouts / admonitions** `UI` · **S** — Obsidian-style `> [!note]` blocks in
  the Markdown pipeline (`NoteMarkdown.tsx`). Cheap, high polish.
- **Chemistry & music notation** `UI` · **S** — mhchem (chemical equations) and
  ABC (sheet music) render extensions; small siblings to LaTeX Math.
- **Runnable code blocks** `EXT` · **L** — execute fenced code in a sandboxed
  external service and inline the output. Security-sensitive → external runtime
  with strict isolation, mirror the `SandboxedScriptService` limit posture.

## 2. Knowledge-graph & analytics plugins

Exploit Modulo's Neo4j knowledge graph — its core differentiator.

- **Backlinks & local-graph panel** `UI` · **S** — per-note "linked / unlinked
  mentions" sidebar and a 1–2 hop local graph. Uses `@modulo/core` graph
  queries (`neighbours`, `subgraph`). The most-missed PKM feature; **P0**.
- **Vault Doctor (orphans & dead links)** `JAR` · **S** — scan for orphan notes,
  broken `[[links]]`, and duplicate titles; surface a health report. Subscribes
  to `link.*` events; reuses `UnlinkedMentionsService`.
- **Community / cluster detection** `JAR` · **M** — Louvain/label-propagation
  over the graph to auto-surface topic clusters. Deepens the existing Graph
  Analytics plugin rather than duplicating it (centrality already covered).
- **Nested-tag manager** `UI` · **S** — hierarchical `parent/child` tags with a
  tree view and bulk rename; builds on `TagService`.
- **Related notes** `JAR` · **M** — "you might also link" panel from graph
  proximity + (optionally) the semantic embeddings from `feature-ideas.md #2`.
- **Activity & reading heatmap** `UI` · **S** — calendar heatmap of
  edits/reviews from `last_viewed_at` / revision timestamps.

## 3. AI & semantic plugins

Build on `OpenAIService`; keep the provider pluggable so private deployments can
opt out of cloud calls.

- **Local-LLM provider (Ollama / LM Studio)** `EXT` · **M** — a drop-in AI
  backend so summaries/tagging/chat run against a local model. Directly answers
  the privacy open-question raised in `feature-ideas.md #2/#4`. **P1**.
- **Audio transcription (Whisper)** `EXT` · **M** — upload a recording →
  transcript note; store audio as an attachment. Great meeting-notes on-ramp.
- **OCR: image → text** `EXT` · **M** — extract text from image attachments and
  index it for search (`SearchPluginAPI.indexContent`).
- **Text-to-speech reader** `UI` · **S** — read a note aloud; accessibility win.
- **AI translation** `JAR` · **S** — translate a note, preserving Markdown; new
  note or side-by-side. Thin wrapper over `OpenAIService`.
- **AI writing assistant** `UI` + `JAR` · **M** — inline rewrite / expand /
  grammar with accept-reject, mirroring the auto-tagging accept-reject UX.
- **AI flashcard generator** `JAR` · **M** — turn a note into Q/A pairs that feed
  the spaced-repetition plugin (§5). Emits cards on `note.updated`.
- **Meeting-note structurer** `JAR` · **M** — transcript → decisions / action
  items / attendees; action items become tasks via the tasks feature.

> Note: semantic search, RAG chat, and AI auto-tagging are already scoped in
> `feature-ideas.md` (#2, #4, #8). Package them as `ai`-category plugins when
> built rather than re-specifying here.

## 4. Sync & integration plugins

External `GRPC`/`REST` plugins — the isolated-process runtime exists precisely
for third-party integrations.

- **Web clipper** `EXT` + browser extension · **M** — clip pages/selections to a
  note with source URL and readability cleanup. The single biggest capture
  on-ramp; **P1**.
- **Zotero / bibliography** `EXT` · **M** — import references and cite with
  `[@key]`; render a bibliography. High value for the research audience; **P2**.
- **Readwise / highlights import** `EXT` · **S** — pull book/article highlights
  into notes on a schedule.
- **Obsidian / Notion / Markdown-vault import** `EXT` · **M** — bulk import
  existing vaults (front-matter, attachments, `[[links]]` rewriting). Lowers
  switching cost.
- **Slack / Discord bridge** `EXT` · **M** — capture saved messages to an inbox
  note and push note snippets back to a channel.
- **CalDAV / Outlook calendar** `EXT` · **M** — generalize `CalendarTaskManager`
  beyond Google to CalDAV and Microsoft 365.
- **Jira / Linear task sync** `EXT` · **M** — two-way sync between Modulo tasks
  and an issue tracker.
- **Email-to-note (inbound)** `EXT` · **M** — a per-user address that files
  emails as notes; attachments preserved.
- **RSS reader → notes** `EXT` · **S** — subscribe to feeds; new items land as
  notes for annotation.
- **GitLab / Gitea sync** `EXT` · **S** — sibling of GitHub Sync for non-GitHub
  git hosts.

## 5. Productivity & workflow plugins

- **Spaced-repetition / flashcards** `JAR` + `UI` · **M** — SM-2 review queue
  over cards (authored or AI-generated in §3). New `flashcard`/`review_log`
  tables; a "Review" surface. Strong retention hook; **P1**.
- **Quick capture / inbox** `UI` · **S** — global hotkey capture to a triage
  inbox; feeds daily notes.
- **Habit / streak tracker** `UI` · **S** — checkboxes in daily notes roll up
  into streaks and a heatmap.
- **Outliner mode** `UI` · **M** — collapsible bullet tree with zoom (Logseq
  style) as an alternate editor.
- **Bookmark manager** `EXT` · **S** — save URLs with metadata/preview as light
  notes; overlaps the web clipper but simpler.
- **Writing goals & stats** `UI` · **S** — word-count targets, session stats,
  streaks; complements Focus Timer.
- **Vim keybindings** `UI` · **S** — modal editing in the note editor.
- **Presentation-ready templates gallery** `UI` · **S** — curated template pack
  on top of `TemplateManager`.

## 6. Provenance & Web3 plugins

The most differentiated surface — extend `BlockchainService` / `IpfsService`.
These are things a plain note app fundamentally cannot do.

- **OpenTimestamps notarization** `JAR` · **S–M** — anchor a note's hash to
  Bitcoin via OTS for a free, verifiable timestamp; no gas. Complements the
  existing on-chain anchor and the verifiable-history feature. **P1**.
- **IPFS pinning & content-addressed publish** `JAR` · **M** — pin selected
  notes/attachments and expose the CID; the plumbing under digital-garden
  publishing (`feature-ideas.md #7`). Reuses `IpfsService`.
- **Note NFT minting** `EXT` · **M** — mint a note (or its CID) as an ERC-721 for
  verifiable authorship/ownership; builds on Web3 Identity.
- **Token / NFT-gated notes** `JAR` · **M** — gate note access on wallet
  holdings; ties into `BlockchainAccessControlService`.
- **Verifiable credentials / DID** `EXT` · **L** — issue and verify W3C VCs about
  notes (peer review, sign-off); pairs with Web3 Identity signatures.
- **Multi-party notarization / sign-off** `JAR` · **M** — collect multiple wallet
  signatures before a note is "sealed"; emits a `blockchain.*` event trail.

## 7. Automation plugins (Blueprint packs)

`PACK`-runtime node bundles that extend the Blueprint engine — the automation
layer `feature-ideas.md #5` proposes to wire into note lifecycle.

- **Webhook + HTTP pack** `PACK` · **S** — inbound webhook trigger + outbound
  HTTP request nodes. Unlocks most integrations; **P2**.
- **Scheduler / cron pack** `PACK` · **S** — time-based trigger nodes to run
  blueprints on a schedule.
- **Notification pack** `PACK` · **S** — email / Slack / push action nodes,
  reusing `WebSocketNotificationService`.
- **Data-connector pack** `PACK` · **M** — parameterized (safe) Postgres/Neo4j
  read nodes for building dashboards from the graph.
- **AI node pack** `PACK` · **M** — summarize / tag / embed / classify nodes
  wrapping `OpenAIService` (respecting the sandbox limits).
- **Note-lifecycle trigger pack** `PACK` · **M** — the trigger nodes for
  `feature-ideas.md #5` (on tag/create/update → run blueprint).

## 8. Import / export plugins

Extend the `export` category beyond PDF.

- **DOCX import/export** `JAR` · **M** — round-trip Word via Pandoc/docx4j.
- **EPUB export** `JAR` · **S** — bundle a notebook into an e-book.
- **Anki deck export** `JAR` · **S** — export flashcards (§5) to `.apkg`.
- **Full-vault backup / restore** `JAR` · **M** — export the whole vault
  (notes + attachments + metadata) as a portable archive; import to restore.
- **Academic export (Pandoc → LaTeX/PDF)** `EXT` · **M** — citation-aware export
  with the Zotero plugin for papers.

## 9. Security, privacy & governance plugins

- **Per-note E2E encryption at rest** `JAR` · **L** — client-side encryption for
  selected notes, extending the existing encrypted-sharing model. Note the IPFS
  "public & unencrypted" caveat from the README applies to publishing.
- **Passkeys / WebAuthn + 2FA** `EXT` · **M** — stronger auth alongside Keycloak
  OIDC.
- **Audit-log viewer** `JAR` + `UI` · **S** — surface `plugin_execution_logs` and
  security events (installs, permission grants, remote loads) in-app.
- **PII redaction on export/publish** `JAR` · **M** — detect and mask secrets/PII
  before a note leaves the vault (subscribes to share/publish events).
- **Plugin permission inspector** `UI` · **S** — human-readable view of what each
  installed plugin can access (`plugin_permissions`); trust surface for the
  marketplace.

## 10. Collaboration plugins

Build on the existing Yjs real-time layer.

- **Threaded review / suggestions** `UI` · **M** — comment threads and
  suggest-edit mode on top of Yjs presence/comments.
- **Shared team workspaces** `EXT` · **L** — team-scoped vaults with roles;
  leans on Keycloak groups and `BlockchainAccessControlService`.
- **Public comments on published notes** `EXT` · **M** — moderated comments on
  digital-garden pages (`feature-ideas.md #7`).
- **Presence & shared cursors polish** `UI` · **S** — surface who's viewing/
  editing across the workspace, not just inside one note.

---

## 11. Original / high-novelty plugins — what only Modulo could ship

The plugins above are strong but many exist elsewhere. This section is the
opposite: ideas that fall out of the **intersection** of Modulo's differentiators
— the Neo4j graph, on-chain + IPFS provenance, the sandboxed Blueprint compute
engine, Web3 identity, and Yjs CRDTs — and that a plain note app fundamentally
*cannot* build. Each entry leads with the seam it exploits. Some need new
primitives (a ZK library, an escrow contract); those are flagged, not hidden.

### Boldest bets

| Plugin | Exploits | Runtime | Effort |
|--------|----------|---------|--------|
| ZK proof-of-knowledge | blockchain × zero-knowledge | EXT + contract | L |
| Content-authenticity credentials (human vs AI) | provenance × AI | JAR | M |
| Argument graph + contradiction finder | typed graph × AI | JAR + UI | M |
| Living documents (reactive cells) | Blueprint sandbox × notes | JAR + UI | L |
| Knowledge bounties (staked escrow) | web3 escrow × collab | EXT + contract | L |
| Graph-weighted forgetting curve | graph centrality × review | JAR | M |

### A. Cryptographic knowledge proofs — provenance × ZK × notes

- **ZK proof-of-knowledge** `EXT` + smart contract · **L** — prove *"I held a
  note satisfying predicate P (tagged `patent`, created before date D)"* without
  revealing the note. Turns the existing hash-anchor into a zero-knowledge claim.
  Nobody else has the on-chain anchoring to make this real; foundation for
  prior-art defense, whistleblower timestamps, sealed-bid research.
- **Defensive-publication / prior-art anchor** `JAR` · **S–M** — one click turns
  a note into a timestamped, IPFS-pinned, on-chain-anchored *defensive
  publication* that establishes prior art and blocks others from patenting the
  idea. Reuses `IpfsService` + `BlockchainService`; produces a citable public
  record. A concrete, valuable use of provenance no PKM tool offers.
- **Redactable signed notes (selective disclosure)** `JAR` · **M** — publish a
  note with sections cryptographically blacked out while the *rest* stays
  verifiable against the original signature (redactable signatures / Merkle
  commitments). Journalists shielding sources, legal disclosure, GxP records.
- **Content-authenticity credentials (human vs AI)** `JAR` · **M** — label which
  spans of a note were human-written vs model-generated and anchor a C2PA-style
  content credential on-chain. As AI text floods everything, *provable human
  authorship* becomes the scarce asset — and Modulo already has the ledger.
- **AI model-attestation ledger** `JAR` · **S–M** — every AI summary/tag records
  model, prompt hash, and output hash so any AI-derived content is auditable and
  reproducible. Subscribes to the AI plugins' events; writes `blockchain.*`
  provenance. Compliance-grade AI usage, essentially free on this stack.

### B. The graph as a reasoning substrate — typed edges × Neo4j × AI

- **Argument / claim graph + contradiction finder** `JAR` + `UI` · **M** — typed
  edges (`supports`, `refutes`, `depends-on`, `contradicts`) turn the knowledge
  graph into a reasoning structure; a Cypher/AI pass flags contradictions and
  unsupported claims. The graph stops being a pretty picture and becomes a logic
  engine — only possible because the graph is a first-class Neo4j store.
- **Structural-hole / knowledge-gap finder** `JAR` · **M** — graph topology
  surfaces concepts you reference but never defined, and pairs of clusters that
  *should* connect but don't ("you write about A and B separately — here's the
  bridge you never wrote"). Pure graph-algorithm value, not text search.
- **Ontology induction** `JAR` · **M** — AI proposes a typed schema (entity kinds
  + relationship types) inferred from your unstructured notes, then offers to
  promote free-text links into typed edges. Bootstraps the argument graph above.
- **Devil's-advocate agent** `EXT` · **M** — an agent walks your claim graph and
  attacks the weakest links, citing your own notes. A thinking partner grounded
  in *your* graph, not the open web.
- **Graph-diff / "evolution of my thinking"** `JAR` + `UI` · **M** — snapshot the
  graph structure over time and diff it: which ideas merged, split, or died. A
  changelog for a mind. Needs the graph-as-system-of-record; text history can't
  show this.

### C. Notes as computable, live objects — Blueprint sandbox × notes

The Blueprint engine is really a safe, metered serverless runtime
(`SandboxedScriptService`, 500k instructions / 2s). Point it *at notes* and notes
stop being static text.

- **Living documents / reactive cells** `JAR` + `UI` · **L** — embed sandboxed
  expressions that recompute from other notes and the graph, spreadsheet-style
  (`{{ sum(query('#expense')) }}`). Dashboards, budgets, trackers that stay
  correct on their own. Obsidian bolts this on with plugins; Modulo has the
  sandbox natively.
- **Note-as-API** `JAR` · **M** — publish a note's embedded blueprint as an
  authenticated HTTP endpoint. A note becomes a micro-app: a form handler, a
  calculator, a webhook. Reuses the pack runtime + Keycloak.
- **Autonomous vault agent** `EXT` · **L** — a scheduled agent loop that reads the
  graph, proposes new links/notes/tasks, and leaves an auditable, revertible
  changelog. Guardrailed by the same sandbox limits and a per-run cap.
- **Digital-twin mirror** `PACK` · **M** — Blueprint nodes that mirror an external
  system's state (a repo, a sensor, a market) into graph nodes so you can
  *link your thinking to live data*. The graph becomes a queryable twin.

### D. Knowledge economy — on-chain escrow × collaboration × graph

- **Knowledge bounties** `EXT` + escrow contract · **L** — stake tokens on a
  question note; a smart-contract escrow releases to whoever contributes the
  accepted answer. Turns a shared vault into a market for answers — directly
  enabled by the Hardhat/ERC contracts and Web3 identity already in the repo.
- **Verifiable contribution ledger** `JAR` · **M** — in a co-authored vault,
  record provable per-author attribution (who wrote which hash-anchored revision)
  and compute contribution splits. Co-authored papers, DAO wikis, grant
  reporting — attribution you can *prove*, not just `git blame`.
- **Calibration / prediction staking** `JAR` + `UI` · **M** — attach a dated
  prediction to a note, optionally stake on it, resolve later, and track your
  calibration over time. A personal, provenance-backed forecasting record; the
  on-chain resolution stops you from editing history after the fact.
- **Token-curated knowledge base** `EXT` · **L** — a community curates a public
  set of notes by staking on quality; good curation is rewarded, spam is
  slashed. A self-governing public digital garden.

### E. Privacy-preserving social knowledge — federation × PSI × linked data

- **Private set intersection ("what do we both know")** `EXT` · **L** — two users
  discover shared notes/interests/contacts without revealing their full vaults.
  Serendipitous collaboration without surveillance; needs a PSI service but the
  identity layer is there.
- **Federated cross-vault graph queries** `EXT` · **L** — query a peer's *public*
  subgraph and weave their nodes into yours by reference (content-addressed via
  IPFS). A federation of knowledge graphs, not a walled garden.
- **Linked-data / RDF + ActivityPub publishing** `JAR` · **M** — publish your
  public graph as machine-readable linked data and to the fediverse, so other
  tools (and people) can follow and query it. Your knowledge graph becomes part
  of the web's, uniquely leveraging Modulo's graph-native model.

### F. Novel cognition & interaction

- **Graph-centrality-weighted forgetting curve** `JAR` · **M** — instead of
  reviewing flashcards, resurface *whole notes* ranked by how structurally
  central they are **and** how at-risk of being forgotten. Spaced repetition that
  understands your graph's importance, not just card scheduling. Only works with
  a real graph + review log.
- **Socratic path tutor** `EXT` · **M** — the AI walks you along a path through
  your own graph, quizzing and connecting as it goes — a guided tour of what you
  know that adapts to your answers.
- **Spatial / audio graph navigation** `UI` · **M** — navigate the knowledge
  graph by spatial audio and keyboard, making the graph a first-class,
  accessible surface for low-vision users — a differentiator the force-directed
  view can't offer on its own.

> Reality check: group A and D entries need primitives Modulo doesn't have yet
> (a ZK toolkit, escrow/curation contracts, a PSI service). They are listed as
> *bets*, not quick wins — but each is only a bet **because** the graph +
> provenance + identity foundation is already in place. That foundation is the
> moat these plugins are built on.

---

## Cross-cutting infrastructure this list implies

Several plugins share prerequisites worth funding once, centrally:

1. **Embedding / vector store** (`feature-ideas.md #2`) — unlocks related-notes,
   RAG, semantic search, and better auto-tagging.
2. **Pluggable AI provider abstraction** — one seam behind `OpenAIService` so the
   local-LLM, translation, transcription, and OCR plugins can target cloud *or*
   local backends per deployment.
3. **Attachment pipeline** — transcription, OCR, audio, and Excalidraw all need
   first-class binary attachments (`attachments.read|write`).
4. **Frontend renderer registry** — a clean client slot to mount `NoteRenderer`
   output (kanban/table/timeline/slides) alongside the Markdown view, respecting
   the B0 `@modulo/core` boundary (no deep `features/workspace` imports).
5. **Client marketplace ⇄ backend registry wiring** — `plugins.ts` is still a
   static, client-only catalogue; connecting it to `plugin_registry` +
   `PluginRepositoryService` makes every idea here installable for real.

## Suggested sequencing

1. **Quick wins first** — Backlinks panel, callouts, Vault Doctor, Kanban
   renderer: high value, small surface, no new infra.
2. **Capture & privacy** — Web clipper + Local-LLM provider: the two that most
   change who can adopt Modulo (capture on-ramp; private deployments).
3. **Provenance flagships** — OpenTimestamps + IPFS pinning: cheap ways to make
   the differentiator tangible, independent of the AI track.
4. **Then the vector-dependent AI plugins** once the embedding store from
   `feature-ideas.md #2` lands (related-notes, flashcards, RAG packaging).

## Next step

Triage this catalogue with `feature-ideas.md`, pick a first wave, and convert
each chosen plugin into a GitHub issue using the plugin contract
(`docs/plugins/development-guide.md`): *What / Runtime & type / APIs & events /
Permissions / Effort / Open questions*.
