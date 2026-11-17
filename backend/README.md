# VoiceClone Studio — Backend

A fully local FastAPI backend that uses [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) for voice cloning and speech generation. No cloud APIs, no external storage.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# On Linux, use the CPU torch index to skip CUDA wheels (~200 MB instead of ~3 GB):
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# (macOS / Windows: the default torch wheels are already CPU-only)
pip install -r requirements.txt
```

You also need **FFmpeg** installed for MP3 conversion:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: `choco install ffmpeg`

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API binds to **localhost only**. The first generation downloads the Pocket TTS model weights from Hugging Face (~100 MB); after that everything runs offline.

## Storage

All data lives under `backend/storage/`:

```
storage/
  database/voiceclone.db      # SQLite metadata
  voices/voice_XXX/           # voice profile + original sample + metadata.json
  generated/gen_XXX.mp3       # generated audio
  temp/                       # scratch files (cleaned up automatically)
```

Backups (`POST /backup/export`) produce a zip of the DB + all voice profiles.
