# Narratryx Merge Conflict Resolution

If GitHub shows merge conflicts for the common Narratryx files:

- `llm/Narratryx/README.md`
- `llm/Narratryx/docs/architecture.md`
- `llm/Narratryx/docs/runbook.md`
- `llm/Narratryx/requirements.txt`
- `llm/Narratryx/scripts/build_datasets.py`

Use this procedure locally:

```bash
git fetch origin
git checkout <your-branch>
git merge origin/main
python llm/Narratryx/scripts/resolve_merge_conflicts.py
python -m unittest discover -s llm/Narratryx/tests -v
git add llm/Narratryx
git commit -m "Resolve Narratryx merge conflicts"
git push
```

The helper script resolves any conflict markers in the listed files by keeping
**current branch (OURS)** content for conflicted sections.
