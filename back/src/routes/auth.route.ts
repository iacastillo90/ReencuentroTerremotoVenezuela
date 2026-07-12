import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import {
  getCsrfToken, googleAuth, register, login, getMe,
  updateProfile, logout, googleGetStub
} from '../controllers/auth.controller';

const router = Router();

const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT) ||
  (process.env.NODE_ENV === 'production' ? 5 : 1000);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.' },
});

router.get('/csrf-token', getCsrfToken);
router.post('/google', authLimiter, googleAuth);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', requireUser, getMe);
router.post('/profile', requireUser, updateProfile);
router.post('/logout', requireUser, logout);
router.get('/google', googleGetStub);

export const authRouter = router;
