# Repository operating contract

These rules apply to every agent and contributor working anywhere in this
repository.

## Before changing a subsystem

- Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the
  subsystem's page in [docs/](docs/README.md).
- Decisions in the [decision log](docs/architecture/decisions.md) are binding
  until a new entry supersedes them.

## Acceptance

- `mise run check` is the repository acceptance command.
- While iterating, run the smallest relevant test first. Before declaring a
  change complete, run the affected parts of the acceptance command and name any
  gate you skipped.
- A change is complete only when the behavior has run successfully at the right
  layer. The existence of a file or class alone is not acceptance evidence.

## Safety

- Preserve existing user changes and generated evidence. Don't rewrite Git
  history, discard a dirty worktree, push, deploy, rotate credentials, restore,
  or delete persistent state unless the task explicitly authorizes it.
- Never commit tokens, passwords, private keys, recovery material, production
  data, or local `.env` files. Document secret variable names and who holds each
  secret, never secret values.

## Source and generated files

- Edit source files, migrations, deployment definitions and tests.
- Treat these as generated unless a release procedure explicitly says otherwise:
  `frontend/dist`, Maven output, coverage output, caches, virtual environments,
  test results, and everything under `docs/reference/generated/`. Regenerate
  generated files with their scripts. Don't edit them by hand.

## Invariants

- Backend schema changes are additive, numbered Flyway migrations.
- Frontend feature code consumes the public `@modulo/core` boundary. See
  [CONTRIBUTING.md](CONTRIBUTING.md#architectural-rules).
- Plugin data persists through the plugin state API, not browser storage.
- The docs pages checked by `scripts/verify-*.py` must keep their required
  headings.
