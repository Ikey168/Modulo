# Isolated agent worktrees

Agents must not share a dirty checkout. The repository's existing user edits
are evidence that a reset or clean is unsafe. Use the read-only status gate and
create a separate worktree:

```sh
scripts/agent-worktree.sh status /home/ik/ChatGPT/Modulo
scripts/agent-worktree.sh create /home/ik/ChatGPT/Modulo agent/example main
```

Work in the printed directory, run the relevant `mise` checks, and remove the
worktree only after it is clean:

```sh
scripts/agent-worktree.sh remove /home/ik/ChatGPT/Modulo /path/to/worktree
```

The helper refuses dirty source and worktrees and has no reset, checkout,
force-remove, or automatic push operation. Publishing a branch or opening a PR
remains an explicit human-reviewed step.
