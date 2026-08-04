from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import numpy as np
import pytest

from asr_service.config import Settings
from asr_service.providers.faster_whisper import FasterWhisperProvider


def test_adapter_passes_pcm_as_float_array_without_files(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed: dict[str, object] = {}

    class FakeWhisperModel:
        def __init__(self, model: str, **kwargs: object) -> None:
            observed["model"] = model
            observed["init"] = kwargs

        def transcribe(self, audio: np.ndarray, **kwargs: object):
            observed["audio"] = audio
            observed["transcribe"] = kwargs
            return [SimpleNamespace(text=" olá "), SimpleNamespace(text=" mundo")], None

    import faster_whisper

    monkeypatch.setattr(faster_whisper, "WhisperModel", FakeWhisperModel)
    settings = Settings(
        model="small",
        device="cpu",
        compute_type="int8",
        cpu_threads=2,
        hotwords="Semantia Foyth",
    )
    provider = FasterWhisperProvider(settings)
    payload = np.array([-32_768, 0, 16_384, 32_767], dtype="<i2").tobytes()

    provider.load()
    result = provider.transcribe(payload, 16_000, "pt")

    assert observed["model"] == "small"
    assert observed["init"] == {
        "device": "cpu",
        "compute_type": "int8",
        "cpu_threads": 2,
    }
    audio = cast(np.ndarray, observed["audio"])
    assert isinstance(audio, np.ndarray)
    assert audio.dtype == np.float32
    np.testing.assert_allclose(
        audio,
        np.array([-1.0, 0.0, 0.5, 32_767 / 32_768], dtype=np.float32),
    )
    assert observed["transcribe"] == {
        "language": "pt",
        "task": "transcribe",
        "beam_size": 5,
        "vad_filter": True,
        "condition_on_previous_text": False,
        "hotwords": "Semantia Foyth",
    }
    assert result.text == "olá mundo"
    assert result.engine == "faster-whisper"
    assert result.model == "small"
