"""
Narratryx Cloud Gateway — FastAPI proxy for vLLM inference.

Routes OpenAI-compatible /v1/chat/completions requests to a vLLM backend,
injecting the Narratryx system prompt when none is provided.

Environment variables:
  NARRATRYX_VLLM_URL   — vLLM backend URL (default: http://127.0.0.1:8000)
  NARRATRYX_API_KEY    — optional API key for authenticating clients
  ALLOWED_ORIGINS      — comma-separated CORS origins (default: *)

Usage:
  uvicorn runtime.cloud.api:app --host 0.0.0.0 --port 8080
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

VLLM_URL = os.getenv("NARRATRYX_VLLM_URL", "http://127.0.0.1:8000")
API_KEY = os.getenv("NARRATRYX_API_KEY", "")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

DEFAULT_SYSTEM_PROMPT = (
    "You are Narratryx, a creative writing assistant specialised in fiction. "
    "You help authors craft vivid prose, develop compelling characters, maintain "
    "narrative consistency, and refine their writing style. When editing, preserve "
    "the author's voice while improving clarity, emotional impact, and literary quality."
)

app = FastAPI(title="Narratryx Gateway", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    max_tokens: int | None = 2048
    temperature: float | None = 0.7
    stream: bool | None = False
    # Pass through any extra fields
    model_config = {"extra": "allow"}


def _verify_api_key(request: Request) -> None:
    """Reject requests that don't carry the configured API key."""
    if not API_KEY:
        return
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _inject_system_prompt(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Prepend the Narratryx system prompt if none is present."""
    if any(m.role == "system" for m in messages):
        return messages
    return [ChatMessage(role="system", content=DEFAULT_SYSTEM_PROMPT), *messages]


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "backend": VLLM_URL}


@app.post("/v1/chat/completions")
async def chat_completions(body: ChatCompletionRequest, request: Request) -> Response:
    """Proxy chat completions to the vLLM backend."""
    _verify_api_key(request)

    body.messages = _inject_system_prompt(body.messages)
    payload = body.model_dump(exclude_none=True)

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            if body.stream:
                # Stream the response back
                backend_resp = await client.send(
                    client.build_request(
                        "POST",
                        f"{VLLM_URL}/v1/chat/completions",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    ),
                    stream=True,
                )
                return Response(
                    content=backend_resp.aiter_bytes(),
                    status_code=backend_resp.status_code,
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "X-Accel-Buffering": "no",
                    },
                )
            else:
                resp = await client.post(
                    f"{VLLM_URL}/v1/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                return Response(
                    content=resp.content,
                    status_code=resp.status_code,
                    media_type="application/json",
                )
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach vLLM backend at {VLLM_URL}")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="vLLM backend timed out")


@app.get("/v1/models")
async def list_models(request: Request) -> dict[str, Any]:
    """Proxy model listing to the vLLM backend."""
    _verify_api_key(request)

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{VLLM_URL}/v1/models")
            return resp.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach vLLM backend at {VLLM_URL}")
