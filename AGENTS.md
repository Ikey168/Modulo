# Repository operating contract

This file applies to the complete Modulo repository.

- Read `README.md`, `CONTRIBUTING.md`, and the relevant entry under `docs/`
  before changing a subsystem. Architecture decisions under
  `docs/architecture/` are binding until superseded by another ADR.
- Use `mise run check` as the repository acceptance command. During iteration,
  run the smallest relevant test first; before declaring a change complete,
  run the affected portions of the acceptance command and record any omitted
  gate explicitly.
- Preserve existing user changes and generated evidence. Do not rewrite Git
  history, discard a dirty worktree, push, deploy, rotate credentials, restore,
  or delete persistent state unless the task explicitly authorizes it.
- Never commit tokens, passwords, private keys, recovery material, production
  data, or local `.env` files. Document variable names and secret custody, not
  values.
- Edit source files, migrations, deployment definitions, and tests. Treat
  `frontend/dist`, Maven output, coverage output, caches, virtual environments,
  and test results as generated unless a release procedure explicitly says
  otherwise.
- Backend schema changes are additive numbered migrations. Frontend feature
  packs consume the public `@modulo/core` boundary described in
  `CONTRIBUTING.md`.
- A change is complete only when the behavior has executed successfully at the
  appropriate layer. Structural presence alone is not acceptance evidence.

