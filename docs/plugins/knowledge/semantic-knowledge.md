# Semantic knowledge and Ask Modulo

Modulo's semantic knowledge path is owner-scoped and provider-neutral. The
`EmbeddingProvider` interface is the boundary; the default
`LocalHashEmbeddingProvider` is deterministic, local, 64-dimensional, and does
not transmit note text. Selecting remote mode requires explicit consent and is
rejected while no remote provider is configured, so configuration cannot
silently turn into data sharing.

## Indexing and backfill

Flyway V19 adds pgvector-backed note embeddings, provider/model metadata,
content digests, failure state, user privacy preferences, and suggested-link
decisions. Note create/update/delete events maintain the index. Repeated saves
are debounced, while the SHA-256 content digest guarantees changed content is
re-indexed. A provider or model change also forces a new embedding because the
stored provider/model must match before a row is considered current.

`POST /api/knowledge/embeddings/backfill` is resumable: READY rows whose digest,
provider, and model still match are counted as unchanged, and failed rows can be
retried without duplicating completed work.

V21 keeps separate `(owner, note, provider, model)` generations, including their
dimensions. Its note trigger queues updates in the note transaction, so rolled
back writes never become index jobs. Changes debounce for 200 ms; a worker
drains at most 25 due jobs every two seconds. Failed jobs retry after one minute,
and queued work survives process restarts. Deleting a note cascades to both its
embeddings and queued work. Manual backfill embeds at most 100 changed notes per
request; repeat it until no changed notes remain. Reindex after changing models.

Search reads stored vectors for the active model and verifies the content digest
before scoring. It never embeds every candidate note during a search. A stale or
unavailable index falls back to lexical matches while automatic indexing catches
up. The default hashing model provides approximate morphological similarity;
the small evaluation fixture is not evidence of general language understanding.

## Retrieval quality and latency guardrails

Search combines lexical score (45%) and embedding cosine similarity (55%). The
committed `backend/src/test/resources/knowledge/semantic-eval.json` fixture
contains morphological/semantic-near matches that exact lexical retrieval
misses; `SemanticKnowledgeServiceTest.hybridEvalFixtureRecoversMorphologicalMatchesLexicalMisses`
requires hybrid retrieval to rank every positive example above its distractor
and to outperform lexical-only ranking.

The interactive API caps search results at 50, suggested links at 20, and Ask
Modulo citations at 5. The default local provider is fixed-dimensional and the
evaluation corpus is deterministic, keeping the regression suite independent of
paid or live model latency. Live-provider latency is therefore reported as
unavailable rather than fabricated until a remote provider is configured.

## Suggested links and cited answers

Suggested links never mutate the graph automatically. Each suggestion records
its score, lexical/vector components, provider/model, and remains PENDING until
the user accepts, rejects, or dismisses it. Acceptance creates an ordinary
`semantic-suggestion` note link through the existing audited link service.

Ask Modulo is extractive: every returned factual sentence carries a numbered
citation to an owner-accessible source note. If support is insufficient, the
service returns a no-answer result instead of inventing a sentence. Note text is
treated as untrusted data; prompt-like instructions are removed from extracted
answers and never become system/tool instructions. AI/provider failures do not
affect ordinary note access or lexical note search.

## Workspace controls

In Notes, expand **Search knowledge and Ask Modulo**. Search returns score
components and provider/model details; Ask returns quoted passages and clickable
note citations. The API also returns character ranges in the answer for each
citation. Suggested links expose accept/reject/dismiss; decided suggestions stay
out of the pending list. Acceptance uses the normal note-link service.

Choose **AI disabled** to prevent indexing and question answering while retaining
lexical search. Local mode has no provider charges; remote mode is visibly
unavailable until a consent-aware provider boundary is configured. A remote
implementation cannot receive text just by replacing the provider bean. Cancel
aborts the browser request and prevents a late response from replacing visible
results. An already-running server batch can finish its bounded local work.

Knowledge retrieval intentionally excludes other users' notes, including shared
notes: a share does not grant permission to index another owner's content. Source
navigation goes through the normal authorized note API.

The closed #255/#256 issues were checked against the repository: there was no
separate delivered vector/RAG service to integrate. The existing local provider,
knowledge service, owner-scoped repository and link service form this path.
