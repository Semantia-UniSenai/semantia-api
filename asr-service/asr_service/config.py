from __future__ import annotations

import os
from dataclasses import dataclass


def _read_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean")


def _read_int(name: str, default: int, minimum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return value


@dataclass(frozen=True, slots=True)
class Settings:
    environment: str = "development"
    provider: str = "faster-whisper"
    model: str = "small"
    device: str = "cpu"
    compute_type: str = "int8"
    cpu_threads: int = 2
    max_concurrency: int = 1
    max_queue: int = 4
    preload: bool = True
    hotwords: str = ""

    @classmethod
    def from_env(cls) -> Settings:
        settings = cls(
            environment=os.getenv("ASR_ENV", "development").strip(),
            provider=os.getenv("ASR_PROVIDER", "faster-whisper").strip(),
            model=os.getenv("ASR_MODEL", "small").strip(),
            device=os.getenv("ASR_DEVICE", "cpu").strip(),
            compute_type=os.getenv("ASR_COMPUTE_TYPE", "int8").strip(),
            cpu_threads=_read_int("ASR_CPU_THREADS", 2, 1),
            max_concurrency=_read_int("ASR_MAX_CONCURRENCY", 1, 1),
            max_queue=_read_int("ASR_MAX_QUEUE", 4, 0),
            preload=_read_bool("ASR_PRELOAD", True),
            hotwords=os.getenv("ASR_HOTWORDS", "").strip(),
        )
        if settings.provider != "faster-whisper":
            raise ValueError("ASR_PROVIDER must be faster-whisper")
        if settings.device not in {"cpu", "cuda", "auto"}:
            raise ValueError("ASR_DEVICE must be cpu, cuda or auto")
        if not settings.model:
            raise ValueError("ASR_MODEL must not be empty")
        return settings
