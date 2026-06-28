import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadMedia } from '../services/storage.service';

const router = Router();

// Multer in-memory storage for forwarding to MinIO
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept images and mp4 videos
    if (file.mimetype.startsWith('image/') || file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo imágenes y videos (MP4).'));
    }
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    const fileUrl = await uploadMedia(
      req.file.buffer, 
      req.file.originalname, 
      req.file.mimetype
    );

    return res.status(200).json({ url: fileUrl });
  } catch (error: any) {
    console.error('[MediaRoute] Error subiendo archivo:', error);
    return res.status(500).json({ error: error.message || 'Error interno subiendo archivo' });
  }
});

export const mediaRouter = router;
