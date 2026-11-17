"""Backup & restore API.

* ``POST /backup/export`` — zips all voices + the SQLite DB into one file
  and returns it as a download.
* ``POST /backup/restore`` — accepts a backup zip and restores voices + DB.
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

from .. import database
from ..config import DB_PATH, GENERATED_DIR, VOICES_DIR
from ..models import Message

router = APIRouter(prefix="/backup", tags=["backup"])


@router.post("/export")
async def export_backup() -> dict:
    """Create a zip with the SQLite DB and all voice profiles."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if DB_PATH.exists():
            zf.write(DB_PATH, arcname="database/voiceclone.db")
        # Include all voice profile directories.
        if VOICES_DIR.exists():
            for p in VOICES_DIR.rglob("*"):
                if p.is_file():
                    zf.write(p, arcname=str(p.relative_to(VOICES_DIR.parent)))
        # Include generated audio too (optional but useful).
        if GENERATED_DIR.exists():
            for p in GENERATED_DIR.glob("*"):
                if p.is_file():
                    zf.write(p, arcname=str(p.relative_to(VOICES_DIR.parent)))
    buf.seek(0)
    # Write to disk and return a URL the frontend can download.
    from ..config import TEMP_DIR

    backup_path = TEMP_DIR / "voiceclone_backup.zip"
    backup_path.write_bytes(buf.getvalue())
    return {"url": "/audio/voiceclone_backup.zip", "filename": "voiceclone_backup.zip"}


@router.post("/restore", response_model=Message)
async def restore_backup(file: UploadFile = File(...)) -> Message:
    """Restore voices and DB from a backup zip.

    Existing voice profiles with the same id are overwritten. The DB is
    merged by inserting voices that don't already exist.
    """
    data = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(400, f"Invalid backup file: {e}") from e

    restored = 0
    with zf:
        # Restore voice profile files.
        for name in zf.namelist():
            if name.startswith("voices/") and not name.endswith("/"):
                rel = name  # e.g. voices/voice_001/voice_profile.safetensors
                target = VOICES_DIR.parent / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(zf.read(name))

        # Merge the backed-up DB into the current one.
        db_entry = [n for n in zf.namelist() if n == "database/voiceclone.db"]
        if db_entry:
            tmp_db = VOICES_DIR.parent / "_restore.db"
            tmp_db.write_bytes(zf.read(db_entry[0]))
            try:
                _merge_db(tmp_db)
                # Count voices in restored DB.
                with database.get_connection() as conn:
                    count = conn.execute("SELECT COUNT(*) FROM voices").fetchone()[0]
                restored = count
            finally:
                tmp_db.unlink(missing_ok=True)

    return Message(message=f"Backup restored. {restored} voice(s) available.")


def _merge_db(source_db: Path) -> None:
    """Copy voice rows from the backup DB into the live DB (insert-or-ignore)."""
    import sqlite3

    src = sqlite3.connect(str(source_db))
    src.row_factory = sqlite3.Row
    try:
        rows = src.execute("SELECT * FROM voices").fetchall()
    finally:
        src.close()

    with database.get_connection() as conn:
        for r in rows:
            conn.execute(
                "INSERT OR IGNORE INTO voices (id, name, profile_path, original_audio_path, language, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (r["id"], r["name"], r["profile_path"], r["original_audio_path"],
                 r["language"], r["created_at"]),
            )
        conn.commit()
