# AGENTS.md — Vision (`vision/`)

## Stack

- **Runtime:** Python 3.11, FastAPI, Uvicorn
- **Face recognition:** `face_recognition` 1.3.0 (dlib backend, 128-dim embeddings)
- **Image loading:** Pillow + requests

## Arquitectura

Microservicio de visión artificial. Expone un único endpoint REST que recibe una URL de imagen (presigned de MinIO/S3) y devuelve el encoding facial de 128 dimensiones.

## Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/health` | Healthcheck |
| `POST` | `/extract-face` | Extrae encoding facial de una imagen |

### POST /extract-face

**Request:**
```json
{
  "image_url": "https://minio:9000/reencuentro-media/abc123.jpg",
  "timeout": 30
}
```

**Response (face detected):**
```json
{
  "face_encoding": [0.123, -0.456, ...],
  "face_detected": true,
  "num_faces": 1,
  "error": null
}
```

**Response (no face):**
```json
{
  "face_encoding": null,
  "face_detected": false,
  "num_faces": 0,
  "error": null
}
```

## Integración

El worker `ia-processor.worker.ts` llama a este servicio cuando un reporte incluye `photoUrl`. Si el servicio no responde o no detecta rostro, el worker continúa gracefulmente sin el encoding facial.

## Comandos

```bash
# Desarrollo local
cd vision && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Docker
docker compose build vision && docker compose up -d vision
```

## Gotchas

- **CPU-bound:** Cada foto toma 1-3s en CPU. Sin GPU. Escalar horizontalmente si hay alta demanda.
- **Solo humanos:** No detecta rostros de animales ni personas de espalda.
- **Primera carga lenta:** dlib descarga el modelo preentrenado (~100MB) al primer uso. En Docker se cachea en la imagen.
- **Timeout:** El worker espera max 35s. El request interno tiene timeout de 30s.
- **face_recognition 1.3.0** es la última versión estable. No actualizar a menos que se pruebe primero.
