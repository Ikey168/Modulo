#!/bin/sh
# Safe lifecycle helper for isolated coding-agent worktrees.
# It never resets, cleans, force-removes, or overwrites a dirty checkout.
set -eu

usage() {
  cat >&2 <<'EOF'
Usage:
  agent-worktree.sh create REPOSITORY BRANCH [BASE_REF] [WORKTREE_DIR]
  agent-worktree.sh remove REPOSITORY WORKTREE_DIR
  agent-worktree.sh status REPOSITORY

The create operation requires a clean repository. The remove operation requires
a clean worktree. Publishing a branch is intentionally not automated.
EOF
  exit 2
}

command=${1:-}
case "$command" in
  create)
    [ "$#" -ge 3 ] || usage
    repo=$2
    branch=$3
    base=${4:-HEAD}
    repo_root=$(git -C "$repo" rev-parse --show-toplevel)
    worktree=${5:-$repo_root/.agent-worktrees/$(printf '%s' "$branch" | tr '/:' '--')}
    [ -z "$(git -C "$repo" status --porcelain=v1)" ] || {
      printf 'refusing to create from a dirty checkout: %s\n' "$repo" >&2
      exit 1
    }
    case "$branch" in
      ''|-*|*[!A-Za-z0-9_./-]*) printf 'invalid branch name: %s\n' "$branch" >&2; exit 2 ;;
    esac
    [ ! -e "$worktree" ] || { printf 'worktree path already exists: %s\n' "$worktree" >&2; exit 1; }
    mkdir -p "$(dirname "$worktree")"
    git -C "$repo" worktree add -b "$branch" "$worktree" "$base"
    printf 'created isolated worktree: %s\n' "$worktree"
    ;;
  remove)
    [ "$#" -eq 3 ] || usage
    repo=$2
    worktree=$3
    git -C "$repo" rev-parse --show-toplevel >/dev/null
    [ -d "$worktree" ] || { printf 'worktree does not exist: %s\n' "$worktree" >&2; exit 1; }
    [ -z "$(git -C "$worktree" status --porcelain=v1)" ] || {
      printf 'refusing to remove a dirty worktree: %s\n' "$worktree" >&2
      exit 1
    }
    git -C "$repo" worktree remove "$worktree"
    printf 'removed clean isolated worktree: %s\n' "$worktree"
    ;;
  status)
    [ "$#" -eq 2 ] || usage
    git -C "$2" worktree list --porcelain
    ;;
  *) usage ;;
esac
