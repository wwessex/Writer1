"""
Self-improving dataset pipeline for Narratryx

Flow:
1. Ingest user prompts + outputs
2. Generate improved versions via strong model (optional hook)
3. Score/filter
4. Append to training dataset (JSONL)
"""

import json
import time
from pathlib import Path

DATA_DIR = Path("llm/Narratryx/data")
RAW_LOG = DATA_DIR / "user_logs.jsonl"
CURATED = DATA_DIR / "curated_dataset.jsonl"


def score_sample(sample):
    """Simple heuristic scoring (replace later with model-based eval)"""
    text = sample.get("output", "")
    if len(text.split()) < 30:
        return 0
    if text.count("\n") > 10:
        return 0
    return 1


def improve_sample(sample):
    """Placeholder for LLM improvement step"""
    # Hook: call OpenAI / Claude / local model
    return sample


def process_logs():
    if not RAW_LOG.exists():
        print("No logs found")
        return

    curated = []

    with open(RAW_LOG, "r") as f:
        for line in f:
            sample = json.loads(line)

            improved = improve_sample(sample)

            if score_sample(improved):
                curated.append({
                    "instruction": improved.get("instruction"),
                    "input": improved.get("input", ""),
                    "output": improved.get("output")
                })

    with open(CURATED, "a") as f:
        for item in curated:
            f.write(json.dumps(item) + "\n")

    print(f"Added {len(curated)} samples to curated dataset")


if __name__ == "__main__":
    while True:
        process_logs()
        time.sleep(300)  # run every 5 mins
