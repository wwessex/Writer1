"""Modal deployment entrypoint for Narratryx vLLM service."""

from __future__ import annotations

import modal

app = modal.App("narratryx-vllm")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install("vllm==0.6.3.post1")
)

MODEL_DIR = "/models/narratryx"


@app.function(image=image, gpu="A10G", timeout=60 * 60, scaledown_window=300)
@modal.web_server(port=8000)
def serve() -> None:
    import subprocess

    subprocess.run(
        [
            "python",
            "-m",
            "vllm.entrypoints.openai.api_server",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--model",
            MODEL_DIR,
            "--max-model-len",
            "32768",
            "--gpu-memory-utilization",
            "0.92",
        ],
        check=True,
    )
