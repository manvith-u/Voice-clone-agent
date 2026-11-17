"""Text chunking: split long text at sentence boundaries for TTS.

Pocket TTS can handle long inputs, but chunking keeps memory bounded and
lets us report progress to the frontend. We split at <= 2500 chars.
"""

from __future__ import annotations

import re

MAX_CHUNK = 2500


def split_text(text: str, max_len: int = MAX_CHUNK) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    if len(clean) <= max_len:
        return [clean] if clean else []

    chunks: list[str] = []
    remaining = clean
    while len(remaining) > max_len:
        slice_ = remaining[:max_len]
        # Prefer to break after sentence-ending punctuation.
        m = re.match(r".*[.!?](?=\s|$)", slice_, re.DOTALL)
        if m and m.group(0):
            cut = m.end()
        else:
            last_space = slice_.rfind(" ")
            cut = last_space if last_space > 0 else max_len
        chunk = remaining[:cut].strip()
        if chunk:
            chunks.append(chunk)
        remaining = remaining[cut:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks
