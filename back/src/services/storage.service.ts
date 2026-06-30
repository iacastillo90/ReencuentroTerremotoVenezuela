import { Client } from 'minio';
import crypto from 'crypto';
import path from 'path';

// Limpiar el endpoint por si el usuario pone https:// por error
const rawEndpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Configuración cliente MinIO local/cloud
export const minioClient = new Client({
  endPoint: cleanEndpoint,
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'reencuentro-media';

// Asegurar que el bucket exista
export async function initializeStorage() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`[Storage] Bucket '${BUCKET_NAME}' creado (sin política pública).`);
    }
  } catch (error) {
    console.error(`[Storage] Error inicializando MinIO:`, error);
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
