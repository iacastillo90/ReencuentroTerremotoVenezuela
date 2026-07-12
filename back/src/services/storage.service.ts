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
