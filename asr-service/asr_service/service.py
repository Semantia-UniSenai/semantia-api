from __future__ import annotations

import asyncio
from collections.abc import Awaitable

from .contracts import TranscriptionResult
from .providers.base import TranscriptionProvider


class QueueFullError(RuntimeError):
    pass


class TranscriptionService:
    def __init__(
        self,
        provider: TranscriptionProvider,
        max_concurrency: int,
        max_queue: int,
    ) -> None:
        self.provider = provider
        self._max_concurrency = max_concurrency
        self._max_queue = max_queue
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._state_lock = asyncio.Lock()
        self._active = 0
        self._waiting = 0
        self._inflight: dict[str, asyncio.Task[TranscriptionResult]] = {}

    async def transcribe(
        self,
        request_id: str,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> TranscriptionResult:
        async with self._state_lock:
            existing = self._inflight.get(request_id)
            if existing is not None:
                task: Awaitable[TranscriptionResult] = existing
            else:
                if self._active + self._waiting >= self._max_concurrency + self._max_queue:
                    raise QueueFullError("ASR queue is full")
                self._waiting += 1
                created = asyncio.create_task(
                    self._run(request_id, pcm16, sample_rate, language),
                )
                self._inflight[request_id] = created
                task = created
        return await task

    async def _run(
        self,
        request_id: str,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> TranscriptionResult:
        try:
            async with self._semaphore:
                async with self._state_lock:
                    self._waiting -= 1
                    self._active += 1
                try:
                    return await asyncio.to_thread(
                        self.provider.transcribe,
                        pcm16,
                        sample_rate,
                        language,
                    )
                finally:
                    async with self._state_lock:
                        self._active -= 1
        finally:
            async with self._state_lock:
                current = self._inflight.get(request_id)
                if current is asyncio.current_task():
                    self._inflight.pop(request_id, None)
