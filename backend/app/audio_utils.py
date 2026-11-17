"""Audio conversion helpers: PCM tensor -> WAV -> MP3 (via FFmpeg)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
import scipy.io.wavfile


def pcm_to_wav(audio: np.ndarray, sample_rate: int, wav_path: Path) -> Path:
    """Write a 1D float numpy PCM array to a WAV file."""
    # Pocket TTS returns float32 in roughly [-1, 1]. Convert to int16 WAV.
    clipped = np.clip(audio, -1.0, 1.0)
    int_pcm = (clipped * 32767.0).astype(np.int16)
    scipy.io.wavfile.write(str(wav_path), sample_rate, int_pcm)
    return wav_path


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> Path:
    """Convert a WAV file to MP3 using FFmpeg. Returns the mp3 path."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "FFmpeg is not installed. Install it to enable MP3 conversion "
            "(e.g. apt install ffmpeg, brew install ffmpeg, or choco install ffmpeg)."
        )
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(wav_path),
        "-codec:a", "libmp3lame", "-qscale:a", "2",
        str(mp3_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return mp3_path
