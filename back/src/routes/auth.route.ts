/**
 * routes/auth.route.ts — Rutas de autenticación
 *
 * PROPÓSITO:
 *   Define los endpoints de autenticación con rate limiting específico:
 *   Google OAuth, registro por email, login, perfil, y CSRF token.
 *   Cada endpoint mutante tiene su propio rate limiter configurable.
 *
 * ENDPOINTS:
 *   GET  /api/auth/csrf-token — Obtener token CSRF (sin auth)
 *   POST /api/auth/google — Login con Google OAuth (5 intentos/15min)
 *   POST /api/auth/register — Registro email/pass (10 intentos/15min)
 *   POST /api/auth/login — Login email/pass (5 intentos/15min)
 *   GET  /api/auth/me — Perfil del usuario (auth required)
 *   POST /api/auth/profile — Actualizar perfil (auth required)
 *   POST /api/auth/logout — Cerrar sesión (auth required)
 *   GET  /api/auth/google — Stub para Google OAuth redirect
 *
 * RATE LIMITING (configurable por env vars):
 *   - authLimiter: 5 req/15min (prod), 1000 (dev) — Google Auth
 *   - loginLimiter: 5 req/15min (prod), 1000 (dev) — Login
 *   - registerLimiter: 10 req/15min (prod), 1000 (dev) — Registro
 *   - Se sobreescribe con AUTH_RATE_LIMIT, LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT
 *
 * SEGURIDAD:
 *   - Rate limiters INDEPENDIENTES: No comparten contador entre endpoints
 *   - Auth rate limit en producción (5/día): Previene brute force
 *   - requireUser: JWT válido para endpoints de perfil
 *   - CSRF exento en /auth/google (Google OAuth redirect no lleva cookie)
 *
 * DECISIONES TÉCNICAS:
 *   - 3 rate limiters separados: Evita que un ataque bloquee otros endpoints
 *   - Env var override: Flexibilidad para staging/testing
 *   - 1000 en dev: No bloquear desarrollo, 5 en prod: Seguridad
 *
 * EJEMPLOS:
 *   POST /api/auth/login { email, password } → { token, user }
 *   GET /api/auth/me (Authorization: Bearer xxx) → { user }
 *   GET /api/auth/csrf-token → { token }
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middlewares/auth.middleware';
import {
  getCsrfToken, googleAuth, register, login, googleGetStub
} from '../controllers/auth.controller';
import {
  getMe, updateProfile, logout
} from '../controllers/auth-profile.controller';

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
