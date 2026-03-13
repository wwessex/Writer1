# Narratryx Architecture

## Training pipeline

1. **Continued pretraining data** from PG-19 and Gutenberg English.
2. **Instruction SFT data** from LongPage + Neural-Story + WritingPrompts.
3. **DPO pairs** built from high-quality references vs model-style negatives.
4. **QLoRA SFT** on Qwen2.5-7B.
5. **DPO refinement** on pairwise prose preferences.
6. **Export** to SafeTensors (cloud), GGUF (offline), and MLC (web).

## Data strategy

- Gutenberg cleanup removes boilerplate and trademark references.
- Chunks are generated with overlap for pretraining continuity.
- SFT output is normalized to instruction/response plain text format.
- DPO examples store `{prompt, chosen, rejected}` records.

## Deployment targets

- **Cloud:** vLLM-compatible checkpoint from HF-style directory.
- **Browser:** MLC compile for WebLLM path.
- **Fallback offline:** GGUF quantized artifacts for wllama/llama.cpp paths.

## Isolation boundary

Narratryx is intentionally self-contained under `llm/Narratryx` and does not alter app runtime boundaries.
