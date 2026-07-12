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

const LOGIN_MAX = Number(process.env.LOGIN_RATE_LIMIT) ||
  (process.env.NODE_ENV === 'production' ? 5 : 1000);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' },
});

const REGISTER_MAX = Number(process.env.REGISTER_RATE_LIMIT) ||
  (process.env.NODE_ENV === 'production' ? 10 : 1000);
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de registro. Intente nuevamente en 15 minutos.' },
});

router.get('/csrf-token', getCsrfToken);
router.post('/google', authLimiter, googleAuth);
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', requireUser, getMe);
router.post('/profile', requireUser, updateProfile);
router.post('/logout', requireUser, logout);
router.get('/google', googleGetStub);

export const authRouter = router;
