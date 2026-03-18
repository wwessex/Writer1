#!/usr/bin/env bash
set -euo pipefail

python scripts/build_datasets.py "$@"
python scripts/run_training.py --stage cpt --dry-run
python scripts/run_training.py --stage sft --dry-run
python scripts/run_training.py --stage dpo --dry-run

echo "Narratryx pipeline staged (cpt → sft → dpo). Remove --dry-run in run_training.py commands when ready."
