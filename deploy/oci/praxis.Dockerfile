# Praxis published API (single-operator, FakeExecutor profile — no host code execution).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PRAXIS_DATA=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the canonical Praxis package plus its host-provided ASGI server.
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir . "uvicorn==0.34.0"

# The single-operator API factory (bearer token, FakeExecutor). See examples/server.py.
COPY examples/server.py /app/praxis_server.py

RUN groupadd --gid 10002 praxis \
    && useradd --uid 10002 --gid 10002 --home-dir /app --no-create-home praxis \
    && mkdir -p /data \
    && chown -R praxis:praxis /app /data
USER praxis

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=5 \
  CMD curl -fsS -H "Authorization: Bearer ${PRAXIS_API_TOKEN}" http://localhost:8000/v1/health || exit 1

CMD ["sh", "-c", "exec uvicorn praxis_server:create_app --factory --host 0.0.0.0 --port 8000 --workers 1 --timeout-keep-alive 30"]
