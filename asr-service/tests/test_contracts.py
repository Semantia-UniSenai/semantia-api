from __future__ import annotations

import pytest

from asr_service.contracts import AudioValidationError, validate_pcm16


def pcm(seconds: float, sample_rate: int = 16_000) -> bytes:
    return b"\x00\x00" * int(seconds * sample_rate)


def test_accepts_mono_pcm16_matching_the_declared_duration() -> None:
    validated = validate_pcm16(pcm(1), sample_rate=16_000, duration_ms=1_000)

    assert validated.sample_count == 16_000
    assert validated.duration_ms == 1_000


@pytest.mark.parametrize(
    ("payload", "sample_rate", "duration_ms", "code"),
    [
        (b"\x00", 16_000, 1_000, "INVALID_AUDIO"),
        (pcm(1), 48_000, 1_000, "UNSUPPORTED_SAMPLE_RATE"),
        (pcm(0.1), 16_000, 100, "AUDIO_TOO_SHORT"),
        (pcm(31), 16_000, 31_000, "AUDIO_TOO_LONG"),
        (pcm(1), 16_000, 5_000, "DURATION_MISMATCH"),
    ],
)
def test_rejects_audio_outside_the_wire_contract(
    payload: bytes,
    sample_rate: int,
    duration_ms: int,
    code: str,
) -> None:
    with pytest.raises(AudioValidationError) as raised:
        validate_pcm16(payload, sample_rate=sample_rate, duration_ms=duration_ms)

    assert raised.value.code == code
