"""Export Narratryx checkpoints to GGUF and optional MLC format."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Export model artifacts.")
    p.add_argument("--hf-dir", type=Path, required=True)
    p.add_argument("--gguf-out", type=Path, default=Path("artifacts/exports/narratryx.gguf"))
    p.add_argument("--quantization", default="Q4_K_M")
    p.add_argument("--compile-mlc", action="store_true")
    p.add_argument("--mlc-out", type=Path, default=Path("artifacts/exports/mlc"))
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def run_cmd(cmd: list[str], dry_run: bool) -> None:
    print(" ".join(map(str, cmd)))
    if not dry_run:
        subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()
    args.gguf_out.parent.mkdir(parents=True, exist_ok=True)

    fp16_gguf = args.gguf_out.with_suffix(".f16.gguf")
    run_cmd(
        [
            "python",
            "convert-hf-to-gguf.py",
            str(args.hf_dir),
            "--outfile",
            str(fp16_gguf),
            "--outtype",
            "f16",
        ],
        args.dry_run,
    )

    run_cmd(
        [
            "llama-quantize",
            str(fp16_gguf),
            str(args.gguf_out),
            args.quantization,
        ],
        args.dry_run,
    )

    if args.compile_mlc:
        args.mlc_out.mkdir(parents=True, exist_ok=True)
        run_cmd(
            [
                "mlc_llm",
                "compile",
                str(args.hf_dir),
                "--device",
                "webgpu",
                "--quantization",
                "q4f16_1",
                "--output",
                str(args.mlc_out),
            ],
            args.dry_run,
        )


if __name__ == "__main__":
    main()
