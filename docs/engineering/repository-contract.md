# Engineering repository contract

Modulo, Praxis, and Noesis use the same top-level engineering contract while
keeping repository-specific commands and architecture local to each project.
Each important repository provides:

- a root `README.md` for installation, layout, and the shortest useful start;
- `CONTRIBUTING.md` for testing, formatting, generated files, Git workflow, and
  acceptance evidence;
- `SECURITY.md` for private vulnerability reporting and secret handling;
- `AGENTS.md` for safe, repository-scoped automation rules;
- a root `.mise.toml` exposing `mise run check` as its local acceptance gate;
- versioned architecture documentation and an ADR location or convention;
- an example environment file when runtime configuration is required, with no
  live credential values.

`mise run check` is deliberately repository-owned: Modulo checks Java,
TypeScript, deployment operations, and infrastructure structure; Praxis runs
its locked Python tests, lint, and strict type checks; Noesis runs its maintained
core gateway suite and contract checks. Large optional-model and live-provider
matrices remain explicit specialist gates and must not be represented as having
run when only the common gate ran.

## Change and release rules

Use a branch and reviewable commits. Do not rewrite shared history or mix
unrelated worktree changes into a patch. Generated output is rebuilt from its
source and is committed only where the repository's release procedure requires
it. Dependency changes update the repository's lock or constraint artifact in
the same change.

Completion means the affected behavior executed successfully. Record the exact
command, result, environment boundary, and any untested live/provider gate.
Passing a schema check or seeing a file in the tree is not by itself functional
acceptance. Deployment and data migration additionally require an identified
rollback and preserved recovery evidence.

## Architecture decisions

Modulo ADRs live in `docs/architecture/`; Noesis ADRs live in
`docs/architecture/decisions/`; Praxis records new decisions under `docs/adr/`.
An ADR is required when a change establishes or reverses a durable boundary,
authority, data ownership rule, wire/storage contract, or operational
invariant. Supersede prior decisions rather than silently editing their history.

