# Narratryx Runbook

## 0) Environment

```bash
cd llm/Narratryx
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 1) Build datasets

```bash
python scripts/build_datasets.py \
  --output-dir artifacts/data \
  --max-books 5000 \
  --max-sft-records 20000 \
  --max-dpo-pairs 15000
```

Outputs:
- `artifacts/data/pretrain_chunks.jsonl`
- `artifacts/data/sft_train.jsonl`
- `artifacts/data/dpo_pairs.jsonl`
- `artifacts/data/manifest.json`

## 2) SFT (QLoRA)

```bash
python scripts/run_training.py --stage sft
```

This prints/executes an Axolotl-compatible command:
`axolotl train configs/qwen25-7b-sft-qlora.yaml`

## 3) DPO

```bash
python scripts/run_training.py --stage dpo
```

## 4) Export

```bash
python scripts/export_model.py \
  --hf-dir artifacts/checkpoints/qwen25-7b-dpo \
  --gguf-out artifacts/exports/narratryx-q4_k_m.gguf \
  --quantization Q4_K_M
```

Optional web compile:

```bash
python scripts/export_model.py \
  --hf-dir artifacts/checkpoints/qwen25-7b-dpo \
  --mlc-out artifacts/exports/mlc \
  --compile-mlc
```

## 5) Verification checklist

- Validate dataset counts in `manifest.json`.
- Run `--dry-run` before every training stage.
- Keep generated artifacts in `artifacts/` and out of git.

## Explicit non-goal

No integration into DraftHarbour app runtime in this runbook.
