"""Generate speech API: text -> audio via Pocket TTS, saved as MP3 locally."""

from __future__ import annotations

import logging
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from .. import database
from ..audio_utils import pcm_to_wav, wav_to_mp3
from ..config import DEFAULT_LANGUAGE, GENERATED_DIR, TEMP_DIR
from ..models import GenerateRequest, GenerationOut
from ..storage import safe_generated_path
from ..text_chunker import split_text
from ..tts_engine import TTSEngine

logger = logging.getLogger("voiceclone.generate")
router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("", response_model=GenerationOut)
def generate(req: GenerateRequest) -> GenerationOut:
    # Look up the voice profile path.
    with database.get_connection() as conn:
        voice = conn.execute("SELECT * FROM voices WHERE id = ?", (req.voice_id,)).fetchone()
        if not voice:
            raise HTTPException(404, "Voice not found.")

    profile_path = Path(voice["profile_path"])
    if not profile_path.exists():
        raise HTTPException(410, "Voice profile file is missing from disk.")

    engine = TTSEngine.instance()
    if not engine.available():
        raise HTTPException(503, "Pocket TTS is not installed on the backend.")

    chunks = split_text(req.text)
    if not chunks:
        raise HTTPException(400, "Text is empty.")

    generation_id = f"gen_{uuid.uuid4().hex[:12]}"
    mp3_filename = f"{generation_id}.mp3"
    mp3_path = safe_generated_path(mp3_filename)

    # Process chunks. For a single chunk we convert directly; for multiple we
    # write each to a temp WAV, convert to MP3, then concatenate.
    temp_files: list[Path] = []
    try:
        if len(chunks) == 1:
            _synthesize_chunk(engine, profile_path, req.voice_id, chunks[0], mp3_path)
        else:
            mp3_parts: list[Path] = []
            for i, chunk in enumerate(chunks):
                part = TEMP_DIR / f"{generation_id}_part{i}.mp3"
                _synthesize_chunk(engine, profile_path, req.voice_id, chunk, part)
                mp3_parts.append(part)
                temp_files.append(part)
            _concatenate_mp3(mp3_parts, mp3_path)
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(500, f"Speech generation failed: {e}") from e
    finally:
        # Clean up temp processing files.
        for t in temp_files:
            try:
                t.unlink(missing_ok=True)
            except Exception:
                pass

    # Store metadata.
    with database.get_connection() as conn:
        conn.execute(
            "INSERT INTO generations (id, voice_id, text, language, speed, audio_path) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (generation_id, req.voice_id, req.text, req.language, req.speed, str(mp3_path)),
        )
        conn.commit()
        row = conn.execute(
            "SELECT g.*, v.name AS voice_name FROM generations g "
            "LEFT JOIN voices v ON v.id = g.voice_id WHERE g.id = ?",
            (generation_id,),
        ).fetchone()

    return _row_to_out(row)


@router.get("/history", response_model=list[GenerationOut])
def history(limit: int = 50) -> list[GenerationOut]:
    with database.get_connection() as conn:
        rows = conn.execute(
            "SELECT g.*, v.name AS voice_name FROM generations g "
            "LEFT JOIN voices v ON v.id = g.voice_id "
            "ORDER BY g.created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [_row_to_out(r) for r in rows]


@router.delete("/{generation_id}", response_model=dict)
def delete_generation(generation_id: str) -> dict:
    with database.get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM generations WHERE id = ?", (generation_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Generation not found.")
        conn.execute("DELETE FROM generations WHERE id = ?", (generation_id,))
        conn.commit()
    try:
        Path(row["audio_path"]).unlink(missing_ok=True)
    except Exception:
        pass
    return {"message": "Deleted generation."}


def _row_to_out(row) -> GenerationOut:
    audio_path = Path(row["audio_path"])
    return GenerationOut(
        id=row["id"],
        voice_id=row["voice_id"],
        voice_name=row["voice_name"],
        text=row["text"],
        language=row["language"],
        speed=row["speed"],
        audio_url=f"/audio/{audio_path.name}",
        created_at=row["created_at"],
    )


def _synthesize_chunk(
    engine: TTSEngine,
    profile_path: Path,
    voice_id: str,
    text: str,
    out_mp3: Path,
) -> None:
    """Synthesize one text chunk to an MP3 file."""
    sample_rate, audio = engine.generate(profile_path, voice_id, text)
    # Convert tensor/array to numpy if needed.
    arr = _to_numpy(audio)
    with tempfile.NamedTemporaryFile(suffix=".wav", dir=TEMP_DIR, delete=False) as tmp:
        wav_tmp = Path(tmp.name)
    try:
        pcm_to_wav(arr, sample_rate, wav_tmp)
        wav_to_mp3(wav_tmp, out_mp3)
    finally:
        wav_tmp.unlink(missing_ok=True)


def _to_numpy(audio) -> "any":  # type: ignore[name-defined]
    """Convert a torch tensor or numpy array to a 1D numpy array."""
    import numpy as np

    if hasattr(audio, "numpy"):
        audio = audio.numpy()
    elif hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    return np.asarray(audio).reshape(-1)


def _concatenate_mp3(parts: list[Path], out: Path) -> None:
    """Concatenate MP3 files by joining their byte streams.

    For Pocket TTS output (constant bitrate, no ID3 tags) this produces a
    playable MP3. Falls back to FFmpeg concat if available for robustness.
    """
    import shutil as _sh

    if _sh.which("ffmpeg"):
        # Use FFmpeg concat demuxer for clean joining.
        list_file = TEMP_DIR / f"{out.stem}_concat.txt"
        list_file.write_text("".join(f"file '{p}'\n" for p in parts))
        try:
            import subprocess

            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                 "-i", str(list_file), "-c", "copy", str(out)],
                check=True, capture_output=True,
            )
            return
        except Exception:
            pass  # fall through to byte concat
        finally:
            list_file.unlink(missing_ok=True)

    # Byte-stream concat fallback.
    with open(out, "wb") as w:
        for p in parts:
            with open(p, "rb") as r:
                w.write(r.read())
