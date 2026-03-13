# Narratryx

Narratryx is a standalone fiction-model build pipeline for DraftHarbour.

> Status: **implementation-ready pipeline**. This folder contains executable scripts, configs, and run commands, but it still does **not** integrate with DraftHarbour runtime (`src/`).

## What is built

- End-to-end dataset preparation pipeline (continued pretraining + SFT + DPO pair generation).
- Reproducible QLoRA configs for Qwen2.5-7B SFT and DPO.
- Training launcher wrappers for Axolotl and Unsloth entrypoints.
- Model export helpers for GGUF quantization and MLC web compilation.
- Single-command orchestration script to run staged jobs.

## Quick start

```bash
cd llm/Narratryx
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1) Build datasets
python scripts/build_datasets.py \
  --output-dir artifacts/data \
  --max-books 2000 \
  --max-sft-records 15000 \
  --max-dpo-pairs 12000

# 2) Print training commands from config
python scripts/run_training.py --stage sft --dry-run
python scripts/run_training.py --stage dpo --dry-run

# 3) Export (after training checkpoints exist)
python scripts/export_model.py --help
```

## Folder structure

- `configs/` — runnable YAML configs and job settings.
- `scripts/` — data, training, and export automation.
- `docs/` — architecture + operations runbook.
- `requirements.txt` — Python dependencies.

## Non-integration guardrail

All Narratryx code remains isolated under `llm/Narratryx/` and is not imported by app runtime files.
