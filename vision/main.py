import io
import ipaddress
import logging
import os
import socket
import traceback
import asyncio
import urllib.request
import concurrent.futures
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import urlparse
import threading

import cv2
cv2.setNumThreads(1)
import face_recognition
import httpx
import numpy as np
from fastapi import FastAPI, Header
from pydantic import BaseModel, HttpUrl
from PIL import Image, ImageFilter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision")

_SSRF_CACHE: dict[str, bool] = {}

AGE_PROTO = "models/age_deploy.prototxt"
AGE_MODEL = "models/age_net.caffemodel"
AGE_LIST = ['(0-2)', '(4-6)', '(8-12)', '(15-20)', '(25-32)', '(38-43)', '(48-53)', '(60-100)']
AGE_UPPER = [2, 6, 12, 20, 32, 43, 53, 100]

age_net: Optional[cv2.dnn.Net] = None
age_net_lock = threading.Lock()

MODEL_DOWNLOAD_URLS = {
    AGE_PROTO: "https://raw.githubusercontent.com/opencv/opencv_extra/master/testdata/dnn/age_net_deploy.prototxt",
    AGE_MODEL: "https://github.com/opencv/opencv_extra/raw/master/testdata/dnn/age_net.caffemodel",
}


def _is_safe_url(url: str) -> bool:
    hostname = urlparse(url).hostname
    if not hostname:
        return False

    import os
    minio_host = os.environ.get("MINIO_ENDPOINT", "minio")
    api_host = os.environ.get("API_ENDPOINT", "api")
    if hostname in [minio_host, api_host, "localhost", "127.0.0.1"]:
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


def _download_models():
    """Descarga los modelos de edad si no existen en disco."""
    for path, url in MODEL_DOWNLOAD_URLS.items():
        if os.path.exists(path):
            logger.info(f"Model already exists: {path}")
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        logger.info(f"Downloading model: {url}")
        try:
            urllib.request.urlretrieve(url, path)
            logger.info(f"Downloaded: {path}")
        except Exception as e:
            logger.error(f"Failed to download {url}: {e}")
            raise


def _load_age_model():
    """Carga la red neuronal de clasificación de edad."""
    global age_net
    try:
        age_net = cv2.dnn.readNetFromCaffe(AGE_PROTO, AGE_MODEL)
        logger.info("Age detection model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load age model: {e}")
        age_net = None


def _estimate_age(face_roi: np.ndarray) -> tuple[str, int]:
    """Estima la edad de un rostro recortado usando OpenCV DNN."""
    if age_net is None:
        return "unknown", 0

    blob = cv2.dnn.blobFromImage(face_roi, 1.0, (227, 227), (78.4263377603, 87.7689143744, 114.895847746), swapRB=False)
    with age_net_lock:
        age_net.setInput(blob)
        preds = age_net.forward()
    idx = preds[0].argmax()
    age_range = AGE_LIST[idx]
    age_approx = AGE_UPPER[idx]
    return age_range, age_approx


class ExtractFaceRequest(BaseModel):
    image_url: HttpUrl
    timeout: int = 30


class FaceInfo(BaseModel):
    age_range: str
    age_approx: int


class ExtractFaceResponse(BaseModel):
    face_encoding: Optional[list[float]] = None
    face_detected: bool = False
    num_faces: int = 0
    faces: list[FaceInfo] = []
    contains_minor: bool = False
    error: Optional[str] = None


class BlurFacesRequest(BaseModel):
    image_url: HttpUrl
    timeout: int = 30


class BlurFacesResponse(BaseModel):
    image_base64: Optional[str] = None
    faces_blurred: int = 0
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Limita la cantidad máxima de hilos paralelos para evitar colapso de CPU con ráfagas
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
    asyncio.get_running_loop().set_default_executor(executor)
    
    logger.info("Vision service starting with limited ThreadPoolExecutor...")
    try:
        _download_models()
        _load_age_model()
    except Exception as e:
        logger.warning(f"Age model init failed (service continues without age detection): {e}")
    yield
    logger.info("Vision service shutting down.")
    executor.shutdown(wait=False)


app = FastAPI(
    title="Reencuentros Vision",
    description="Face extraction, age detection, and face blurring microservice",
    version="2.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vision", "age_detection": age_net is not None}


def _download_image_sync(url: str, timeout: int = 30) -> bytes:
    """Descarga síncrona para usar en thread pool."""
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "ReencuentrosVision/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type:
            raise ValueError(f"URL does not point to an image (Content-Type: {content_type})")
        return resp.read()


def _process_image_cpu_bound(content: bytes, image_url: str) -> ExtractFaceResponse:
    """Ejecutado en un ThreadPool para no bloquear el Event Loop."""
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
        max_dim = 800
        if max(image.width, image.height) > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {image_url} to {image.width}x{image.height}")

        image_array = np.array(image)

        face_locations = face_recognition.face_locations(image_array, model="hog")
        num_faces = len(face_locations)

        face_encodings_list = []
        faces_info = []

        if num_faces > 0:
            face_encodings_list = face_recognition.face_encodings(image_array, face_locations)

            for i, (top, right, bottom, left) in enumerate(face_locations):
                padding = int((bottom - top) * 0.2)
                t = max(0, top - padding)
                b = min(image_array.shape[0], bottom + padding)
                l = max(0, left - padding)
                r = min(image_array.shape[1], right + padding)
                face_roi = image_array[t:b, l:r]

                age_range, age_approx = _estimate_age(face_roi)
                faces_info.append(FaceInfo(age_range=age_range, age_approx=age_approx))

        encoding = face_encodings_list[0].tolist() if face_encodings_list else None
        detected = num_faces > 0 and encoding is not None
        
        # El modelo de edad clasifica en rangos. El rango '(15-20)' tiene age_approx=20.
        # Para no perder menores de 15, 16 y 17 años, debemos incluir age_approx <= 20.
        contains_minor = any(f.age_approx <= 20 for f in faces_info)

        logger.info(
            f"Faces: {num_faces}, ages: {[f.age_approx for f in faces_info]}, "
            f"encoding={'yes' if encoding else 'no'}, minor={contains_minor}"
        )

        return ExtractFaceResponse(
            face_encoding=encoding,
            face_detected=detected,
            num_faces=num_faces,
            faces=faces_info,
            contains_minor=contains_minor,
            error=None if detected else ("No face detected" if num_faces == 0 else "Face detected but encoding failed"),
        )
    except Exception as e:
        logger.error(f"Error processing image {image_url}: {traceback.format_exc()}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Image processing error: {str(e)}",
        )


def _blur_faces_cpu_bound(content: bytes, image_url: str) -> BlurFacesResponse:
    """Blurs all detected faces in an image. Runs in thread pool."""
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
        max_dim = 1600
        if max(image.width, image.height) > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        image_array = np.array(image)

        face_locations = face_recognition.face_locations(image_array, model="hog")
        num_faces = len(face_locations)

        if num_faces == 0:
            return BlurFacesResponse(faces_blurred=0, error="No faces detected to blur")

        for top, right, bottom, left in face_locations:
            face_region = image.crop((left, top, right, bottom))
            blurred = face_region.filter(ImageFilter.GaussianBlur(radius=25))
            image.paste(blurred, (left, top))

        import base64
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        logger.info(f"Blurred {num_faces} face(s) in {image_url}")
        return BlurFacesResponse(image_base64=img_base64, faces_blurred=num_faces)
    except Exception as e:
        logger.error(f"Error blurring image {image_url}: {traceback.format_exc()}")
        return BlurFacesResponse(error=f"Blur processing error: {str(e)}")


def _verify_api_key(x_vision_api_key: Optional[str] = Header(None, alias="x-vision-api-key")):
    expected = os.environ.get("VISION_API_KEY")
    if expected and x_vision_api_key != expected:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid or missing X-Vision-API-Key")


@app.post("/extract-face", response_model=ExtractFaceResponse)
async def extract_face(req: ExtractFaceRequest, x_vision_api_key: Optional[str] = Header(None, alias="x-vision-api-key")):
    _verify_api_key(x_vision_api_key)
    try:
        image_url = str(req.image_url)
        logger.info(f"Downloading image: {image_url}")

        if not _is_safe_url(image_url):
            logger.warning(f"SSRF blocked: {image_url}")
            return ExtractFaceResponse(face_detected=False, error="URL no permitida (SSRF protection)")

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

        return await asyncio.to_thread(_process_image_cpu_bound, resp.content, str(req.image_url))

    except httpx.TimeoutException:
        logger.warning(f"Timeout downloading image: {req.image_url}")
        return ExtractFaceResponse(face_detected=False, error="Timeout downloading image")
    except httpx.RequestError as e:
        logger.warning(f"Error downloading image: {e}")
        return ExtractFaceResponse(face_detected=False, error=f"Error downloading image: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error for {req.image_url}: {traceback.format_exc()}")
        return ExtractFaceResponse(face_detected=False, error=f"Internal network error: {str(e)}")


@app.post("/blur-faces", response_model=BlurFacesResponse)
async def blur_faces(req: BlurFacesRequest, x_vision_api_key: Optional[str] = Header(None, alias="x-vision-api-key")):
    """Detecta y difumina todos los rostros en la imagen, devuelve base64."""
    _verify_api_key(x_vision_api_key)
    try:
        image_url = str(req.image_url)
        logger.info(f"Blurring faces in: {image_url}")

        if not _is_safe_url(image_url):
            logger.warning(f"SSRF blocked: {image_url}")
            return BlurFacesResponse(error="URL no permitida (SSRF protection)")

        async with httpx.AsyncClient(timeout=req.timeout) as client:
            resp = await client.get(
                image_url,
                headers={"User-Agent": "ReencuentrosVision/1.0"}
            )
            resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type:
            return BlurFacesResponse(error=f"URL does not point to an image (Content-Type: {content_type})")

        return await asyncio.to_thread(_blur_faces_cpu_bound, resp.content, str(req.image_url))

    except httpx.TimeoutException:
        logger.warning(f"Timeout downloading image: {req.image_url}")
        return BlurFacesResponse(error="Timeout downloading image")
    except httpx.RequestError as e:
        logger.warning(f"Error downloading image: {e}")
        return BlurFacesResponse(error=f"Error downloading image: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error for {req.image_url}: {traceback.format_exc()}")
        return BlurFacesResponse(error=f"Internal network error: {str(e)}")
