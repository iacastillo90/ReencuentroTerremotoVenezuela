/**
 * services/storage.service.ts — Almacenamiento de archivos (S3/Supabase Storage)
 *
 * PROPÓSITO:
 *   Provee almacenamiento de archivos multimedia (imágenes, videos, audios)
 *   en Supabase Storage vía protocolo S3 compatible. Genera URLs pre-firmadas
 *   para uploads y descargas seguras sin exponer credenciales.
 *
 * CARACTERÍSTICAS:
 *   - initializeStorage: Verifica conectividad y crea bucket si no existe
 *   - uploadMedia: Sube archivo con hash SHA-1 + extensión original
 *   - getPresignedUrl: URL temporal (1h) para descarga
 *   - getPresignedUploadUrl: URL temporal (1h) para upload directo
 *
 * MIGRACIÓN MinIO → AWS SDK v3:
 *   El SDK de MinIO usa virtual-hosted style (bucket.endpoint/object) por defecto
 *   y no soporta path prefixes arbitrarios. Supabase Storage S3 usa path-style
 *   con el prefijo /storage/v1/s3. AWS SDK v3 soporta endpoints custom con
 *   forcePathStyle y es el SDK que Supabase recomienda para compatibilidad S3.
 *
 * CONFIGURACIÓN (env vars):
 *   - MINIO_ENDPOINT: Host del servidor (ej: dfydmvrbadyknfwdkpao.supabase.co)
 *   - MINIO_PORT: Puerto (443 para Supabase/S3, 9000 para MinIO local)
 *   - MINIO_ACCESS_KEY / MINIO_SECRET_KEY: Credenciales S3
 *   - MINIO_USE_SSL: true para producción con Supabase
 *   - MINIO_BUCKET: Nombre del bucket (default: reencuentro-media)
 *
 * ENDPOINT SUPABASE:
 *   El endpoint completo para Supabase es:
 *   https://<project-ref>.supabase.co/storage/v1/s3
 *   El SDK lo construye a partir de MINIO_ENDPOINT + MINIO_USE_SSL.
 *   Si el endpoint ya incluye /storage/v1/s3 se usa tal cual.
 *
 * DECISIONES TÉCNICAS:
 *   - forcePathStyle: true → requerido para Supabase Storage S3
 *   - AWS SDK v3 modular: tree-shakeable, menor bundle size
 *   - getSignedUrl de @aws-sdk/s3-request-presigner: URLs pre-firmadas SigV4
 *   - Hash SHA-1 en filenames: único + seguro vs path traversal
 *
 * CÓMO USAR:
 *   await initializeStorage(); // En bootstrap
 *   const url = await uploadMedia(buffer, 'foto.jpg', 'image/jpeg');
 *   const downloadUrl = await getPresignedUrl('abc123.jpg');
 */
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  BucketAlreadyExists,
  BucketAlreadyOwnedByYou,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import { logger } from '../utils/logger.util';

// ─── Configuración del endpoint ──────────────────────────────────────────────

const rawEndpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
// Normalizar: remover esquema si viene con https:// o http://
const cleanHost = rawEndpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');

const useSSL = process.env.MINIO_USE_SSL === 'true';
const port = parseInt(process.env.MINIO_PORT || (useSSL ? '443' : '9000'));
const scheme = useSSL ? 'https' : 'http';

// Construir endpoint completo para AWS SDK
// Para Supabase: https://project-ref.supabase.co/storage/v1/s3
// Para MinIO local: http://127.0.0.1:9000
let endpointUrl: string;
if (cleanHost.includes('supabase.co')) {
  // Supabase Storage S3 usa path prefix /storage/v1/s3
  const portStr = (useSSL && port === 443) || (!useSSL && port === 80) ? '' : `:${port}`;
  endpointUrl = `${scheme}://${cleanHost}${portStr}/storage/v1/s3`;
} else if (port === 443 || port === 80) {
  endpointUrl = `${scheme}://${cleanHost}`;
} else {
  endpointUrl = `${scheme}://${cleanHost}:${port}`;
}

// ─── Credenciales ─────────────────────────────────────────────────────────────

const accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

if (accessKeyId === 'minioadmin' || secretAccessKey === 'minioadmin') {
  if (process.env.NODE_ENV === 'production') {
    logger.fatal('[Storage] Default credentials detected in production — refusing to start.');
    process.exit(1);
  }
  logger.warn('[Storage] Using default credentials. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY for production.');
}

// ─── Cliente S3 (AWS SDK v3) ──────────────────────────────────────────────────

export const s3Client = new S3Client({
  endpoint: endpointUrl,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  // forcePathStyle: requerido para MinIO, Supabase y cualquier S3-compatible
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'reencuentro-media';

logger.info({ endpoint: endpointUrl, bucket: BUCKET_NAME, ssl: useSSL }, '[Storage] S3 client configured');

// ─── initializeStorage ────────────────────────────────────────────────────────

/**
 * Verifica conectividad con el bucket S3 y lo crea si no existe.
 * Llamar en bootstrap antes de arrancar el servidor HTTP.
 */
export async function initializeStorage(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    logger.info({ bucket: BUCKET_NAME }, '[Storage] Bucket verified OK');
  } catch (err: unknown) {
    const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } })?.name;
    const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;

    if (
      code === 'BucketAlreadyExists' ||
      err instanceof BucketAlreadyExists ||
      err instanceof BucketAlreadyOwnedByYou ||
      httpStatus === 409
    ) {
      logger.info({ bucket: BUCKET_NAME }, '[Storage] Bucket already exists');
      return;
    }

    if (httpStatus === 404 || code === 'NoSuchBucket') {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        logger.info({ bucket: BUCKET_NAME }, '[Storage] Bucket created');
      } catch (createErr) {
        logger.error({ err: createErr }, '[Storage] Error creating bucket');
      }
      return;
    }

    // Error de conectividad / credenciales — log detallado pero no bloquea arranque
    logger.error({ err, endpoint: endpointUrl, bucket: BUCKET_NAME, httpStatus, code }, '[Storage] Error initializing — storage unavailable');
  }
}

// ─── getPresignedUrl ──────────────────────────────────────────────────────────

/**
 * Genera URL pre-firmada para descarga (GET) de un objeto.
 * Expira en 1 hora.
 */
export async function getPresignedUrl(objectName: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectName });
  return getSignedUrl(s3Client, command, { expiresIn: 60 * 60 });
}

// ─── getPresignedUploadUrl ────────────────────────────────────────────────────

/**
 * Genera URL pre-firmada para upload directo (PUT) de un objeto.
 * Expira en 1 hora.
 */
export async function getPresignedUploadUrl(objectName: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: objectName });
  return getSignedUrl(s3Client, command, { expiresIn: 60 * 60 });
}

// ─── uploadMedia ──────────────────────────────────────────────────────────────

/**
 * Sube un archivo al bucket y retorna la URL relativa para servir vía backend.
 *
 * @param fileBuffer - Buffer del archivo (de multer)
 * @param originalName - Nombre original del archivo (para extraer extensión)
 * @param mimeType - MIME type del archivo
 * @returns URL relativa: /api/media/<hash>.<ext>
 */
export async function uploadMedia(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.createHash('sha1').update(`${Date.now()}-${originalName}`).digest('hex');
  const fileName = `${hash}${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    ContentLength: fileBuffer.length,
  }));

  return `/api/media/${fileName}`;
}

// Alias para compatibilidad con código existente que importa minioClient
/** @deprecated Usar s3Client directamente */
export const minioClient = s3Client;
