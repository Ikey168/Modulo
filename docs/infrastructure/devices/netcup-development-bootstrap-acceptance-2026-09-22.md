# Netcup clean development environment acceptance — 2026-09-22

## Decision

Accepted for the bounded Modulo development environment on Netcup. The Debian
13 server was reconciled through the documented Ansible entrypoint, a clean
checkout was created at `/home/ik/Development/Modulo`, all declared runtimes
were installed without production credentials, the host verifier passed, and a
second playbook apply reported zero changes.

The earlier disposable Ubuntu workstation exercise did not satisfy this target.
This record is the corrected acceptance for the Netcup server requested by the
owner. Repository defects discovered by executing the new environment are
listed separately; they do not prevent editing, building, testing, or using
Docker-backed integration tests on the server.

## Source and target boundary

- Branch: `codex/netcup-clean-dev`
- Accepted implementation head: `6f871e2b`
- Host: `dev-netcup`, Debian 13, eight CPUs and 16 GB RAM
- Developer: unprivileged `ik`
- Clean checkout: `/home/ik/Development/Modulo`
- Checkout authority: Git; package, build, container, Maven and npm data are
  regenerable caches.
- Administrative path: source-restricted, key-only root break-glass over the
  private network. Day-to-day development remains unprivileged and Netcup has
  no passwordless sudo grant for `ik`.
- Secret boundary: no production credentials or authoritative personal data
  were copied to the server.

## Executed acceptance

1. `development-server.yml` installed the missing shell tools and reconciled
   the existing Docker, SSH, ZeroTier, health, firewall and backup-boundary
   state. A follow-up apply added Debian's `rustup` package. The final full
   apply reported `ok=46`, `changed=0`, `failed=0`, `unreachable=0`.
2. The host verifier returned `accepted: true`, `cleanCheckout: true`, and no
   failures. SSH remained public-key-only; the restricted root break-glass path
   remained available; Docker, SSH, ZeroTier, the private SSH firewall and both
   maintenance timers were active and enabled. The health report was healthy
   with 3% root-disk use and ZeroTier network state `OK`.
3. The clean checkout installed Java 17.0.20.1, Node 22.23.2, npm 10.9.8 and
   Python 3.14.7 through the versioned `.mise.toml`. The Rust example's own
   manifest installed Rust 1.94.1 and `wasm32-unknown-unknown` through `rustup`.
4. `npm ci` completed successfully. The supported frontend gate passed
   typechecking, boundary lint, all 596 tests, and the production build. The
   build now uses a temporary output directory and leaves the checkout clean.
5. The full Maven reactor completed in 17:37 with `BUILD SUCCESS`: 799 tests,
   zero failures, zero errors and three skips, including Docker/Testcontainers
   integration tests and the JaCoCo coverage gate.
6. Both WASM examples rebuilt byte-for-byte. The Rust task runs from the
   example directory, matching CI and allowing Cargo to discover its nested
   `.cargo/config.toml`; invoking Cargo from the repository root had initially
   produced a false fixture mismatch by omitting those module-local settings.

## Separate follow-up gaps

### NETCUP-DEV-GAP-01 — Existing full ESLint debt

`mise run check-frontend-strict-lint` executes correctly but reports 121
existing findings: 69 errors and 52 warnings. The supported frontend gate
passes without this legacy whole-tree lint. Remediate the source findings in a
separate code-quality project rather than weakening the lint configuration or
misclassifying them as a host-bootstrap failure.

### NETCUP-DEV-GAP-02 — Dependency vulnerabilities

The clean root install reports 102 npm audit findings: 27 low, 36 moderate, 31
high and eight critical. Dependency remediation is repository work and should
be handled separately from the host bootstrap.

### NETCUP-DEV-GAP-03 — Legacy Netcup worktrees remain non-clean

The pre-existing `/home/ik/ChatGPT/Modulo` and `/home/ik/ChatGPT/Noesis`
worktrees contain owner changes and were deliberately left untouched. New work
should start from `/home/ik/Development/Modulo`; reconcile or archive the
legacy worktrees only in a separate, owner-reviewed cleanup.

### NETCUP-DEV-GAP-04 — Optional interactive-tool parity

The required server command surface passes, and `zsh`, `fzf`, `zoxide` and
Debian's `batcat` are installed. Starship, Delta, an editor launcher and a
`bat` compatibility alias are not part of this bounded server profile. Decide
separately whether those user-level conveniences belong in shared dotfiles or
remain host-local preferences.

## Recovery

Rebuild the environment from a reviewed inventory outside Git by applying
`infra/personal/playbooks/development-server.yml`, cloning Modulo into the
managed checkout root, trusting and installing `.mise.toml`, installing the
pinned Rust toolchain from the example manifest, and running
`scripts/verify-netcup-development.py` as root. The clean checkout and all
local caches are disposable; Git and the versioned infrastructure declarations
remain authoritative.
