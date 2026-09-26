# Route serious research through Noesis

Noesis is the canonical route when a browser question becomes evidence work.
The browser remains the place for navigation, quick lookups, casual reading,
authenticated interaction, and discovery. Escalate to Noesis when the result
must compare sources, verify a claim, retain provenance, expose uncertainty,
find contradictions, produce a reusable evidence package, or monitor change.

## Handoff rule

Send only the minimum useful context:

- the question or claim and the required decision/output;
- the explicitly selected public URL, document, excerpt, or bounded tab set;
- the desired action: verify, trace the original, compare, find contrary or
  newer evidence, synthesize, or monitor;
- urgency/freshness and the destination Modulo object, when applicable.

Never send cookies, authorization headers, session tokens, unrelated tabs,
browser history, private-window state, or secrets. Authenticated material needs
an explicit access and retention decision before ingestion.

Noesis returns the conclusion package rather than its corpus: question,
answer/status, findings, evidence locators, source references, contradiction
state, uncertainty/limitations, open questions, timestamps, and a stable Noesis
run, document, watch, or bundle reference. Modulo stores that package and the
work it creates, not a duplicate research corpus.

## Runtime baseline

The Noesis checkout at `/home/ik/ChatGPT/Noesis` has two domains:

- `local`: private documents stored on the machine;
- `research`: public evidence used for verification and comparison.

Use `research` for public browser handoffs. Private evidence remains in `local`
and is excluded from exports unless the owner explicitly authorizes inclusion.

## Acceptance pilots — 2026-09-20

| Intent | Exercise | Result |
| --- | --- | --- |
| Public-source verification | Ingested Mozilla's official Firefox policy reference by URL and asked which fields configure custom search engines and aliases. | Answered from `web:c32cf8a382d0275104bda9c7` with the original URL and an extractive citation. |
| Multi-source comparison | Ingested the Noesis CLI guide and CLI contract, then asked whether synchronization executes queued source-pack jobs or starts paid acquisition. | Two consistent cited passages returned from `upload:74acbcb87a57` and `upload:3dbbaa1bbfed`. |
| Evidence portability | Exported the comparison answer without private evidence and verified it offline. | Bundle `sha256:7d83b68fa0829384a2b84d17ada461db77c1de09f29703db78a7a7e0713b3e44` is valid with two evidence objects and no warnings. |
| Insufficient evidence | Asked a narrowly scoped privacy question with a higher relevance threshold. | Noesis refused with `insufficient_evidence` instead of manufacturing an answer. |
| Monitoring handoff | Created and polled a public topic watch for Firefox enterprise-policy changes. | Lifecycle and opaque cursor worked; zero events was reported explicitly. The pilot watch was then soft-deleted and its audit history retained. |

The verified evidence bundle is
`/home/ik/ChatGPT/Noesis/artifacts/browse-route-2026-09-20/sync-safety.answer.bundle.json`.

## Known limits and operator response

- Optional extraction/model/browser dependencies are not all installed. Ingest
  and cited answers work, but claim extraction currently reports degraded
  coverage and answers fall back to source passages.
- Deterministic token overlap can retrieve a lexically related but irrelevant
  passage for broad questions. Scope the domain and question, set a suitable
  result limit/relevance threshold, inspect citations, and treat a refusal as a
  successful safety outcome.
- Long HTML pages can produce overlong extractive passages. Prefer canonical,
  focused documents or section-level sources when available.
- A citation establishes where text appeared; it does not by itself establish
  truth or source independence. Consequential work still requires primary-source
  preference, corroboration, contradiction search, and explicit uncertainty.
- Creating a watch does not schedule source acquisition. Continuous collection,
  polling cadence, and notifications belong to the monitoring project.

## Operating cadence

Review this route every March and September, and whenever the Noesis answer,
ingestion, export, or watch contracts change. Re-run the URL, comparison,
refusal, bundle-verification, and watch-lifecycle pilots after a material runtime
upgrade. Serious research is accepted only when its useful claims retain source
locators and its limits are visible; otherwise it remains open or refused.
