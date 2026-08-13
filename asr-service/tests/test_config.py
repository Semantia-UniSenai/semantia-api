from __future__ import annotations

import pytest

from asr_service.config import Settings


def test_defaults_are_safe_for_cpu_only_vps(monkeypatch: pytest.MonkeyPatch) -> None:
    names = [
        "ASR_PROVIDER",
        "ASR_MODEL",
        "ASR_DEVICE",
        "ASR_COMPUTE_TYPE",
        "ASR_CPU_THREADS",
        "ASR_MAX_CONCURRENCY",
        "ASR_MAX_QUEUE",
        "ASR_HOTWORDS",
    ]
    for name in names:
        monkeypatch.delenv(name, raising=False)

    settings = Settings.from_env()

    assert settings.provider == "faster-whisper"
    assert settings.model == "small"
    assert settings.device == "cpu"
    assert settings.compute_type == "int8"
    assert settings.cpu_threads == 2
    assert settings.max_concurrency == 1
    assert settings.max_queue == 4
    assert settings.hotwords == ""


def test_invalid_boolean_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASR_PRELOAD", "sometimes")

    with pytest.raises(ValueError, match="ASR_PRELOAD"):
        Settings.from_env()
