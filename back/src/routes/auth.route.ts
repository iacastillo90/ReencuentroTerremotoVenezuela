import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserModel } from '../models/user.model';
import { requireUser } from '../middlewares/auth.middleware';
import { generateCsrfToken } from '../middlewares/csrf.middleware';
import { googleAuthSchema, profileUpdateSchema, registerSchema, loginSchema } from '../validators/auth.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { hashPassword, verifyPassword } from '../utils/password.util';

const router = Router();

// JWT_SECRET startup validation — fail-fast in production
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET is required in production');
    process.exit(1);
  }
  console.warn('[WARN] JWT_SECRET not set. Generated temporary development secret.');
  return 'dev-secret-do-not-use-in-production';
})();

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || (process.env.DEV_MODE === 'true' ? 'dev-client-id' : '');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Rate limiter for auth routes — 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.' },
});

router.use(authLimiter);

// CSRF token endpoint
router.get('/csrf-token', (req: Request, res: Response) => {
  const token = generateCsrfToken();
  // Patrón double-submit: el cliente DEBE poder leer esta cookie por JS
  // (document.cookie) para reenviarla como header `x-csrf-token`. Por eso NO
  // es httpOnly (no es un secreto de sesión; el JWT sí sigue httpOnly). En
  // desarrollo (http://localhost) `secure` debe ser false o el navegador la descarta.
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  });
  return res.json({ token });
});

router.post('/google', async (req: Request, res: Response) => {
  try {
    const validation = googleAuthSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'auth_login_failure',
        severity: 'warning',
        actor: req.ip || 'unknown',
        action: 'POST /auth/google validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { token } = validation.data;
    let payload: any;

    try {
      // Verify Google token
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // DEV_MODE bypass: skip Google verification
      if (process.env.DEV_MODE === 'true') {
        if (process.env.NODE_ENV === 'production') {
          auditLog({
            eventType: 'security_violation',
            severity: 'critical',
            actor: req.ip || 'unknown',
            action: 'Attempted DEV_MODE bypass in production',
            req,
          });
          return res.status(403).json({ error: 'DEV_MODE disabled in production' });
        }
        console.warn('[DEV_MODE] Skipping Google token verification');
        const decoded = jwt.decode(token) as any;
        payload = decoded;
      } else {
        throw e;
      }
    }

    if (!payload) return res.status(401).json({ error: 'Invalid Google Token' });

    const { sub: googleId, email, name, picture } = payload;

    let user = await UserModel.findOne({ googleId });
    if (!user) {
      user = await UserModel.create({
        googleId,
        email,
        name,
        picture,
        isProfileComplete: false
      });
    }

    const authToken = jwt.sign(
      { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
        role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookie
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/google',
      detail: { email: user.email },
      req,
    });

    return res.status(200).json({ token: authToken, user });
  } catch (error: any) {
    console.error('[AuthRoute] Google Auth Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Firma el JWT (con tokenVersion) y fija la cookie httpOnly, igual que el flujo de Google.
function issueSession(res: Response, user: any): string {
  const authToken = jwt.sign(
    { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
      role: user.role, tokenVersion: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
  return authToken;
}

// ── Registro con correo/contraseña ───────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }
    const { name, lastName, email, password, contactNumber, country, state, municipality } = validation.data;
    const normEmail = email.toLowerCase().trim();

    const existing = await UserModel.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const user = await UserModel.create({
      email: normEmail,
      name,
      lastName,
      passwordHash: hashPassword(password),
      contactNumber,
      country,
      state,
      municipality,
      isProfileComplete: Boolean(contactNumber),
    });

    const authToken = issueSession(res, user);
    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/register',
      detail: { email: user.email },
      req,
    });
    return res.status(201).json({ token: authToken, user });
  } catch (error) {
    console.error('[AuthRoute] POST /register Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Login con correo/contraseña ──────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }
    const { email, password } = validation.data;
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      auditLog({
        eventType: 'auth_login_failure',
        severity: 'warning',
        actor: req.ip || 'unknown',
        action: 'POST /auth/login failed',
        detail: { email },
        req,
      });
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const authToken = issueSession(res, user);
    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/login',
      detail: { email: user.email },
      req,
    });
    return res.status(200).json({ token: authToken, user });
  } catch (error) {
    console.error('[AuthRoute] POST /login Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/me', requireUser, async (req: Request, res: Response) => {
  try {
    const user = await UserModel.findById((req as any).user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/profile', requireUser, async (req: Request, res: Response) => {
  try {
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.issues });
    }

    const { sector, contactNumber } = validation.data;

    const user = await UserModel.findByIdAndUpdate(
      (req as any).user.userId,
      { sector, contactNumber, isProfileComplete: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const authToken = jwt.sign(
      { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
        role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookie
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    return res.status(200).json({ token: authToken, user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Logout — increment tokenVersion to invalidate all existing JWTs
router.post('/logout', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    res.clearCookie('token');
    res.clearCookie('csrf-token');

    auditLog({
      eventType: 'auth_logout',
      severity: 'info',
      actor: userId,
      action: 'POST /auth/logout',
      req,
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/google', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Use POST /api/auth/google' });
});

export const authRouter = router;
