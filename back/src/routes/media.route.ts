import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { uploadMedia } from '../services/storage.service';
import { ALLOWED_MIME_TYPES, IMAGE_MAX_SIZE, VIDEO_MAX_SIZE, validateMagicBytes, sanitizeFilename } from '../utils/file-validate.util';
import { auditLog } from '../middlewares/audit.middleware';
import { requireUser } from '../middlewares/auth.middleware';

const router = Router();

const mediaUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas subidas de archivos. Intente nuevamente en 15 minutos.' },
});

// Multer in-memory storage for forwarding to MinIO
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: VIDEO_MAX_SIZE // 20MB (highest tier — video max)
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo imágenes y videos (MP4).'));
    }
  }
});

router.post('/', requireUser, mediaUploadLimiter, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    // Magic byte validation
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

    // Size tier validation
    const isImage = req.file.mimetype.startsWith('image/');
    const maxSize = isImage ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;
    if (req.file.size > maxSize) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'File upload rejected: exceeds size limit',
        detail: { size: req.file.size, maxSize, mime: req.file.mimetype },
        req,
      });
      return res.status(400).json({ error: `El archivo excede el límite de ${isImage ? '5MB' : '20MB'}.` });
    }

    // Sanitize filename
    const safeFilename = sanitizeFilename(req.file.originalname);

    const fileUrl = await uploadMedia(
      req.file.buffer,
      safeFilename,
      req.file.mimetype
    );

    return res.status(200).json({ url: fileUrl });
  } catch (error: any) {
    console.error('[MediaRoute] Error subiendo archivo:', error);
    return res.status(500).json({ error: error.message || 'Error interno subiendo archivo' });
  }
});

export const mediaRouter = router;
