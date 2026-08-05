from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Body, FastAPI, Header
from fastapi.responses import JSONResponse

from .config import Settings
from .contracts import AudioValidationError, TranscriptionResult, validate_pcm16
from .providers import FasterWhisperProvider, TranscriptionProvider
from .service import QueueFullError, TranscriptionService

LOGGER = logging.getLogger("semantia.asr")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$")


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def create_app(
    settings: Settings | None = None,
    provider: TranscriptionProvider | None = None,
) -> FastAPI:
    active_settings = settings or Settings.from_env()
    active_provider = provider or FasterWhisperProvider(active_settings)
    service = TranscriptionService(
        active_provider,
        max_concurrency=active_settings.max_concurrency,
        max_queue=active_settings.max_queue,
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if active_settings.preload:
            try:
                await asyncio.to_thread(active_provider.load)
            except Exception as cause:  # readiness remains false; liveness stays available
                LOGGER.error(
                    "ASR provider preload failed",
                    extra={"error_type": type(cause).__name__},
                )
        yield

    app = FastAPI(title="Semantia ASR", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", response_model=None)
    async def ready() -> JSONResponse | dict[str, str]:
        if not active_provider.is_ready():
            return _error(503, "MODEL_UNAVAILABLE", "ASR model is not ready")
        return {
            "status": "ready",
            "engine": active_provider.engine,
            "model": active_provider.model,
        }

    @app.post("/v1/transcriptions", response_model=None)
    async def transcribe(
        payload: Annotated[bytes, Body(media_type="application/octet-stream")],
        x_request_id: Annotated[str, Header()],
        x_sample_rate: Annotated[int, Header()],
        x_duration_ms: Annotated[int, Header()],
        x_language: Annotated[str, Header()] = "pt",
    ) -> JSONResponse | dict[str, str | int]:
        if not REQUEST_ID_PATTERN.fullmatch(x_request_id):
            return _error(422, "INVALID_REQUEST_ID", "Invalid request id")
        try:
            validate_pcm16(payload, x_sample_rate, x_duration_ms)
        except AudioValidationError as error:
            return _error(422, error.code, str(error))

        try:
            result: TranscriptionResult = await service.transcribe(
                x_request_id,
                payload,
                x_sample_rate,
                x_language,
            )
        except QueueFullError:
            return _error(429, "QUEUE_FULL", "ASR queue is full")
        except Exception as cause:
            LOGGER.error(
                "ASR inference failed",
                extra={"request_id": x_request_id, "error_type": type(cause).__name__},
            )
            return _error(500, "INFERENCE_FAILED", "Transcription failed")

        return {
            "requestId": x_request_id,
            "text": result.text,
            "engine": result.engine,
            "model": result.model,
            "inferenceMs": result.inference_ms,
        }

    return app


app = create_app()
