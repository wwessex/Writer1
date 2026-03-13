# Narratryx

Narratryx is a standalone fiction-model build pipeline for DraftHarbour.

> Status: **expanded implementation pipeline**. This folder now includes data, training, export, cloud runtime, and browser/story-bible modules, while still not integrating with DraftHarbour runtime (`src/`).

## What is built

- End-to-end dataset preparation pipeline (continued pretraining + SFT + DPO pair generation).
- Improved DPO pair generation with style-contrast transforms (instead of static rejected placeholder text).
- Reproducible QLoRA configs for Qwen2.5-7B SFT and DPO.
- Training launcher wrappers for Axolotl and Unsloth entrypoints.
- Model export helpers for GGUF quantization and MLC web compilation.
- Cloud runtime artifacts: FastAPI gateway + Modal vLLM deployment entrypoint + Dockerfile.
- Browser/runtime artifacts: IndexedDB Story Bible schemas, hybrid saliency ranking, context assembler, service worker cache path, runtime mode selector (WebLLM/Wllama/cloud).

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

# 4) Run cloud API gateway locally (expects vLLM backend)
uvicorn runtime.cloud.api:app --host 0.0.0.0 --port 8080
```

## Full workflow map

- `configs/` — runnable YAML configs and deployment settings.
- `scripts/` — data, training, and export automation.
- `runtime/cloud/` — API wrapper and Modal deployment entrypoint.
- `runtime/story_bible/` — JSON-like typed schemas, saliency, context assembly.
- `runtime/browser/` — local runtime selector and model chunk caching helpers.
- `docs/` — architecture + operations runbook.

## Important note on model artifacts

Training checkpoints and published model artifacts are generated into `artifacts/` when you run GPU jobs; they are intentionally excluded from git.

## Non-integration guardrail

All Narratryx code remains isolated under `llm/Narratryx/` and is not imported by app runtime files.
