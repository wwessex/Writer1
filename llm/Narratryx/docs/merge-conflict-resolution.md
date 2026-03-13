# Narratryx Merge Conflict Resolution

If GitHub shows conflicts for these files:

- `llm/Narratryx/README.md`
- `llm/Narratryx/docs/architecture.md`
- `llm/Narratryx/docs/runbook.md`
- `llm/Narratryx/requirements.txt`
- `llm/Narratryx/scripts/build_datasets.py`

## Fastest fix (prefer target branch content)

```bash
git fetch origin
git checkout <your-branch>
git merge origin/main
python llm/Narratryx/scripts/resolve_merge_conflicts.py --strategy theirs
python -m unittest discover -s llm/Narratryx/tests -v
git commit -m "Resolve Narratryx merge conflicts"
git push
```

## Alternative (prefer your branch content)

```bash
python llm/Narratryx/scripts/resolve_merge_conflicts.py --strategy ours
```

## What the script does

- If merge is in progress, it uses `git checkout --theirs/--ours` for the listed files and stages them.
- It also removes raw conflict markers if any remain in file contents.
