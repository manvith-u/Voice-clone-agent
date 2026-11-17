"""Safe filesystem helpers with path-traversal prevention.

Every user-supplied path segment is validated so it cannot escape the
configured storage directories.
"""

from __future__ import annotations

from pathlib import Path

from .config import GENERATED_DIR, VOICES_DIR


def safe_voice_path(voice_id: str, *parts: str) -> Path:
    """Build a path inside a voice's directory, refusing traversal.

    ``voice_id`` must be a simple identifier (no path separators). Extra
    ``parts`` are joined and resolved, then checked to remain inside the
    voice directory.
    """
    if not voice_id or "/" in voice_id or "\\" in voice_id or ".." in voice_id:
        raise ValueError("Invalid voice id")
    base = (VOICES_DIR / voice_id).resolve()
    full = base.joinpath(*parts).resolve()
    if not str(full).startswith(str(base)):
        raise ValueError("Path traversal detected")
    return full


def safe_generated_path(filename: str) -> Path:
    """Return a path inside the generated-audio directory."""
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError("Invalid filename")
    full = (GENERATED_DIR / filename).resolve()
    if not str(full).startswith(str(GENERATED_DIR.resolve())):
        raise ValueError("Path traversal detected")
    return full
