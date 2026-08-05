from __future__ import annotations

from typing import Protocol

from ..contracts import TranscriptionResult


class TranscriptionProvider(Protocol):
    engine: str
    model: str

    def is_ready(self) -> bool: ...

    def load(self) -> None: ...

    def transcribe(
        self,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> TranscriptionResult: ...
