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

## 2) Continued pretraining (QLoRA)

```bash
python scripts/run_training.py --stage cpt
```

Adapts base model weights toward literary prose using Gutenberg fiction chunks.

## 3) SFT (QLoRA)

```bash
python scripts/run_training.py --stage sft
```

Chains from the CPT checkpoint to instruction-tune on fiction writing tasks.

## 4) DPO

```bash
python scripts/run_training.py --stage dpo
```

Chains from the SFT checkpoint to refine prose quality via preference optimization.

## 5) Export

**Prerequisites:** GGUF export requires [llama.cpp](https://github.com/ggerganov/llama.cpp).
Clone the repo and build `llama-quantize`, then ensure `convert-hf-to-gguf.py`
and `llama-quantize` are on your `PATH` (or run from the llama.cpp directory).

```bash
# Example: clone and build llama.cpp
git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp && make
export PATH="$PWD:$PATH"
cd -
```

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

## 6) Cloud runtime — NOT YET IMPLEMENTED

> The modules referenced below (`runtime/cloud/api.py`, `runtime/cloud/modal_app.py`,
> `configs/deploy/docker-compose.vllm.yaml`) do not exist yet. These commands document
> the intended interface for when the runtime layer is built.

Run gateway against existing vLLM server:

```bash
NARRATRYX_VLLM_URL=http://127.0.0.1:8000 \
uvicorn runtime.cloud.api:app --host 0.0.0.0 --port 8080
```

Modal deployment entrypoint:

```bash
modal deploy runtime/cloud/modal_app.py
```

Self-hosted compose option:

```bash
docker compose -f configs/deploy/docker-compose.vllm.yaml up
```

## 7) Browser/runtime modules — NOT YET IMPLEMENTED

> The modules referenced below (`runtime/browser/serviceWorker.js`,
> `runtime/browser/modelLoader.ts`, `runtime/story_bible/*`) do not exist yet.
> These describe the intended architecture for browser-based inference.

- Register `runtime/browser/serviceWorker.js` for chunked model caching route.
- Use `runtime/browser/modelLoader.ts` to choose WebLLM / Wllama / cloud fallback.
- Use `runtime/story_bible/*` for IndexedDB schemas, saliency ranking, and context assembly.

## 8) Verification checklist

- Validate dataset counts and `dpo_method` in `manifest.json`.
- Run `--dry-run` before every training stage.
- Keep generated artifacts in `artifacts/` and out of git.

## Explicit non-goal

No integration into DraftHarbour app runtime in this runbook.
