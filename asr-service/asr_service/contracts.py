from __future__ import annotations

from dataclasses import dataclass

SUPPORTED_SAMPLE_RATE = 16_000
MIN_AUDIO_MS = 250
MAX_AUDIO_MS = 30_000
DURATION_TOLERANCE_MS = 80


class AudioValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class ValidatedAudio:
    sample_count: int
    duration_ms: int


@dataclass(frozen=True, slots=True)
class TranscriptionResult:
    text: str
    engine: str
    model: str
    inference_ms: int


def validate_pcm16(payload: bytes, sample_rate: int, duration_ms: int) -> ValidatedAudio:
    if not payload or len(payload) % 2 != 0:
        raise AudioValidationError("INVALID_AUDIO", "Audio must be non-empty PCM16")
    if sample_rate != SUPPORTED_SAMPLE_RATE:
        raise AudioValidationError(
            "UNSUPPORTED_SAMPLE_RATE",
            f"Only {SUPPORTED_SAMPLE_RATE} Hz audio is supported",
        )

    sample_count = len(payload) // 2
    measured_duration_ms = round((sample_count * 1_000) / sample_rate)
    if measured_duration_ms < MIN_AUDIO_MS:
        raise AudioValidationError("AUDIO_TOO_SHORT", "Audio segment is too short")
    if measured_duration_ms > MAX_AUDIO_MS:
        raise AudioValidationError("AUDIO_TOO_LONG", "Audio segment is too long")
    tolerance = max(DURATION_TOLERANCE_MS, round(measured_duration_ms * 0.05))
    if abs(duration_ms - measured_duration_ms) > tolerance:
        raise AudioValidationError(
            "DURATION_MISMATCH",
            "Declared duration does not match the PCM payload",
        )

    return ValidatedAudio(sample_count=sample_count, duration_ms=measured_duration_ms)
