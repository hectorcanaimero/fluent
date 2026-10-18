# Multi-stage: uv instala en una capa de build, la imagen final solo trae el
# venv resuelto y el código, corre como usuario no root, uvicorn en :8000.
# python:3.12-slim no trae curl/wget: el HEALTHCHECK usa python (urllib).

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.24 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime
WORKDIR /app
RUN useradd --system --no-create-home --shell /usr/sbin/nologin appuser

COPY --from=build /app /app
ENV PATH="/app/.venv/bin:${PATH}"

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=3)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
