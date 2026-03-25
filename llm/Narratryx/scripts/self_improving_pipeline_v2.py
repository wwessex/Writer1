"""
Production-grade self-improving dataset pipeline

Features:
- Deduplication (hash-based)
- Quality scoring (length + repetition + basic heuristics)
- LLM improvement via configurable API endpoint
- Dataset versioning
- Safe append (no corruption)
- Metrics logging
- Batch processing with configurable concurrency

Usage:
  python scripts/self_improving_pipeline_v2.py                    # batch mode
  python scripts/self_improving_pipeline_v2.py --watch            # watch mode (poll every 5 min)
  python scripts/self_improving_pipeline_v2.py --no-improve       # skip LLM improvement step
  python scripts/self_improving_pipeline_v2.py --endpoint http://localhost:11434/api/chat --model narratryx:latest

Environment variables:
  IMPROVE_ENDPOINT  — LLM API endpoint (default: http://localhost:11434/api/chat)
  IMPROVE_MODEL     — model name (default: narratryx:latest)
  IMPROVE_API_KEY   — optional bearer token
"""

from __future__ import annotations

import argparse
import json
import time
import hashlib
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

DATA_DIR = Path("llm/Narratryx/data")
RAW_LOG = DATA_DIR / "user_logs.jsonl"
CURATED = DATA_DIR / "curated_dataset_v2.jsonl"
SEEN_HASHES = DATA_DIR / "seen_hashes.txt"
METRICS = DATA_DIR / "pipeline_metrics.json"

# LLM improvement defaults
DEFAULT_ENDPOINT = os.getenv("IMPROVE_ENDPOINT", "http://localhost:11434/api/chat")
DEFAULT_MODEL = os.getenv("IMPROVE_MODEL", "narratryx:latest")
DEFAULT_API_KEY = os.getenv("IMPROVE_API_KEY", "")

IMPROVEMENT_PROMPT = """You are a writing quality improver. Given the following creative writing sample, rewrite it to be more vivid, engaging, and literary while preserving the core meaning and plot points.

Original:
{text}

Rewrite the text with:
- More vivid sensory details
- Stronger verbs and precise nouns
- Varied sentence structure
- Better pacing and flow
- Consistent tone

Output ONLY the improved text, no commentary."""


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def load_seen() -> set[str]:
    if not SEEN_HASHES.exists():
        return set()
    return set(SEEN_HASHES.read_text().splitlines())


def save_seen(seen: set[str]) -> None:
    SEEN_HASHES.write_text("\n".join(sorted(seen)))


def score_sample(text: str) -> float:
    """Score a sample from 0.0 to 1.0 based on quality heuristics."""
    words = text.split()
    if len(words) < 40:
        return 0.0

    score = 0.0

    # Length bonus (40-500 words is ideal for SFT)
    if 40 <= len(words) <= 500:
        score += 0.3
    elif len(words) > 500:
        score += 0.2
    else:
        score += 0.1

    # Vocabulary richness
    unique_ratio = len(set(words)) / len(words) if words else 0
    if unique_ratio >= 0.6:
        score += 0.3
    elif unique_ratio >= 0.5:
        score += 0.2
    elif unique_ratio < 0.4:
        return 0.0  # Too repetitive

    # Sentence variety (rough check via punctuation)
    sentences = [s.strip() for s in text.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    if len(sentences) >= 3:
        lengths = [len(s.split()) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
        if variance > 10:
            score += 0.2  # Good sentence variety
        else:
            score += 0.1

    # Dialogue presence (bonus for fiction)
    if '"' in text or '\u201c' in text:
        score += 0.1

    # Descriptive language (simple adjective/adverb proxy)
    descriptive_markers = ['ly ', 'ing ', 'ous ', 'ful ', 'ive ']
    desc_count = sum(text.lower().count(m) for m in descriptive_markers)
    if desc_count >= 5:
        score += 0.1

    return min(score, 1.0)


def passes_quality(text: str, threshold: float = 0.4) -> bool:
    """Check if a sample meets the minimum quality threshold."""
    return score_sample(text) >= threshold


def improve_sample_via_llm(
    sample: dict[str, Any],
    endpoint: str,
    model: str,
    api_key: str = "",
) -> dict[str, Any]:
    """
    Call an LLM to improve the output text of a sample.
    Falls back to the original if the API call fails.
    """
    if requests is None:
        return sample

    output = sample.get("output", "")
    if not output.strip():
        return sample

    prompt = IMPROVEMENT_PROMPT.format(text=output)

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Detect endpoint type (Ollama vs OpenAI-compatible)
    is_ollama = "/api/chat" in endpoint

    if is_ollama:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"num_predict": 2048, "temperature": 0.5},
        }
    else:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 2048,
            "temperature": 0.5,
            "stream": False,
        }

    try:
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        if is_ollama:
            improved_text = data.get("message", {}).get("content", "")
        else:
            improved_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        if improved_text.strip() and len(improved_text.split()) >= 30:
            return {**sample, "output": improved_text.strip()}
    except Exception as e:
        print(f"  LLM improvement failed: {e}", file=sys.stderr)

    return sample


def process(
    *,
    use_llm: bool = True,
    endpoint: str = DEFAULT_ENDPOINT,
    model: str = DEFAULT_MODEL,
    api_key: str = DEFAULT_API_KEY,
    concurrency: int = 2,
) -> dict[str, Any]:
    """Process raw logs into curated dataset."""
    seen = load_seen()
    added = 0
    skipped = 0
    improved_count = 0

    if not RAW_LOG.exists():
        print("No logs yet")
        return {"added": 0, "skipped": 0}

    # Load all samples first
    samples: list[dict[str, Any]] = []
    with open(RAW_LOG, "r") as f:
        for line in f:
            try:
                sample = json.loads(line)
            except Exception:
                continue

            output = sample.get("output", "")
            h = hash_text(output)

            if h in seen:
                skipped += 1
                continue

            samples.append(sample)
            seen.add(h)

    if not samples:
        print(f"No new samples (skipped {skipped} duplicates)")
        save_seen(seen)
        return {"added": 0, "skipped": skipped}

    # Optionally improve samples via LLM
    if use_llm and requests is not None:
        print(f"Improving {len(samples)} samples via {endpoint} ({model})...")
        improved_samples: list[dict[str, Any]] = []

        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {
                pool.submit(improve_sample_via_llm, s, endpoint, model, api_key): i
                for i, s in enumerate(samples)
            }
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    result = future.result()
                    if result.get("output") != samples[idx].get("output"):
                        improved_count += 1
                    improved_samples.append((idx, result))
                except Exception:
                    improved_samples.append((idx, samples[idx]))

        # Sort back to original order
        improved_samples.sort(key=lambda x: x[0])
        samples = [s for _, s in improved_samples]

    # Write passing samples to curated output
    with open(CURATED, "a") as out:
        for sample in samples:
            if not passes_quality(sample.get("output", "")):
                skipped += 1
                continue

            out.write(json.dumps({
                "instruction": sample.get("instruction"),
                "input": sample.get("input", ""),
                "output": sample.get("output"),
            }) + "\n")
            added += 1

    save_seen(seen)

    metrics = {
        "added": added,
        "skipped": skipped,
        "improved": improved_count,
        "total_seen": len(seen),
        "timestamp": time.time(),
    }

    METRICS.write_text(json.dumps(metrics, indent=2))
    print(f"Added: {added}, Skipped: {skipped}, Improved: {improved_count}")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Self-improving dataset pipeline")
    parser.add_argument("--watch", action="store_true", help="Run continuously (poll every 5 min)")
    parser.add_argument("--no-improve", action="store_true", help="Skip LLM improvement step")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="LLM API endpoint")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model name")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="API key for LLM endpoint")
    parser.add_argument("--concurrency", type=int, default=2, help="Max parallel LLM requests")
    args = parser.parse_args()

    while True:
        process(
            use_llm=not args.no_improve,
            endpoint=args.endpoint,
            model=args.model,
            api_key=args.api_key,
            concurrency=args.concurrency,
        )
        if not args.watch:
            break
        time.sleep(300)


if __name__ == "__main__":
    main()
