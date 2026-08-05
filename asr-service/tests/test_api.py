from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from asr_service.config import Settings
from asr_service.contracts import TranscriptionResult
from asr_service.main import create_app


class FakeProvider:
    engine = "fake"
    model = "fixture"

    def __init__(self) -> None:
        self.calls = 0
        self.loaded = False

    def is_ready(self) -> bool:
        return self.loaded

    def load(self) -> None:
        self.loaded = True

    def transcribe(
        self,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> TranscriptionResult:
        self.calls += 1
        return TranscriptionResult(
            text="Semantia conecta pessoas",
            engine=self.engine,
            model=self.model,
            inference_ms=7,
        )


def settings() -> Settings:
    return Settings(
        environment="test",
        provider="faster-whisper",
        model="small",
        device="cpu",
        compute_type="int8",
        cpu_threads=2,
        max_concurrency=1,
        max_queue=2,
        preload=True,
    )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@asynccontextmanager
async def app_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with (
        app.router.lifespan_context(app),
        AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client,
    ):
        yield client


@pytest.mark.anyio
async def test_health_readiness_and_transcription_contract() -> None:
    provider = FakeProvider()
    async with app_client(create_app(settings(), provider=provider)) as client:
        assert (await client.get("/health")).json() == {"status": "ok"}
        assert (await client.get("/ready")).json() == {
            "status": "ready",
            "engine": "fake",
            "model": "fixture",
        }
        response = await client.post(
            "/v1/transcriptions",
            content=b"\x00\x00" * 16_000,
            headers={
                "content-type": "application/octet-stream",
                "x-request-id": "segment-0001",
                "x-sample-rate": "16000",
                "x-duration-ms": "1000",
                "x-language": "pt",
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "requestId": "segment-0001",
        "text": "Semantia conecta pessoas",
        "engine": "fake",
        "model": "fixture",
        "inferenceMs": 7,
    }
    assert provider.calls == 1


@pytest.mark.anyio
async def test_rejects_invalid_audio_without_invoking_the_provider() -> None:
    provider = FakeProvider()
    async with app_client(create_app(settings(), provider=provider)) as client:
        response = await client.post(
            "/v1/transcriptions",
            content=b"\x00",
            headers={
                "content-type": "application/octet-stream",
                "x-request-id": "segment-0002",
                "x-sample-rate": "16000",
                "x-duration-ms": "1000",
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_AUDIO"
    assert provider.calls == 0


@pytest.mark.anyio
async def test_never_exposes_exception_details_in_the_response() -> None:
    class FailingProvider(FakeProvider):
        def transcribe(
            self,
            pcm16: bytes,
            sample_rate: int,
            language: str,
        ) -> TranscriptionResult:
            raise RuntimeError("secret filesystem/model path")

    async with app_client(create_app(settings(), provider=FailingProvider())) as client:
        response = await client.post(
            "/v1/transcriptions",
            content=b"\x00\x00" * 16_000,
            headers={
                "content-type": "application/octet-stream",
                "x-request-id": "segment-0003",
                "x-sample-rate": "16000",
                "x-duration-ms": "1000",
            },
        )

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "INFERENCE_FAILED", "message": "Transcription failed"}
    }
    assert "secret" not in response.text
