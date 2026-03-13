"""Resolve common Narratryx merge conflicts after merging target branch.

Usage:
  python llm/Narratryx/scripts/resolve_merge_conflicts.py

This script targets files that frequently conflict in PR merges and resolves any
remaining conflict markers by preferring the current branch (OURS) content.
"""

from __future__ import annotations

from pathlib import Path

TARGETS = [
    Path("llm/Narratryx/README.md"),
    Path("llm/Narratryx/docs/architecture.md"),
    Path("llm/Narratryx/docs/runbook.md"),
    Path("llm/Narratryx/requirements.txt"),
    Path("llm/Narratryx/scripts/build_datasets.py"),
]


def resolve_ours(content: str) -> str:
    lines = content.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("<<<<<<< "):
            i += 1
            ours: list[str] = []
            while i < len(lines) and not lines[i].startswith("======="):
                ours.append(lines[i])
                i += 1
            if i < len(lines) and lines[i].startswith("======="):
                i += 1
            while i < len(lines) and not lines[i].startswith(">>>>>>> "):
                i += 1
            if i < len(lines) and lines[i].startswith(">>>>>>> "):
                i += 1
            out.extend(ours)
            continue
        out.append(line)
        i += 1
    return "".join(out)


def main() -> None:
    changed = 0
    for path in TARGETS:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        if "<<<<<<< " not in text:
            continue
        resolved = resolve_ours(text)
        path.write_text(resolved, encoding="utf-8")
        changed += 1
        print(f"resolved: {path}")

    if changed == 0:
        print("No conflict markers found in targeted Narratryx files.")
    else:
        print(f"Resolved conflicts in {changed} file(s).")


if __name__ == "__main__":
    main()
