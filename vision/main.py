import io
import ipaddress
import logging
import socket
import traceback
import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import urlparse

import face_recognition
import httpx
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision")


_SSRF_CACHE: dict[str, bool] = {}

def _is_safe_url(url: str) -> bool:
    hostname = urlparse(url).hostname
    if not hostname:
        return False
        
    # Whitelist interno para MinIO en Docker Compose
    import os
    minio_host = os.environ.get("MINIO_ENDPOINT", "minio")
    if hostname == minio_host:
        return True

    if hostname in _SSRF_CACHE:
        return _SSRF_CACHE[hostname]
    try:
        ip = socket.gethostbyname(hostname)
        addr = ipaddress.ip_address(ip)
        safe = addr.is_global
        _SSRF_CACHE[hostname] = safe
        return safe
    except Exception:
        return False


class ExtractFaceRequest(BaseModel):
    image_url: HttpUrl
    timeout: int = 30


class ExtractFaceResponse(BaseModel):
    face_encoding: Optional[list[float]] = None
    face_detected: bool = False
    num_faces: int = 0
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Vision service starting...")
    yield
    logger.info("Vision service shutting down.")


app = FastAPI(
    title="Reencuentros Vision",
    description="Face extraction microservice using face_recognition",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vision"}


def _process_image_cpu_bound(content: bytes, image_url: str) -> ExtractFaceResponse:
    """Ejecutado en un ThreadPool para no bloquear el Event Loop de FastAPI (libera el GIL en dlib)."""
    try:
        # 1. Abrir imagen una sola vez en memoria
        image = Image.open(io.BytesIO(content)).convert("RGB")
        
        # 2. Resize automático para prevenir ataques DoS (Imágenes de 4K o 12MPX funden la RAM)
        max_dim = 800
        if max(image.width, image.height) > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {image_url} to {image.width}x{image.height}")

        # 3. Convertir a numpy de forma directa sin recargar
        image_array = np.array(image)

        # 4. Detección (Fijamos HOG para CPU rápida)
        face_locations = face_recognition.face_locations(image_array, model="hog")
        num_faces = len(face_locations)

        if num_faces == 0:
            logger.info(f"No face detected in {image_url}")
            return ExtractFaceResponse(
                face_detected=False,
                num_faces=0,
            )

        face_encodings = face_recognition.face_encodings(image_array, face_locations)

        if not face_encodings:
            logger.info(f"Face detected but encoding failed for {image_url}")
            return ExtractFaceResponse(
                face_detected=True,
                num_faces=num_faces,
                error="Face detected but encoding failed",
            )

        encoding = face_encodings[0].tolist()
        logger.info(f"Face extracted: {num_faces} face(s), encoding length={len(encoding)}")

        return ExtractFaceResponse(
            face_encoding=encoding,
            face_detected=True,
            num_faces=num_faces,
        )
    except Exception as e:
        logger.error(f"Error processing image {image_url}: {traceback.format_exc()}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Image processing error: {str(e)}",
        )


@app.post("/extract-face", response_model=ExtractFaceResponse)
async def extract_face(req: ExtractFaceRequest):
    try:
        image_url = str(req.image_url)
        logger.info(f"Downloading image: {image_url}")

        if not _is_safe_url(image_url):
            logger.warning(f"SSRF blocked: {image_url}")
            return ExtractFaceResponse(
                face_detected=False,
                error="URL no permitida (SSRF protection)",
            )
        
        # Descarga ASÍNCRONA: El Event Loop puede atender otras peticiones mientras espera MinIO/AWS.
        async with httpx.AsyncClient(timeout=req.timeout) as client:
            resp = await client.get(
                image_url,
                headers={"User-Agent": "ReencuentrosVision/1.0"}
            )
            resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type:
            return ExtractFaceResponse(
                face_detected=False,
                error=f"URL does not point to an image (Content-Type: {content_type})",
            )

        # Offload a un thread para no bloquear el loop con procesamiento pesado
        return await asyncio.to_thread(_process_image_cpu_bound, resp.content, str(req.image_url))

    except httpx.TimeoutException:
        logger.warning(f"Timeout downloading image: {req.image_url}")
        return ExtractFaceResponse(
            face_detected=False,
            error="Timeout downloading image",
        )
    except httpx.RequestError as e:
        logger.warning(f"Error downloading image: {e}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Error downloading image: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error for {req.image_url}: {traceback.format_exc()}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Internal network error: {str(e)}",
        )
