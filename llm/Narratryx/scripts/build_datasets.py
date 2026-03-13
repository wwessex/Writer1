"""Build Narratryx data artifacts for pretraining, SFT, and DPO."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from datasets import load_dataset

from prepare_narratryx_data import chunk_text, clean_gutenberg_text, normalize_text


def _write_jsonl(records: list[dict[str, Any]], out_file: Path) -> int:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8") as handle:
        for row in records:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(records)


def build_pretrain(output_dir: Path, max_books: int, chunk_size: int, overlap: int) -> int:
    pg19 = load_dataset("pg19", split="train")
    rows: list[dict[str, str]] = []
    for i, item in enumerate(pg19):
        if i >= max_books:
            break
        raw = item.get("text", "")
        cleaned = clean_gutenberg_text(raw)
        for c in chunk_text(cleaned, chunk_size=chunk_size, overlap=overlap):
            rows.append({"text": c, "source": "pg19"})
    return _write_jsonl(rows, output_dir / "pretrain_chunks.jsonl")


def _as_instruction(record: dict[str, Any]) -> str | None:
    prompt = normalize_text(str(record.get("prompt", "") or record.get("instruction", "")))
    response = normalize_text(str(record.get("response", "") or record.get("output", "")))
    if not prompt or not response:
        return None
    return f"### Instruction\n{prompt}\n\n### Response\n{response}"


def build_sft(output_dir: Path, max_records: int) -> int:
    ds = load_dataset("NeuralNovel/Neural-Story-v1", split="train")
    rows: list[dict[str, str]] = []
    for record in ds:
        text = _as_instruction(record)
        if text:
            rows.append({"text": text, "source": "NeuralNovel/Neural-Story-v1"})
        if len(rows) >= max_records:
            break
    return _write_jsonl(rows, output_dir / "sft_train.jsonl")


def build_dpo(output_dir: Path, max_pairs: int) -> int:
    ds = load_dataset("NeuralNovel/Neural-Story-v1", split="train")
    rows: list[dict[str, str]] = []
    for record in ds:
        prompt = normalize_text(str(record.get("prompt", "") or record.get("instruction", "")))
        chosen = normalize_text(str(record.get("response", "") or record.get("output", "")))
        if not (prompt and chosen):
            continue
        rejected = "Rewrite this scene with flatter diction and less specificity."
        rows.append({"prompt": prompt, "chosen": chosen, "rejected": rejected})
        if len(rows) >= max_pairs:
            break
    return _write_jsonl(rows, output_dir / "dpo_pairs.jsonl")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Narratryx datasets.")
    p.add_argument("--output-dir", type=Path, default=Path("artifacts/data"))
    p.add_argument("--max-books", type=int, default=2000)
    p.add_argument("--max-sft-records", type=int, default=15000)
    p.add_argument("--max-dpo-pairs", type=int, default=12000)
    p.add_argument("--chunk-size", type=int, default=4096)
    p.add_argument("--overlap", type=int, default=512)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    pretrain_count = build_pretrain(args.output_dir, args.max_books, args.chunk_size, args.overlap)
    sft_count = build_sft(args.output_dir, args.max_sft_records)
    dpo_count = build_dpo(args.output_dir, args.max_dpo_pairs)

    manifest = {
        "pretrain_chunks": pretrain_count,
        "sft_records": sft_count,
        "dpo_pairs": dpo_count,
        "params": {
            "max_books": args.max_books,
            "max_sft_records": args.max_sft_records,
            "max_dpo_pairs": args.max_dpo_pairs,
            "chunk_size": args.chunk_size,
            "overlap": args.overlap,
        },
    }

    manifest_file = args.output_dir / "manifest.json"
    manifest_file.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Built data artifacts in {args.output_dir}")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
