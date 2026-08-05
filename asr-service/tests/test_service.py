from __future__ import annotations

import asyncio
import threading
import time

import pytest

from asr_service.contracts import TranscriptionResult
from asr_service.service import QueueFullError, TranscriptionService


class RecordingProvider:
    engine = "test"
    model = "deterministic"

    def __init__(self, delay: float = 0.0) -> None:
        self.delay = delay
        self.calls = 0
        self.active = 0
        self.max_active = 0
        self.entered = threading.Event()
        self.release = threading.Event()
        if delay == 0:
            self.release.set()

    def is_ready(self) -> bool:
        return True

    def load(self) -> None:
        return None

    def transcribe(self, pcm16: bytes, sample_rate: int, language: str) -> TranscriptionResult:
        self.calls += 1
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        self.entered.set()
        self.release.wait(timeout=2)
        if self.delay:
            time.sleep(self.delay)
        self.active -= 1
        return TranscriptionResult(
            text="comunicação acessível",
            engine=self.engine,
            model=self.model,
            inference_ms=12,
        )


@pytest.mark.asyncio
async def test_coalesces_concurrent_retries_for_the_same_request_id() -> None:
    provider = RecordingProvider(delay=0.01)
    service = TranscriptionService(provider, max_concurrency=1, max_queue=2)
    audio = b"\x00\x00" * 16_000

    first, second = await asyncio.gather(
        service.transcribe("segment-0001", audio, 16_000, "pt"),
        service.transcribe("segment-0001", audio, 16_000, "pt"),
    )

    assert first == second
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_serializes_inference_on_a_single_cpu_worker() -> None:
    provider = RecordingProvider(delay=0.02)
    service = TranscriptionService(provider, max_concurrency=1, max_queue=2)
    audio = b"\x00\x00" * 16_000

    await asyncio.gather(
        service.transcribe("segment-0001", audio, 16_000, "pt"),
        service.transcribe("segment-0002", audio, 16_000, "pt"),
    )

    assert provider.calls == 2
    assert provider.max_active == 1


@pytest.mark.asyncio
async def test_rejects_work_when_the_bounded_queue_is_full() -> None:
    provider = RecordingProvider()
    provider.release.clear()
    service = TranscriptionService(provider, max_concurrency=1, max_queue=0)
    audio = b"\x00\x00" * 16_000
    first = asyncio.create_task(service.transcribe("segment-0001", audio, 16_000, "pt"))
    await asyncio.to_thread(provider.entered.wait, 1)

    with pytest.raises(QueueFullError):
        await service.transcribe("segment-0002", audio, 16_000, "pt")

    provider.release.set()
    await first
