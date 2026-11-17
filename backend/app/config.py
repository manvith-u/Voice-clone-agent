"""Application configuration and path management.

All persistent data lives under ``storage/`` within the backend directory:
the SQLite database, voice profiles, generated audio, and temp files.
"""

from __future__ import annotations

from pathlib import Path

# Backend root = directory containing this file's parent (backend/).
BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Storage layout.
STORAGE_DIR = BACKEND_ROOT / "storage"
DATABASE_DIR = STORAGE_DIR / "database"
VOICES_DIR = STORAGE_DIR / "voices"
GENERATED_DIR = STORAGE_DIR / "generated"
TEMP_DIR = STORAGE_DIR / "temp"

DB_PATH = DATABASE_DIR / "voiceclone.db"

# Ensure the storage tree exists at import time.
for _d in (DATABASE_DIR, VOICES_DIR, GENERATED_DIR, TEMP_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Pocket TTS language id used by default (english). The model supports
# additional languages via the --language flag; we expose language in the API
# but default to english for the multilingual model.
DEFAULT_LANGUAGE = "english"

# Bind the API to localhost only — the app is meant to run locally.
HOST = "127.0.0.1"
PORT = 8000

# Max upload size for voice samples: 25 MB.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# Allowed audio extensions for voice samples.
ALLOWED_AUDIO_EXT = {".wav", ".mp3", ".m4a", ".webm", ".ogg", ".flac"}


def ensure_voice_dir(voice_id: str) -> Path:
    """Create and return the per-voice storage directory."""
    vdir = VOICES_DIR / voice_id
    vdir.mkdir(parents=True, exist_ok=True)
    return vdir
