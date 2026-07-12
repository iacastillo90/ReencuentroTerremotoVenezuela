# ======================================================
# REENCUENTROS VISION — Microservicio de Reconocimiento Facial
# ======================================================
# FastAPI + face_recognition (dlib) para extraer embeddings faciales.
# Construir:   docker build -t reencuentros-vision ./vision
# Ejecutar:    docker run -p 8000:8000 reencuentros-vision
# ======================================================

FROM python:3.11-slim AS builder

WORKDIR /build

# Instalar dependencias del sistema necesarias para compilar dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python primero (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# ======================================================
# ETAPA 2: Runner
# ======================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Solo runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    libx11-6 \
    && rm -rf /var/lib/apt/lists/*

# Copiar paquetes instalados desde builder
COPY --from=builder /root/.local /root/.local

ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY main.py .

RUN groupadd -g 1001 reencuentro && \
    useradd -r -u 1001 -g reencuentro reencuentro && \
    chown -R reencuentro:reencuentro /app

USER reencuentro

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
