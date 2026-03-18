"""Run or print Narratryx training commands for SFT/DPO."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


STAGE_TO_CONFIG = {
    "cpt": Path("configs/qwen25-7b-cpt-qlora.yaml"),
    "sft": Path("configs/qwen25-7b-sft-qlora.yaml"),
    "dpo": Path("configs/qwen25-7b-dpo.yaml"),
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run Narratryx training stages.")
    p.add_argument("--stage", choices=sorted(STAGE_TO_CONFIG.keys()), required=True)
    p.add_argument("--dry-run", action="store_true", help="Only print command")
    p.add_argument("--trainer", default="axolotl", choices=["axolotl", "unsloth"])
    return p.parse_args()


def build_command(stage: str, trainer: str) -> list[str]:
    config = STAGE_TO_CONFIG[stage]
    if trainer == "axolotl":
        return ["axolotl", "train", str(config)]
    return ["python", "-m", "unsloth_cli", "train", "--config", str(config)]


def main() -> None:
    args = parse_args()
    cmd = build_command(args.stage, args.trainer)
    print(" ".join(cmd))
    if not args.dry_run:
        subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
