/**
 * services/storage.service.ts — Almacenamiento de archivos (S3/MinIO)
 *
 * PROPÓSITO:
 *   Provee almacenamiento de archivos multimedia (imágenes, videos, audios)
 *   en MinIO (S3-compatible) local o cloud. Genera URLs pre-firmadas
 *   para uploads y descargas seguras sin exponer credenciales.
 *
 * CARACTERÍSTICAS:
 *   - initializeStorage: Crea bucket si no existe
 *   - uploadMedia: Sube archivo con hash SHA-1 + extensión original
 *   - getPresignedUrl: URL temporal (1h) para descarga
 *   - getPresignedUploadUrl: URL temporal (1h) para upload directo
 *   - Validación de credentials en production (fail fast)
 *
 * FLUJO DE DATOS (upload):
 *   1. Controller recibe buffer de multer
 *   2. uploadMedia genera hash único (timestamp + originalName)
 *   3. Sube a MinIO con metadata (Content-Type)
 *   4. Retorna URL pública del objeto
 *
 * FLUJO DE DATOS (download):
 *   1. Cliente solicita URL de archivo
 *   2. getPresignedUrl genera URL firmada (1h de expiración)
 *   3. Cliente descarga directamente desde MinIO/S3
 *
 * SEGURIDAD:
 *   - Fail fast en production con credentials default (minioadmin)
 *   - Endpoint sanitizado (remueve https:// para evitar bugs)
 *   - URLs pre-firmadas: expiran en 1h, no exponen access key
 *   - Bucket creation idempotente (safe re-run)
 *   - Hash SHA-1 en filenames: previene colisiones + path traversal
 *
 * CONFIGURACIÓN (env vars):
 *   - MINIO_ENDPOINT: Host del servidor (ej: s3.amazonaws.com o localhost)
 *   - MINIO_PORT: Puerto (9000 default para MinIO, 443 para S3)
 *   - MINIO_ACCESS_KEY / MINIO_SECRET_KEY: Credenciales
 *   - MINIO_USE_SSL: true para producción
 *   - MINIO_BUCKET: Nombre del bucket (default: reencuentro-media)
 *
 * DECISIONES TÉCNICAS:
 *   - MinIO client único reutilizado (no crear por request)
 *   - Hash en filename: único + seguro vs path traversal
 *   - Presigned URLs: offload de tráfico al servidor de archivos
 *   - Bucket auto-creation: facilita deploy inicial
 *
 * CÓMO USAR:
 *   await initializeStorage(); // En bootstrap
 *   const url = await uploadMedia(buffer, 'foto.jpg', 'image/jpeg');
 *   const downloadUrl = await getPresignedUrl('abc123.jpg');
 */
import { Client } from 'minio';
import crypto from 'crypto';
import path from 'path';
import { logger } from '../utils/logger.util';

// Limpiar el endpoint por si el usuario pone https:// por error
const rawEndpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');

const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

if (minioAccessKey === 'minioadmin' || minioSecretKey === 'minioadmin') {
  if (process.env.NODE_ENV === 'production') {
    logger.fatal('[MinIO] Default credentials detected in production — refusing to start.');
    process.exit(1);
  }
  logger.warn('[MinIO] Using default credentials. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY for production.');
}

// Configuración cliente MinIO local/cloud
export const minioClient = new Client({
  endPoint: cleanEndpoint,
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: minioAccessKey,
  secretKey: minioSecretKey
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'reencuentro-media';

// Asegurar que el bucket exista
export async function initializeStorage() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      logger.info({ bucket: BUCKET_NAME }, '[Storage] Bucket created');
    }
  } catch (error) {
    logger.error({ err: error }, '[Storage] Error initializing MinIO');
  }
}

export async function getPresignedUrl(objectName: string): Promise<string> {
  return minioClient.presignedGetObject(BUCKET_NAME, objectName, 60 * 60);
}

export async function getPresignedUploadUrl(objectName: string): Promise<string> {
  return minioClient.presignedPutObject(BUCKET_NAME, objectName, 60 * 60);
}

export async function uploadMedia(fileBuffer: Buffer, originalName: string, mimeType: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.createHash('sha1').update(`${Date.now()}-${originalName}`).digest('hex');
  const fileName = `${hash}${ext}`;

  await minioClient.putObject(BUCKET_NAME, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType
  });

  return getPresignedUrl(fileName);
}
