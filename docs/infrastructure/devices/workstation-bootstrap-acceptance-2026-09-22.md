# Clean developer workstation bootstrap acceptance — 2026-09-22

## Decision

Accepted for the bounded CLI workstation baseline. A fresh Ubuntu 24.04
systemd container reached a usable development state from the documented
`infra/personal` path, passed the functional verifier, remained reachable over
key-only loopback SSH, and produced a zero-change second apply.

This acceptance does not claim full desktop/laptop parity. Every observed gap
is listed below as a separate follow-up.

## Source and target boundary

- Initial implementation commit: `63c5d77b16361e5e60c512e32a156fba52cc121b`
- Branch: `codex/bootstrap-clean-dev`
- Target: fresh `ubuntu:24.04` container with systemd and OpenSSH; no host home,
  dotfiles, package cache, credentials, or project checkout was mounted.
- Access: ephemeral Ed25519 key on a loopback-only published SSH port.
- Secrets: none were copied. The temporary bootstrap sudo rule was removed
  before final SSH acceptance.

## Executed acceptance

1. The original dry run failed because pristine Ubuntu lacked `python3-apt`.
   The documented, idempotent `prepare-workstation.yml` stage now installs only
   Python and the distribution bindings required by Ansible.
2. The repaired dry run completed with no failed or unreachable hosts.
3. `workstation.yml` installed the baseline and shared CLI successfully.
4. The second preparation run reported `changed=0`; the second workstation run
   reported `changed=0`, `failed=0`, and `unreachable=0`.
5. A fresh clone of the branch resolved to the implementation commit above.
6. The functional verifier passed with `--project /home/dev/Modulo` and
   `--expect-sshd-hardening`. It found `package.json` and `pom.xml`, all
   required CLI commands, the role marker, the external backup-secret boundary,
   and effective SSH policy with password and keyboard-interactive login off,
   root login off, and public-key login on.
7. A new SSH session succeeded as the unprivileged `dev` user after hardening.
   `sudo -n true` then failed after the temporary bootstrap grant was removed.

## Observed workstation matrix

| Capability | Laptop (`ik-note`, Ubuntu 24.04) | Desktop (`desktop`, Fedora 44) | Clean target |
| --- | --- | --- | --- |
| Required baseline CLI | Missing ShellCheck | Missing `fzf` | Pass |
| User tool manager | `mise` and `uv` present | Missing `mise` and `uv` | Missing by design |
| Optional shell tools | `bat`, `zoxide`, Starship present | `bat` present; `zoxide` and Starship missing | `batcat` and `zoxide` present |
| Project runtimes | Node 24, Java 21; Maven missing | Node 22, Java 25, Maven 3.9 | Not host-global |
| Project declarations | `package.json`, `pom.xml` | untracked `.mise.toml`, `package.json`, `pom.xml` | `package.json`, `pom.xml` |
| Private SSH client aliases | verifier passes `oracle`, `netcup`, `pi5`, `desktop` | aliases fall through to public defaults and permit password/keyboard auth | key-only loopback SSH passes |
| Baseline role/backup markers | missing | role marker present; backup boundary missing | pass |

## Parity gaps

### DEVBOOT-GAP-01 — Baseline was not versioned

`infra/personal` and its structural verifier existed only as untracked files in
the desktop Modulo worktree. This branch versions the non-secret baseline and
the clean-workstation entrypoint. Close this gap when the branch is merged.

### DEVBOOT-GAP-02 — Controller bootstrap is not self-hosting

The documented controller path depends on `uv`. The laptop has it; the desktop
and clean target do not. Add a pinned, verified `uv` installation entrypoint or
document it as an externally managed prerequisite.

### DEVBOOT-GAP-03 — User-level shell tooling is outside the baseline

The laptop's pinned `mise`, `fzf`, `bat`, `zoxide`, Starship, and transfer guard
are local files backed up from that host, not declarations applied by
`infra/personal`. The desktop has only part of that set. Move non-secret user
configuration into a reviewed role or dotfiles authority.

### DEVBOOT-GAP-04 — Host CLI parity is incomplete

The laptop lacks ShellCheck; the desktop lacks `fzf`; versions of Git, GitHub
CLI, CMake, GCC, Ninja, ripgrep, Node, and Java differ. The package baseline now
declares the minimum shared command surface, but the two real hosts have not yet
been reconciled by applying it.

### DEVBOOT-GAP-05 — Project runtime discovery has no versioned mise manifest

The clean clone can discover Node and Maven projects from `package.json` and
`pom.xml`, but cannot install their intended runtime set automatically. The
desktop has an untracked `.mise.toml`; it is not authoritative until separately
reviewed, versioned, and accepted with the supported Java/JaCoCo toolchain.

### DEVBOOT-GAP-06 — Desktop SSH aliases are not hardened

On the desktop, `oracle`, `netcup`, `pi5`, and `laptop` resolve through default
SSH behavior rather than explicit private aliases; password and keyboard-
interactive authentication remain enabled in the computed client settings.
Version non-secret alias templates while keeping private keys external.

### DEVBOOT-GAP-07 — Laptop baseline state is partly undocumented

The laptop passes its local bootstrap verifier, but lacks the Ansible role and
backup-boundary markers and stores the verifier itself only in `~/.local/bin`.
Bring that verifier and its non-secret declarations under the same authority.

### DEVBOOT-GAP-08 — Editor command parity is absent

Neither real workstation exposes the `code` CLI, and GUI/editor installation is
outside this isolated CLI acceptance. Decide whether editor launchers belong to
the baseline or remain owner-managed hardware/desktop state.

## Recovery and cleanup

The acceptance target is disposable. Its only source of truth is the Git branch
and the documented external inventory. Recreate it by running preparation,
dry-run, apply, and the functional verifier in that order. The target container,
ephemeral key, and local test image may be removed after the PR is accepted.
