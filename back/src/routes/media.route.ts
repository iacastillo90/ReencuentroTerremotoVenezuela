/**
 * routes/media.route.ts — Rutas de subida de archivos multimedia
 *
 * PROPÓSITO:
 *   Rutas para subir archivos multimedia (imágenes, audio, video)
 *   con validación de tipo MIME, límite de tamaño, y rate limiting.
 *   Usa multer con memoryStorage y validación por tipo.
 *
 * SEGURIDAD:
 *   - requireUser: Solo usuarios autenticados
 *   - Rate limit: 10 req / 15 min (previene abuso de almacenamiento)
 *   - Multer fileFilter: Valida MIME type antes de procesar
 *   - Tamaños limitados: 5MB imágenes, 20MB video/audio
 *   - Tipos restringidos: Solo image/*, video/mp4, audio/*
 *
 * ENDPOINTS:
 *   POST /api/media — Subir archivo general (foto/video)
 *   POST /api/media/analyze-image — Analizar imagen con IA
 *   POST /api/media/audio-transcribe — Transcribir audio
 *
 * @module media.route
 */
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import { uploadFile, analyzeImage, transcribeAudio, getMediaFile } from '../controllers/media.controller';
import { ALLOWED_MIME_TYPES, IMAGE_MAX_SIZE, VIDEO_MAX_SIZE } from '../utils/file-validate.util';

const router = Router();

const mediaUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas subidas de archivos. Intente nuevamente en 15 minutos.' },
});

const storage = multer.memoryStorage();

const uploadImage = multer({
  storage,
  limits: { fileSize: IMAGE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo imágenes permitidas.'));
    }
  }
});

const uploadGeneral = multer({
  storage,
  limits: { fileSize: VIDEO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo imágenes y videos (MP4).'));
    }
  }
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: VIDEO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/webm')) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo archivos de audio generados por el navegador.'));
    }
  }
});

router.post('/', requireUser, mediaUploadLimiter, uploadGeneral.single('file'), uploadFile);
router.post('/analyze-image', requireUser, mediaUploadLimiter, uploadImage.single('image'), analyzeImage);
router.post('/audio-transcribe', requireUser, mediaUploadLimiter, uploadAudio.single('audio'), transcribeAudio);
router.get('/:filename', getMediaFile);

export const mediaRouter = router;
