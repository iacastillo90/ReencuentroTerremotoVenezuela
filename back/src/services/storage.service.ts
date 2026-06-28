import { Client } from 'minio';
import crypto from 'crypto';
import path from 'path';

// Configuración cliente MinIO local
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
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
      // Establecer política de lectura pública para que el frontend pueda ver las imágenes
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:GetObject'],
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
          }
        ]
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`[Storage] Bucket '${BUCKET_NAME}' creado y configurado como público.`);
    }
  } catch (error) {
    console.error(`[Storage] Error inicializando MinIO:`, error);
  }
}

export async function uploadMedia(fileBuffer: Buffer, originalName: string, mimeType: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.createHash('sha1').update(`${Date.now()}-${originalName}`).digest('hex');
  const fileName = `${hash}${ext}`;

  await minioClient.putObject(BUCKET_NAME, fileName, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType
  });

  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const endPoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
  const port = process.env.MINIO_PORT || '9000';
  
  const baseUrl = process.env.PUBLIC_STORAGE_URL || `${protocol}://${endPoint}:${port}/${BUCKET_NAME}`;
  
  return `${baseUrl}/${fileName}`;
}
