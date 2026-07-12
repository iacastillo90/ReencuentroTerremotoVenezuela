import io
import logging
import traceback
from contextlib import asynccontextmanager
from typing import Optional

import face_recognition
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vision")


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


@app.post("/extract-face", response_model=ExtractFaceResponse)
def extract_face(req: ExtractFaceRequest):
    try:
        logger.info(f"Downloading image: {req.image_url}")
        resp = requests.get(
            str(req.image_url),
            timeout=req.timeout,
            headers={"User-Agent": "ReencuentrosVision/1.0"},
        )
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type:
            return ExtractFaceResponse(
                face_detected=False,
                error=f"URL does not point to an image (Content-Type: {content_type})",
            )

        image = Image.open(io.BytesIO(resp.content)).convert("RGB")
        image_array = face_recognition.load_image_file(io.BytesIO(resp.content))

        face_locations = face_recognition.face_locations(image_array)
        num_faces = len(face_locations)

        if num_faces == 0:
            logger.info(f"No face detected in {req.image_url}")
            return ExtractFaceResponse(
                face_detected=False,
                num_faces=0,
            )

        face_encodings = face_recognition.face_encodings(image_array, face_locations)

        if not face_encodings:
            logger.info(f"Face detected but encoding failed for {req.image_url}")
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

    except requests.Timeout:
        logger.warning(f"Timeout downloading image: {req.image_url}")
        return ExtractFaceResponse(
            face_detected=False,
            error="Timeout downloading image",
        )
    except requests.RequestException as e:
        logger.warning(f"Error downloading image: {e}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Error downloading image: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error processing {req.image_url}: {traceback.format_exc()}")
        return ExtractFaceResponse(
            face_detected=False,
            error=f"Internal error: {str(e)}",
        )
