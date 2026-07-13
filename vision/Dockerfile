# ======================================================
# REENCUENTROS VISION — Microservicio de Reconocimiento Facial
# ======================================================

FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# ======================================================
# ETAPA 2: Runner
# ======================================================
FROM python:3.11-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    libx11-6 \
    libpng16-16 \
    libjpeg62-turbo \
    libwebp7 \
    libsm6 \
    libxext6 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Crear el usuario primero
RUN groupadd -g 1001 reencuentro && \
    useradd -r -u 1001 -g reencuentro -d /home/reencuentro reencuentro && \
    mkdir -p /home/reencuentro && \
    chown -R reencuentro:reencuentro /app /home/reencuentro

# Mover .local al home del usuario correcto para evitar error de permisos en /root
COPY --from=builder /root/.local /home/reencuentro/.local
RUN chown -R reencuentro:reencuentro /home/reencuentro/.local

ENV PATH="/home/reencuentro/.local/bin:$PATH" \
    PYTHONPATH="/home/reencuentro/.local/lib/python3.11/site-packages:$PYTHONPATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY main.py .

USER reencuentro

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
