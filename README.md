# VoiceClone Studio

Clone your own voice from a short recording, then turn any pasted text (stories, articles, scripts) into natural speech in that voice — **entirely on your computer**.

No cloud APIs. No external storage. No paid subscriptions. Voice cloning and speech generation run locally via [Pocket TTS](https://github.com/kyutai-labs/pocket-tts), a 100M-parameter CPU-friendly TTS model with voice cloning.

```
React frontend  →  FastAPI backend  →  Pocket TTS  →  Local SQLite + Filesystem
```

## Architecture

- **Frontend:** React + Vite + Tailwind CSS (dark, responsive UI).
- **Backend:** Python FastAPI, binds to `127.0.0.1` (localhost only).
- **TTS:** Pocket TTS Multilingual — runs on CPU, weights downloaded once from Hugging Face.
- **Database:** SQLite for voice + generation metadata (`backend/storage/database/voiceclone.db`).
- **Files:** Voice profiles (`backend/storage/voices/`) and generated audio (`backend/storage/generated/`) on disk.
- **Audio conversion:** WAV → MP3 via FFmpeg.

### Storage layout

```
backend/storage/
  database/voiceclone.db          # SQLite metadata
  voices/voice_<id>/
    voice.<ext>                   # original uploaded/recorded sample
    voice_profile.safetensors     # reusable Pocket TTS voice embedding
    metadata.json                 # human-readable metadata
  generated/gen_<id>.mp3          # generated speech audio
  temp/                           # scratch files (auto-cleaned)
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Linux: use CPU torch index to avoid multi-GB CUDA wheels
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# macOS / Windows (default torch wheels are CPU-only)
pip install -r requirements.txt
```

Install **FFmpeg** for MP3 conversion:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: `choco install ffmpeg`

### 2. Run the backend

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The first voice creation downloads the Pocket TTS model weights (~100 MB) from Hugging Face. After that, everything runs offline.

### 3. Run the frontend

```bash
npm install
npm run dev
```

Open the Vite dev URL (usually `http://localhost:5173`). The frontend talks to the backend at `http://127.0.0.1:8000` (configurable via `VITE_API_BASE` in `.env`).

## Features

- **Create a Voice** — record in-browser (MediaRecorder) or upload mp3/wav/m4a, name the voice, pick a language, and confirm consent. The backend builds a reusable voice profile saved to disk.
- **Generate Speech** — pick a voice, paste text (live char count), adjust speed (0.7x–1.2x). Long text is automatically split at sentence boundaries into ≤2,500-char chunks, synthesized in order, and joined into one MP3. Download or replay from recent history (last 10).
- **My Voices** — list and delete local voice profiles (with confirmation). Includes **backup export** (zip of all profiles + DB) and **restore from file**.

## Privacy

Your recordings, voice profiles, and generated audio are stored locally on your computer. VoiceClone Studio does not upload your recordings to external cloud storage. The backend binds to `localhost` only and is not reachable from the network.

## Requirements

- Python 3.10–3.13 (Pocket TTS requirement)
- Node 18+ for the frontend
- FFmpeg for MP3 conversion
- ~200 MB disk for CPU PyTorch + Pocket TTS weights
