# ADR 0002: The core keeps first-class `note`/`link`/`tag`/`user` types

- **Status:** Accepted
- **Context:** [#301](https://github.com/Ikey168/Modulo/issues/301) (B8), the
  non-goal guard for the Core/Experience boundary refactor epic
  [#293](https://github.com/Ikey168/Modulo/issues/293).
- **Decision drivers:** keeping the engine concrete and load-bearing, avoiding
  the "generic local-first app platform" trap, and giving the boundary guard
  (B9 #302) a documented rationale it can point to.

## Context

The B0 epic ([#293](https://github.com/Ikey168/Modulo/issues/293)) established a
public core API (`@modulo/core`) and routed the note experience through it as
the first feature pack. A natural next temptation — for a well-meaning future
PR or agent — is to "finish the job" by generalizing the core itself: turn it
into a typeless property graph where `note`, `link`, `tag`, and `user` are just
plugin-registered entity types like any other, and move the node catalog's
built-in type system into plugins.

That sounds like cleaner architecture. It is not. The engine is *defined in
terms of notes*, and that concreteness is load-bearing:

- The seed node pack (`trigger.note.saved`, `action.note.create`,
  `action.tag.add`) is meaningful only because `note` and `tag` are real,
  first-class types the interpreter and capability model understand.
- The graph store, event bus, and capability enforcement reason about concrete
  entities. A domainless `(node, edge, property)` graph pushes all of that
  semantics out to plugins, where it cannot be guaranteed or enforced
  consistently.
- "PKM" in Modulo is concretely *note-workbench feature pack + seed node pack*,
  not a vague "core app." Dissolving the entity types dissolves that definition
  and lands us building a generic platform nobody asked for.

The B0 boundary work (`@modulo/core`, the feature-pack contract, the lint guard)
is about *where the note experience lives* (pack vs. core) — **not** about
making the core domain-agnostic. The two are easy to conflate, so the non-goal
is stated explicitly here.

## Decision

**`note`, `link`, `tag`, and `user` remain first-class types in the core.** Specifically:

1. These four entity types stay defined in the core, not registered by plugins.
2. The node catalog's built-in type system is **not** moved into plugins. The
   catalog stays part of the engine.
3. The core is **not** generalized into a typeless / domainless property graph
   with `note` as just another plugin-supplied type.

The public surface that feature packs consume (`CoreNote`, `CoreLink`,
`CoreTag`, `GraphQueryResult`, etc. from `@modulo/core`) reflects these concrete
types deliberately. Adding *new* node descriptors or capabilities through the
documented blueprint extension points is unaffected and encouraged — this ADR
constrains only the dissolution of the built-in entity types, not extension on
top of them.

## Consequences

- The B9 boundary guard (`no-restricted-imports` in
  [`frontend/.eslintrc.cjs`](../../frontend/.eslintrc.cjs) and
  [`frontend/.eslintrc.boundary.cjs`](../../frontend/.eslintrc.boundary.cjs))
  enforces that feature packs go through `@modulo/core` rather than workspace
  internals. This ADR is its *rationale*: the boundary exists to keep a concrete,
  typed core stable behind a public API — not to pave the way toward a generic
  graph. See [B2 boundary audit](B2-boundary-audit.md).
- A PR that proposes moving `note`/`link`/`tag`/`user` into plugins, or
  collapsing the catalog's type system into a generic property graph, should be
  **rejected on sight** and pointed at this ADR. Reopening the decision requires
  superseding this ADR with a new one and a second concrete consumer that
  genuinely demands generalization — not a refactor done on speculation.
- Physical package extraction of the note experience (npm split) remains a
  separate non-goal tracked by the epic: plugin-*ready*, not plugin-*ized*,
  until a second consumer exists.
