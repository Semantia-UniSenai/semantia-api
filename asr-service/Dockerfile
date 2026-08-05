FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models/huggingface

WORKDIR /app

RUN groupadd --gid 10001 semantia \
    && useradd --uid 10001 --gid semantia --no-create-home semantia \
    && mkdir -p /models/huggingface \
    && chown -R semantia:semantia /models

COPY --chown=semantia:semantia pyproject.toml ./
COPY --chown=semantia:semantia asr_service ./asr_service
RUN python -m pip install --upgrade pip \
    && python -m pip install .

USER semantia
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" || exit 1

CMD ["uvicorn", "asr_service.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
