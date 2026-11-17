"""Voices API: create, list, delete local voice profiles."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from .. import database
from ..config import ALLOWED_AUDIO_EXT, MAX_UPLOAD_BYTES, ensure_voice_dir
from ..models import Message, VoiceOut
from ..storage import safe_voice_path
from ..tts_engine import TTSEngine

router = APIRouter(prefix="/voices", tags=["voices"])


def _row_to_out(row) -> VoiceOut:
    return VoiceOut(
        id=row["id"],
        name=row["name"],
        language=row["language"],
        original_audio=row["original_audio_path"],
        created_at=row["created_at"],
    )


@router.get("", response_model=list[VoiceOut])
def list_voices() -> list[VoiceOut]:
    with database.get_connection() as conn:
        rows = conn.execute("SELECT * FROM voices ORDER BY created_at DESC").fetchall()
    return [_row_to_out(r) for r in rows]


@router.post("", response_model=VoiceOut)
async def create_voice(
    name: str = Form(...),
    language: str = Form("english"),
    audio: UploadFile = File(...),
) -> VoiceOut:
    # Validate extension.
    ext = Path(audio.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(400, f"Unsupported file type. Allowed: {sorted(ALLOWED_AUDIO_EXT)}")

    # Read with size limit.
    data = await audio.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Audio sample too large (max 25 MB).")

    engine = TTSEngine.instance()
    if not engine.available():
        raise HTTPException(
            503,
            "Pocket TTS is not installed on the backend. Run the backend setup first.",
            headers={"X-Detail": engine.import_error() or ""},
        )

    voice_id = f"voice_{uuid.uuid4().hex[:12]}"
    vdir = ensure_voice_dir(voice_id)

    # Save the original sample.
    sample_path = safe_voice_path(voice_id, f"voice{ext}")
    sample_path.write_bytes(data)

    profile_path = safe_voice_path(voice_id, "voice_profile.safetensors")

    # Build the reusable voice profile (may take a few seconds).
    try:
        engine.create_voice_profile(sample_path, profile_path)
    except Exception as e:
        # Clean up the partial voice directory on failure.
        _cleanup_dir(vdir)
        raise HTTPException(500, f"Failed to process voice sample: {e}") from e

    # Persist metadata.
    with database.get_connection() as conn:
        conn.execute(
            "INSERT INTO voices (id, name, profile_path, original_audio_path, language) "
            "VALUES (?, ?, ?, ?, ?)",
            (voice_id, name, str(profile_path), str(sample_path), language),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM voices WHERE id = ?", (voice_id,)).fetchone()

    # Write a human-readable metadata.json next to the profile.
    metadata = {"id": voice_id, "name": name, "language": language,
                "profile": str(profile_path), "sample": str(sample_path)}
    safe_voice_path(voice_id, "metadata.json").write_text(json.dumps(metadata, indent=2))

    return _row_to_out(row)


@router.delete("/{voice_id}", response_model=Message)
def delete_voice(voice_id: str) -> Message:
    with database.get_connection() as conn:
        row = conn.execute("SELECT * FROM voices WHERE id = ?", (voice_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Voice not found.")
        # Remove DB row (cascades to generations metadata).
        conn.execute("DELETE FROM voices WHERE id = ?", (voice_id,))
        # Also drop generation rows whose audio files reference this voice.
        gen_rows = conn.execute(
            "SELECT audio_path FROM generations WHERE voice_id = ?", (voice_id,)
        ).fetchall()
        conn.commit()

    # Delete local files for the voice profile.
    vdir = Path(row["profile_path"]).parent
    if vdir.exists():
        _cleanup_dir(vdir)

    # Delete generated audio files that used this voice.
    for g in gen_rows:
        try:
            Path(g["audio_path"]).unlink(missing_ok=True)
        except Exception:
            pass

    return Message(message=f"Deleted voice '{row['name']}' and its files.")


def _cleanup_dir(d: Path) -> None:
    """Remove a directory and its contents."""
    if not d.exists():
        return
    for p in d.rglob("*"):
        if p.is_file():
            try:
                p.unlink()
            except Exception:
                pass
    try:
        d.rmdir()
    except Exception:
        pass
