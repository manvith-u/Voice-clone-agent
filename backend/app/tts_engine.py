"""Pocket TTS engine wrapper.

Loads the Pocket TTS model once (the download happens on first use) and
keeps it resident. Voice states are cached by voice id so repeated
generation with the same voice is fast.

The Pocket TTS public API (from kyutai-labs/pocket-tts):

    from pocket_tts import TTSModel, export_model_state
    model = TTSModel.load_model()
    voice_state = model.get_state_for_audio_prompt("./some_audio.wav")
    audio = model.generate_audio(voice_state, "Hello world.")
    # audio is a 1D torch tensor of PCM data at model.sample_rate

For fast reload we export each voice state to a ``.safetensors`` file
(``voice_profile.pt`` in the voice directory) and load from that on
subsequent runs.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from .config import DEFAULT_LANGUAGE

logger = logging.getLogger("voiceclone.tts")

# Pocket TTS is an optional import: the app can start without it (e.g. for
# browsing voices/history) and we surface a clear error on generate.
_TTSModel: Any = None
_export_model_state: Any = None
_import_error: str | None = None

try:
    from pocket_tts import TTSModel as _TTSModel  # type: ignore
    from pocket_tts import export_model_state as _export_model_state  # type: ignore
except Exception as e:  # pragma: no cover - environment dependent
    _import_error = str(e)
    logger.warning("pocket_tts not available yet: %s", e)


class TTSEngine:
    """Singleton wrapper around the Pocket TTS model with voice caching."""

    _instance: "TTSEngine | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._model: Any = None
        self._model_lock = threading.Lock()
        # voice_id -> cached voice state
        self._voice_cache: dict[str, Any] = {}

    @classmethod
    def instance(cls) -> "TTSEngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def available(self) -> bool:
        """True if pocket_tts is importable."""
        return _TTSModel is not None

    def import_error(self) -> str | None:
        return _import_error

    def _ensure_model(self) -> Any:
        """Lazily load the model (downloads weights on first call)."""
        if self._model is not None:
            return self._model
        with self._model_lock:
            if self._model is not None:
                return self._model
            if _TTSModel is None:
                raise RuntimeError(
                    "pocket_tts is not installed. Run the backend setup to "
                    "install Python dependencies (pip install -r requirements.txt)."
                )
            logger.info("Loading Pocket TTS model (first run downloads weights)...")
            self._model = _TTSModel.load_model()
            logger.info("Pocket TTS model loaded.")
            return self._model

    def create_voice_profile(self, audio_path: Path, profile_path: Path) -> None:
        """Encode an audio sample into a reusable safetensors voice profile."""
        model = self._ensure_model()
        state = model.get_state_for_audio_prompt(str(audio_path))
        if _export_model_state is None:
            raise RuntimeError("pocket_tts export_model_state unavailable")
        _export_model_state(state, str(profile_path))
        logger.info("Voice profile exported to %s", profile_path)

    def _get_voice_state(self, profile_path: Path, voice_id: str) -> Any:
        """Load (and cache) a voice state from a safetensors profile."""
        if voice_id in self._voice_cache:
            return self._voice_cache[voice_id]
        model = self._ensure_model()
        # Loading a safetensors profile is fast (just reads the kvcache).
        state = model.get_state_for_audio_prompt(str(profile_path))
        self._voice_cache[voice_id] = state
        return state

    def generate(
        self,
        profile_path: Path,
        voice_id: str,
        text: str,
        language: str = DEFAULT_LANGUAGE,
        speed: float = 1.0,
    ) -> tuple[int, Any]:
        """Generate audio for ``text`` using a voice profile.

        Returns ``(sample_rate, audio_tensor)`` where ``audio_tensor`` is a
        1D numpy/torch array of PCM samples. ``language`` and ``speed`` are
        accepted for API compatibility; Pocket TTS currently keys voice
        quality off the profile and the loaded model weights.
        """
        model = self._ensure_model()
        state = self._get_voice_state(profile_path, voice_id)
        audio = model.generate_audio(state, text)
        # If the model exposes a speed option we'd pass it here; for now we
        # honor speed client-side via playbackRate on the audio player.
        return model.sample_rate, audio
