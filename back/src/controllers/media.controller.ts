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

    if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
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
