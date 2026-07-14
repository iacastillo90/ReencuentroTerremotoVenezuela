# AGENTS.md — Vision (`vision/`)

## Stack

- **Runtime:** Python 3.11, FastAPI, Uvicorn
- **Face recognition:** `face_recognition` 1.3.0 (dlib backend, 128-dim embeddings)
- **Age detection:** OpenCV DNN (Caffe `age_net` model, ~30MB)
- **Image processing:** Pillow, OpenCV, NumPy

## Arquitectura

Microservicio de visión artificial. Expone endpoints REST para extracción facial, detección de edad y difuminado de rostros.

## Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/health` | Healthcheck |
| `POST` | `/extract-face` | Extrae encoding facial + edad estimada |
| `POST` | `/blur-faces` | Difumina todos los rostros, devuelve base64 |

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
  "num_faces": 2,
  "faces": [
    {"age_range": "(25-32)", "age_approx": 28},
    {"age_range": "(4-6)", "age_approx": 5}
  ],
  "error": null
}
```

**Response (no face):**
```json
{
  "face_encoding": null,
  "face_detected": false,
  "num_faces": 0,
  "faces": [],
  "error": null
}
```

### POST /blur-faces

**Request:**
```json
{
  "image_url": "https://minio:9000/reencuentro-media/abc123.jpg",
  "timeout": 30
}
```

**Response:**
```json
{
  "image_base64": "/9j/4AAQ...",
  "faces_blurred": 2,
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

- **CPU-bound:** Cada foto toma 1-3s en CPU (face_recognition) + 0.1-0.3s por rostro (OpenCV DNN edad). Sin GPU. Escalar horizontalmente si hay alta demanda.
- **Solo humanos:** No detecta rostros de animales ni personas de espalda.
- **Primera carga lenta:** dlib descarga el modelo preentrenado (~100MB) al primer uso. En Docker se cachea en la imagen.
- **Modelos de edad:** Se descargan en buildtime (Dockerfile) o al primer inicio. Son ~30MB (Caffe prototxt + caffemodel).
- **Timeout:** El worker espera max 35s. El request interno tiene timeout de 30s.
- **face_recognition 1.3.0** es la última versión estable. No actualizar a menos que se pruebe primero.
- **Edad:** La estimación es aproximada (±5-10 años). Los rangos son: 0-2, 4-6, 8-12, 15-20, 25-32, 38-43, 48-53, 60-100.
- **Moderación LOPNNA:** El worker usa `faces[].age_approx` para detectar menores de 18 años. La foto se marca como `containsMinor` y entra a cola de moderación.
