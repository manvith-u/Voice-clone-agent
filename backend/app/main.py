"""FastAPI application entrypoint.

Run locally with:

    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

The API binds to localhost only. All voice profiles and generated audio
stay on this machine.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import database
from .config import GENERATED_DIR, TEMP_DIR
from .routers import backup, generate, voices

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="VoiceClone Studio API",
    description="Local voice cloning and text-to-speech. All data stays on your machine.",
    version="1.0.0",
)

# CORS: allow the Vite dev server (localhost:5173) and localhost origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the database on startup.
database.init_db()

# Routers
app.include_router(voices.router)
app.include_router(generate.router)
app.include_router(backup.router)


# Serve generated audio + backups as static files under /audio.
# GENERATED_DIR holds the MP3s; TEMP_DIR holds the backup zip.
app.mount("/audio", StaticFiles(directory=str(GENERATED_DIR)), name="audio")


@app.get("/")
def health() -> dict:
    return {
        "status": "ok",
        "service": "VoiceClone Studio",
        "privacy": "All recordings, voice profiles, and generated audio are stored locally.",
    }


@app.get("/tts/status")
def tts_status() -> dict:
    """Report whether the Pocket TTS model is available."""
    from .tts_engine import TTSEngine

    engine = TTSEngine.instance()
    return {"available": engine.available(), "error": engine.import_error()}


# Serve the backup zip from TEMP_DIR on a separate mount so /audio stays
# scoped to generated audio.
from fastapi.responses import FileResponse  # noqa: E402


@app.get("/backup/download")
def download_backup():
    p = TEMP_DIR / "voiceclone_backup.zip"
    if not p.exists():
        return {"error": "No backup file. Call POST /backup/export first."}
    return FileResponse(
        str(p), media_type="application/zip", filename="voiceclone_backup.zip"
    )
