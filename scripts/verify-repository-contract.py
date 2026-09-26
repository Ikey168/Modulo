#!/usr/bin/env python3
"""Verify the common contract for the three core personal-system repositories."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPOSITORIES = {
    "Modulo": ROOT,
    "Praxis": ROOT.parent / "Praxis",
    "Noesis": ROOT.parent / "Noesis",
}
REQUIRED = ("README.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", ".mise.toml")


def main() -> None:
    failures: list[str] = []
    for name, repository in REPOSITORIES.items():
        if not repository.is_dir():
            failures.append(f"{name}: repository unavailable at {repository}")
            continue
        for relative in REQUIRED:
            path = repository / relative
            if not path.is_file() or not path.read_text(encoding="utf-8").strip():
                failures.append(f"{name}: missing nonempty {relative}")
        mise = repository / ".mise.toml"
        if mise.is_file() and "[tasks.check]" not in mise.read_text(encoding="utf-8"):
            failures.append(f"{name}: .mise.toml has no tasks.check")
        agent = repository / "AGENTS.md"
        if agent.is_file():
            text = agent.read_text(encoding="utf-8").lower()
            for phrase in ("secret", "generated", "mise run check", "acceptance"):
                if phrase not in text:
                    failures.append(f"{name}: AGENTS.md does not cover {phrase}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("repository contract verified: Modulo, Praxis, and Noesis")


if __name__ == "__main__":
    main()

