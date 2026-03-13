"""Resolve common Narratryx merge conflicts after merging target branch.

Usage examples:
  python llm/Narratryx/scripts/resolve_merge_conflicts.py --strategy ours
  python llm/Narratryx/scripts/resolve_merge_conflicts.py --strategy theirs

When run during an in-progress git merge, this script can resolve the known
Narratryx conflict files by checking out either OURS or THEIRS and staging them.
If not in merge state, it can still clean conflict markers in-place.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

TARGETS = [
    Path("llm/Narratryx/README.md"),
    Path("llm/Narratryx/docs/architecture.md"),
    Path("llm/Narratryx/docs/runbook.md"),
    Path("llm/Narratryx/requirements.txt"),
    Path("llm/Narratryx/scripts/build_datasets.py"),
]


def in_merge_state() -> bool:
    return Path(".git/MERGE_HEAD").exists()


def run_git_checkout(strategy: str, paths: list[Path]) -> int:
    flag = "--ours" if strategy == "ours" else "--theirs"
    changed = 0
    for path in paths:
        if not path.exists() and not in_merge_state():
            continue
        result = subprocess.run(["git", "checkout", flag, "--", str(path)], capture_output=True, text=True)
        if result.returncode == 0:
            subprocess.run(["git", "add", str(path)], check=False)
            changed += 1
    return changed


def resolve_markers_keep_side(content: str, keep: str) -> str:
    lines = content.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("<<<<<<< "):
            i += 1
            ours: list[str] = []
            theirs: list[str] = []
            while i < len(lines) and not lines[i].startswith("======="):
                ours.append(lines[i])
                i += 1
            if i < len(lines) and lines[i].startswith("======="):
                i += 1
            while i < len(lines) and not lines[i].startswith(">>>>>>> "):
                theirs.append(lines[i])
                i += 1
            if i < len(lines) and lines[i].startswith(">>>>>>> "):
                i += 1
            out.extend(ours if keep == "ours" else theirs)
            continue
        out.append(line)
        i += 1
    return "".join(out)


def resolve_markers(paths: list[Path], keep: str) -> int:
    changed = 0
    for path in paths:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        if "<<<<<<< " not in text:
            continue
        resolved = resolve_markers_keep_side(text, keep)
        path.write_text(resolved, encoding="utf-8")
        changed += 1
        print(f"resolved markers: {path}")
    return changed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve common Narratryx merge conflicts.")
    parser.add_argument("--strategy", choices=["ours", "theirs"], default="theirs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    total = 0
    if in_merge_state():
        checked_out = run_git_checkout(args.strategy, TARGETS)
        total += checked_out
        if checked_out:
            print(f"checked out {args.strategy} for {checked_out} file(s) and staged them")

    marker_resolved = resolve_markers(TARGETS, args.strategy)
    total += marker_resolved

    if total == 0:
        print("No conflicts found in targeted Narratryx files.")
    else:
        print(f"Resolved {total} conflict operation(s) using strategy={args.strategy}.")


if __name__ == "__main__":
    main()
