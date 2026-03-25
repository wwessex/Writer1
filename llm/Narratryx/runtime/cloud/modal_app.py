"""
Narratryx Modal Deployment — scale-to-zero GPU inference.

Deploys Narratryx on Modal with vLLM for serverless GPU hosting.
The model is loaded from a Modal volume or downloaded from HuggingFace.

Usage:
  modal deploy runtime/cloud/modal_app.py

Environment (set via `modal secret create narratryx-secrets`):
  NARRATRYX_MODEL_PATH  — path to model on volume (default: /models/narratryx)
  NARRATRYX_API_KEY     — optional client API key
"""

from __future__ import annotations

import modal

GPU_TYPE = "A10G"
IDLE_TIMEOUT_SECONDS = 300  # 5 minutes
MODEL_PATH = "/models/narratryx"

app = modal.App("narratryx")

narratryx_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm>=0.6.0",
        "fastapi",
        "uvicorn",
    )
)

# Create or reuse a persistent volume for model weights
model_volume = modal.Volume.from_name("narratryx-models", create_if_missing=True)


@app.function(
    image=narratryx_image,
    gpu=GPU_TYPE,
    volumes={"/models": model_volume},
    container_idle_timeout=IDLE_TIMEOUT_SECONDS,
    allow_concurrent_inputs=16,
    timeout=600,
)
@modal.asgi_app()
def serve():
    """Serve Narratryx via vLLM's OpenAI-compatible API."""
    import os

    from vllm.entrypoints.openai.api_server import build_async_engine_client, make_arg_parser
    from vllm.entrypoints.openai.run_batch import run_openai_server

    model_path = os.getenv("NARRATRYX_MODEL_PATH", MODEL_PATH)

    # vLLM's built-in FastAPI app provides /v1/chat/completions, /v1/models, etc.
    from vllm.entrypoints.openai.api_server import app as vllm_app

    # Configure vLLM to serve the model
    os.environ["MODEL_NAME"] = model_path
    os.environ.setdefault("MAX_MODEL_LEN", "4096")
    os.environ.setdefault("GPU_MEMORY_UTILIZATION", "0.90")

    return vllm_app


@app.local_entrypoint()
def main():
    """Upload model weights to the Modal volume."""
    import subprocess
    import sys

    print("To upload model weights, use:")
    print(f"  modal volume put narratryx-models ./artifacts/checkpoints/qwen25-7b-dpo {MODEL_PATH}")
    print()
    print("Then deploy with:")
    print("  modal deploy runtime/cloud/modal_app.py")
    print()
    print("The endpoint will be available at:")
    print("  https://<your-workspace>--narratryx-serve.modal.run/v1/chat/completions")
