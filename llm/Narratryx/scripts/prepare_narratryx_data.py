"""Shared data-cleaning utilities for Narratryx dataset builders."""

from __future__ import annotations

import re
from typing import Iterable, Iterator

START_RE = re.compile(
    r"\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
    re.IGNORECASE | re.DOTALL,
)
END_RE = re.compile(
    r"\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
    re.IGNORECASE | re.DOTALL,
)
TM_RE = re.compile(r"Project Gutenberg(?:-tm)?", re.IGNORECASE)
WS_RE = re.compile(r"\s+")


def clean_gutenberg_text(text: str) -> str:
    """Strip Gutenberg wrappers and normalize whitespace."""
    start_match = START_RE.search(text)
    end_match = END_RE.search(text)

    if start_match and end_match and end_match.start() > start_match.end():
        text = text[start_match.end() : end_match.start()]

    text = TM_RE.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_text(text: str) -> str:
    """Flatten text enough for robust record formatting."""
    return WS_RE.sub(" ", text).strip()


def chunk_text(text: str, chunk_size: int = 4096, overlap: int = 512) -> Iterator[str]:
    """Character chunking with overlap for pretraining corpora."""
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be > overlap")
    step = chunk_size - overlap
    for start in range(0, len(text), step):
        chunk = text[start : start + chunk_size].strip()
        if chunk:
            yield chunk


def safe_take(records: Iterable[str], limit: int) -> list[str]:
    """Collect up to `limit` non-empty records."""
    out: list[str] = []
    for item in records:
        if item:
            out.append(item)
        if len(out) >= limit:
            break
    return out
