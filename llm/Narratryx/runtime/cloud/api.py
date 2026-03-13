"""Narratryx cloud runtime: OpenAI-compatible gateway for vLLM backend."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

VLLM_BASE_URL = os.getenv("NARRATRYX_VLLM_URL", "http://127.0.0.1:8000")
DEFAULT_MODEL = os.getenv("NARRATRYX_MODEL_NAME", "Narratryx-Qwen2.5-7B")

app = FastAPI(title="Narratryx Cloud API", version="0.1.0")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = Field(default=DEFAULT_MODEL)
    messages: list[ChatMessage]
    temperature: float = 0.8
    max_tokens: int = 800
    stream: bool = False


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "narratryx-cloud-api"}


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest) -> Any:
    payload = req.model_dump()
    target = f"{VLLM_BASE_URL}/v1/chat/completions"
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(target, json=payload)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
