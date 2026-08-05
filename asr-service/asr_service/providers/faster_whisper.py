from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np

from ..config import Settings
from ..contracts import TranscriptionResult


class FasterWhisperProvider:
    engine = "faster-whisper"

    def __init__(self, settings: Settings) -> None:
        self.model = settings.model
        self._device = settings.device
        self._compute_type = settings.compute_type
        self._cpu_threads = settings.cpu_threads
        self._hotwords = settings.hotwords or None
        self._loaded_model: Any | None = None

    def is_ready(self) -> bool:
        return self._loaded_model is not None

    def load(self) -> None:
        if self._loaded_model is not None:
            return
        from faster_whisper import WhisperModel

        self._loaded_model = WhisperModel(
            self.model,
            device=self._device,
            compute_type=self._compute_type,
            cpu_threads=self._cpu_threads,
        )

    def transcribe(
        self,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> TranscriptionResult:
        self.load()
        started_at = perf_counter()
        samples = np.frombuffer(pcm16, dtype="<i2").astype(np.float32)
        samples /= 32_768.0
        segments, _info = self._loaded_model.transcribe(
            samples,
            language=language,
            task="transcribe",
            beam_size=5,
            condition_on_previous_text=False,
            hotwords=self._hotwords,
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        return TranscriptionResult(
            text=text.strip(),
            engine=self.engine,
            model=self.model,
            inference_ms=round((perf_counter() - started_at) * 1_000),
        )
