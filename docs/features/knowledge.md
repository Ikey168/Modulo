# Knowledge

This page covers how Modulo connects and retrieves what is in your notes: the
note link graph, semantic search with local embeddings, Ask Modulo cited
answers, suggested links, AI summaries, the Knowledge navigation by
information mode, and the Awareness plugins. It is for users of those features
and for operators who configure the indexing worker.

Typed properties and saved queries are part of the [Workspace](workspace.md#typed-note-properties).
The Noesis bridge that drives the Information Intake modes, and the Gmail
newsletter connector, are in [Integrations](integrations.md).

## Knowledge graph

PostgreSQL stores notes and their links (`application.note_links`), and every
graph feature reads from there. There is no separate graph database.

- The note panels show **Links to** and **Backlinks** from the note's link
  records (`/api/note-links`).
- The workspace **Graph** view (`graph-view` plugin) is built client-side from
  notes and links through `@modulo/core` graph queries (`buildGraph`,
  `neighbours`, `subgraph`, `filterGraphByTags`).

### Backlinks, mentions and related notes

| Endpoint | Returns |
| --- | --- |
| `GET /api/graph/notes/{id}/unlinked-mentions` | Notes that mention this note's title without linking (PostgreSQL scan; word-boundary matching, excludes self and already-linked notes) |
| `POST /api/graph/notes/{id}/link-from/{sourceId}` | Turns a mention into a link |

Both endpoints are in
[`GraphController`](../../backend/src/main/java/com/modulo/graph/GraphController.java)
and
[`UnlinkedMentionsService`](../../backend/src/main/java/com/modulo/graph/UnlinkedMentionsService.java).
No shipped client screen calls them at the moment.

## Semantic search and embeddings

Semantic retrieval is owner-scoped and provider-neutral. The
[`EmbeddingProvider`](../../backend/src/main/java/com/modulo/knowledge/EmbeddingProvider.java)
interface is the boundary. The default
[`LocalHashEmbeddingProvider`](../../backend/src/main/java/com/modulo/knowledge/LocalHashEmbeddingProvider.java)
(model `hashing-v1`) is deterministic, runs locally, produces 64-dimensional
vectors from character n-grams, and never transmits note text. It gives
approximate morphological similarity, not general language understanding.

### Privacy modes

Each user chooses a provider mode (`GET`/`PUT /api/knowledge/preferences`):

| Mode | Effect |
| --- | --- |
| `LOCAL` (default) | Index and answer with the local provider; no provider charges |
| `OFF` ("AI disabled") | No indexing or question answering; lexical search still works |
| `REMOTE` | Rejected: it requires explicit consent and, even with consent, fails while no remote provider is configured |

This means configuration can never silently turn into data sharing, and a
remote implementation cannot receive text just by replacing the provider
bean. Retrieval never includes other users' notes, including notes shared
with you: a share does not grant permission to index another owner's
content.

### Indexing

Flyway V19 adds pgvector note embeddings, provider/model metadata, content
digests, failure state, privacy preferences and suggestion decisions. V21 keeps
separate generations per `(owner, note, provider, model)` with their
dimensions and adds a database trigger that queues re-index jobs inside the
note transaction, so rolled-back writes never become jobs.

| Behaviour | Value |
| --- | --- |
| Debounce after a note change | 200 ms |
| Worker cadence | Every 2 s (`modulo.knowledge.index-interval-ms`), up to 25 due jobs per tick; first run after 10 s (`modulo.knowledge.index-initial-delay-ms`) |
| Failed job retry | After 1 minute |
| Current-row check | SHA-256 content digest plus matching provider and model |
| Note deletion | Cascades to embeddings and queued jobs |

Queued work survives restarts. A provider or model change forces re-embedding
because stored rows must match the active provider and model.

**Backfill:** `POST /api/knowledge/embeddings/backfill` embeds at most 100
changed notes per call and counts unchanged READY rows as skipped. Repeat it
until nothing is left; it is resumable and retries failed rows without
redoing completed ones. Run it after changing models.
`POST /api/knowledge/embeddings/notes/{id}` refreshes one note.

### Search

`GET /api/knowledge/search?q=&limit=` (query up to 2,000 characters, at most 50
results) scores each candidate as 45% lexical plus 55% cosine similarity of
stored vectors. Search reads stored vectors only and verifies each digest; it
never embeds candidate notes during a search. If the index is stale or
unavailable it falls back to lexical matches while indexing catches up.

The regression fixture
[`semantic-eval.json`](../../backend/src/test/resources/knowledge/semantic-eval.json)
holds near matches that exact lexical retrieval misses;
`SemanticKnowledgeServiceTest` requires hybrid ranking to put every positive
above its distractor and to beat lexical-only ranking. Because the local
provider is fixed and the corpus deterministic, the suite does not depend on
live model latency.

**Workspace record search.** `POST /api/knowledge/workspace-search` ranks
plugin-record text sent by the browser (up to 200 documents and 1 MB per
batch) with the same local provider. The corpus is not persisted or sent to
remote providers. Keyword search remains available when it cannot be reached.
Record matches are never presented as note citations.

## Ask Modulo

`POST /api/knowledge/ask` answers extractively: every sentence in an answer
comes from a note and carries a numbered citation (at most 5) to a note the
owner can access, with character ranges for each citation. If support is
insufficient, the answer is an explicit no-answer rather than an invented
sentence. Note text is treated as untrusted data: instruction-like sentences
are filtered out and never become system or tool instructions. Provider
failures do not affect ordinary note access or lexical search.

In the workspace, the **Semantic Search** view (`semantic-search` plugin,
Tools → AI) searches with score components and provider/model details, asks
questions with quoted passages and clickable citations, and switches the
privacy mode. **Cancel** aborts the browser request so a late response cannot
replace visible results; a server batch already running finishes its bounded
local work.

## Suggested links

The **Suggested Links** note panel (`auto-linker` plugin) lists candidates from
`GET /api/knowledge/notes/{id}/suggestions` (at most 20). Each suggestion
records its score, lexical and vector components, provider and model, and
stays PENDING until you accept, reject or dismiss it
(`POST /api/knowledge/suggestions/{id}/decision`). Suggestions never change the
graph automatically; accepting one creates an ordinary audited note link of
type `semantic-suggestion`. Decided suggestions leave the pending list.

## AI summaries

The **AI Summary** note panel (`ai-summary` plugin) calls
`/api/plugin/ai-notes-summarization` (summarize, key points, insights,
analyze, batch). It is backed by
[`OpenAIService`](../../backend/src/main/java/com/modulo/integrations/openai/OpenAIService.java),
which sends note content to the configured chat-completions endpoint. Unlike
the semantic path above, this **does** transmit note text to a remote
provider when configured.

| Property | Default |
| --- | --- |
| `openai.api.key` | unset (feature unavailable) |
| `openai.api.url` | `https://api.openai.com/v1/chat/completions` |
| `openai.model` | `gpt-3.5-turbo` |
| `openai.max.tokens` | `500` |
| `openai.temperature` | `0.7` |

The same service backs the Blueprint summarization node (see
[Blueprint nodes](../reference/blueprint-nodes.md)).

## Knowledge navigation by information mode

The Knowledge hub groups plugins by the ten information-intake modes. The
first section, **Notes & Tools**, holds Notes, Graph, Canvas, Tags and Saved
Searches. Grouping comes from each view's `mode`
([`modes.ts`](../../frontend/src/features/workspace/plugins/modes.ts)):

| Section | Mode ID | Examples |
| --- | --- | --- |
| Notes & Tools | `knowledge-tools` | Notes, Graph, Canvas, Tags, Saved Searches |
| Awareness | `reading-capture` | Information Intake, feeds, Web Watch, Document Inbox & OCR, Universal Inbox, bookmarks and web archive, Awareness plugins |
| Exploration | `exploration` | Explore views |
| Deep Research | `evidence` | Sources, claims, Reading Annotations, Citation Manager |
| Decision Support | `decisions` | Decision Journal |
| Problem-Solving | `problem-solving` | |
| Creation | `writing` | Manuscripts, editorial, publishing |
| Externalization | `externalization` | Executable Runbooks, Living Documents |
| Internalization | `education` | Learning, study, flashcards, skill tree |
| Iteration | `iteration` | Reproducibility |
| Maintenance | `maintenance` | Timeline, Workspace Time Machine, What Changed? |

There is no separate research-workflow engine. The former local ten-mode
suite (`research-workflow-engine`, `information-dashboard`,
`research-projects-trails`, `evidence-synthesis`, `decision-cases`,
`problem-solving`, `creation-briefs`, `procedure-design`, `practice-plans`,
`knowledge-experiments`, `knowledge-maintenance`, `information-workbench`,
`information-outputs`) is retired. Those IDs map to the signed-in
**Information Intake** plugin (`RETIRED_PLUGIN_REPLACEMENTS` in
[`catalog.ts`](../../frontend/src/features/workspace/plugins/catalog.ts)),
which runs the modes through Noesis and claims their browser data through its
legacy importer (see [Integrations](integrations.md#noesis-information-intake)).
The same navigation is used on web and Android.

Mode-specific record plugins can start Noesis sessions from their own records;
see [Noesis record links](integrations.md#noesis-record-links).

## Awareness plugins

Daily Briefing, Topic Watchlists and Newsletter Inbox are independently
installable ([`awareness/`](../../frontend/src/features/workspace/awareness/)).
Knowledge packs include all three. They use account-scoped plugin state, not
browser storage; newsletter records use schema `newsletter/1`.

**Daily Briefing** (`daily-briefing`) merges synchronized feed items, Web
Watch records marked Changed, and unarchived newsletter issues. It groups
entries by canonical URL after stripping common tracking parameters, or by
normalized exact title when there is no URL; it does not guess that
differently titled articles are the same story. The 15-minute scan timer and
reviewed markers are per account. Changed content or a new source revision
brings a reviewed story back. Dismissal only affects the briefing and can be
undone.

**Topic Watchlists** (`topic-watchlists`) match case-insensitive keywords and
phrases in titles, bodies and URLs; exclusion keywords win. A watchlist can
link to a PARA area or subarea, can be paused, and can filter the briefing.
Matching applies to what has been captured into Modulo, not to web search or
mailbox polling.

**Newsletter Inbox** (`newsletter-inbox`) accepts pasted issues and `.eml`
files. MIME parsing handles encoded headers and bodies and HTML-only mail;
messages are shown as text and attachments are not imported. Message IDs stop
re-imports from resetting triage status; pasted issues deduplicate by subject,
sender and body. Limits: 20 emails per import, 2 MB per file, 200,000
characters per decoded issue. Issues can be read, saved, archived and
restored. To import automatically from a mailbox, connect Gmail
([Integrations](integrations.md#gmail-newsletter-connection)).
