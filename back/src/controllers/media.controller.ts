/**
 * controllers/media.controller.ts — Controlador de archivos multimedia
 *
 * PROPÓSITO:
 *   Maneja uploads de archivos (imágenes, videos, audios),
 *   análisis de imágenes con IA, y transcripción de audio.
 *   Valida MIME types, magic bytes, y sanitiza filenames.
 *
 * CARACTERÍSTICAS:
 *   - uploadFile: Sube archivo a S3/MinIO con validación
 *   - analyzeImage: Usa IA (OpenAI/Gemini) para describir imagen
 *   - transcribeAudio: Whisper o similar para audio → texto
 *   - validateMagicBytes: Previene MIME type forgery attacks
 *   - sanitizeFilename: Previene path traversal attacks
 *
 * FLUJO DE DATOS (upload):
 *   1. Multer intercepta multipart/form-data
 *   2. Valida MIME type y tamaño (5MB img, 20MB video)
 *   3. validateMagicBytes verifica contenido real del archivo
 *   4. sanitizeFilename limpia el nombre (elimina ../, caracteres raros)
 *   5. uploadMedia sube a S3/MinIO con path seguro
 *   6. Audit log si se rechaza por magic bytes inválidos
 *
 * FLUJO DE DATOS (IA):
 *   1. analyzeImage: Buffer → AI provider → { description, tags, objects }
 *   2. transcribeAudio: Buffer → Whisper API → texto transcrito
 *   3. Feature flags habilitan/deshabilitan proveedores
 *
 * SEGURIDAD:
 *   - requireUser en todas las rutas (solo usuarios autenticados)
 *   - Rate limiting específico (10 uploads/15min)
 *   - Magic bytes validation: previene .jpg que son .exe
 *   - Sanitize filename: previene ../../etc/passwd attacks
 *   - Audit log en rechazos (intento de upload malicioso)
 *   - MIME type filter en multer (solo image/*, video/mp4, audio/*)
 *
 * ENDPOINTS:
 *   POST /api/media — Upload genérico (auth required)
 *   POST /api/media/analyze-image — Análisis con IA (auth required)
 *   POST /api/media/audio-transcribe — Transcripción (auth required)
 *
 * DECISIONES TÉCNICAS:
 *   - Multer en memoria (buffer) para validación antes de subir
 *   - Magic bytes como segunda línea de defensa (después de MIME)
 *   - AI provider pattern: swap fácil entre OpenAI/Gemini/Anthropic
 *   - Audit log solo en errores (evita log spam en éxitos)
 */
import { Request, Response, NextFunction } from 'express';
import { uploadMedia } from '../services/storage.service';
import { getAIProvider } from '../services/ai/ai.factory';
import { validateMagicBytes, sanitizeFilename } from '../utils/file-validate.util';
import { auditLog } from '../middlewares/audit.middleware';

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    if (!(await validateMagicBytes(req.file.buffer, req.file.mimetype))) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'File upload rejected: bad magic bytes',
        detail: { declaredMime: req.file.mimetype },
        req,
      });
      return res.status(400).json({ error: 'El archivo no coincide con el tipo declarado.' });
    }

    const safeFilename = sanitizeFilename(req.file.originalname);

    const fileUrl = await uploadMedia(
      req.file.buffer,
      safeFilename,
      req.file.mimetype
    );

    return res.status(200).json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
}

export async function analyzeImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }

    const aiProvider = getAIProvider();
    if (!aiProvider.analyzeImageDraft) {
      return res.status(501).json({ error: 'Análisis de imagen no soportado por el proveedor de IA actual.' });
    }

    const analysis = await aiProvider.analyzeImageDraft(req.file.buffer, req.file.mimetype);

    return res.status(200).json(analysis);
  } catch (error) {
    next(error);
  }
}

export async function transcribeAudio(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún audio.' });
    }

    const aiProvider = getAIProvider();
    if (!aiProvider.transcribeAudio) {
      return res.status(501).json({ error: 'Transcripción de audio no soportada por el proveedor de IA actual.' });
    }

    const transcription = await aiProvider.transcribeAudio(req.file.buffer, req.file.mimetype);

    return res.status(200).json({ text: transcription });
  } catch (error) {
    next(error);
  }
}

import { minioClient } from '../services/storage.service';

export async function getMediaFile(req: Request, res: Response, next: NextFunction) {
  try {
    const filename = req.params.filename as string;
    const bucket = process.env.MINIO_BUCKET || 'reencuentro-media';
    
    // Set Content-Type from MinIO object metadata
    const stat = await minioClient.statObject(bucket, filename);
    if (stat.metaData && stat.metaData['content-type']) {
      res.setHeader('Content-Type', stat.metaData['content-type']);
    } else {
      // Fallback based on extension
      if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
      else if (filename.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
      else if (filename.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
    }
    
    const stream = await minioClient.getObject(bucket, filename);
    stream.pipe(res);
  } catch (error: any) {
    if (error.code === 'NoSuchKey') return res.status(404).send('Not found');
    next(error);
  }
}
