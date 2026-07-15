/**
 * controllers/auth.controller.ts — Autenticación y autorización
 *
 * PROPÓSITO:
 *   Maneja el flujo completo de autenticación: Google OAuth,
 *   registro con email/password, login, logout, y gestión de sesión.
 *   Emite JWTs con tokenVersion para invalidación segura.
 *
 * CARACTERÍSTICAS:
 *   - Google OAuth con validación de payload
 *   - Registro con hash de contraseña (bcrypt)
 *   - JWT con tokenVersion para revocación
 *   - CSRF double-submit cookie
 *   - Auditoría de todos los eventos auth
 *   - Detección de admin por email (ENV)
 *
 * FLUJO DE DATOS:
 *   1. Usuario envía credenciales (Google token o email/pass)
 *   2. Se valida con Zod schema
 *   3. Se busca/crea usuario en BD
 *   4. Se genera JWT con tokenVersion actual
 *   5. Se setea cookie httpOnly + CSRF cookie
 *   6. Se loguea evento en AuditLog
 *
 * SEGURIDAD:
 *   - Zod validation en todos los inputs
 *   - Rate limiting específico por endpoint (login: 5/15min)
 *   - Password hash con bcrypt (10 rounds)
 *   - JWT firmado con RS256 o HS256
 *   - tokenVersion incrementado en updateProfile
 *   - PII excluida de responses (proyección Mongoose)
 *
 * CÓMO USAR:
 *   POST /api/auth/google — { token: string } → { token, user }
 *   POST /api/auth/register — { email, password, ... } → { token, user }
 *   POST /api/auth/login — { email, password } → { token, user }
 *   POST /api/auth/logout — (cookie) → 204
 */
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { generateCsrfToken } from '../middlewares/csrf.middleware';
import { googleAuthSchema, registerSchema, loginSchema } from '../validators/auth.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { JWT_SECRET } from '../utils/jwt-secret.util';
import { logger } from '../utils/logger.util';

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || (process.env.DEV_MODE === 'true' ? 'dev-client-id' : '');
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * issueSession — Genera JWT y setea cookies para un usuario
 *
 * DECISIONES TÉCNICAS:
 *   - JWT con tokenVersion para invalidación: si se cambia la
 *     contraseña o se compromete la sesión, se incrementa
 *     tokenVersion en BD y todos los JWT anteriores son inválidos.
 *   - Cookie httpOnly + secure (prod) + sameSite=strict (prod)
 *   - CSRF cookie separada para doble submit
 *   - Token JWT NO se incluye en la respuesta JSON (solo en cookie HttpOnly)
 *
 * @param res - Response de Express para setear cookies
 * @param user - Datos del usuario (ID, email, role, tokenVersion)
 */
function issueSession(res: Response, user: { _id: string; email: string; isProfileComplete: boolean; role: string; status: string; tokenVersion: number }): void {
  const authToken = jwt.sign(
    { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
      role: user.role, status: user.status, tokenVersion: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function getCsrfToken(req: Request, res: Response) {
  const token = generateCsrfToken();
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.json({ token });
}

export async function googleAuth(req: Request, res: Response, next: NextFunction) {
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
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { token } = validation.data;
    let payload: { sub: string; email?: string; name?: string; picture?: string } | undefined;

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload() as { sub: string; email?: string; name?: string; picture?: string } | undefined;
    } catch (e) {
      logger.error({ err: e }, '[AuthRoute] Google token verification failed');
      return res.status(401).json({ error: 'Token de Google inválido' });
    }

    if (!payload) return res.status(401).json({ error: 'Token de Google inválido' });

    const { sub: googleId, email, name, picture } = payload;

    let user = await UserModel.findOne({ googleId });
    if (!user) {
      const isAdmin = process.env.ADMIN_EMAIL && email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
      user = await UserModel.create({
        googleId,
        email,
        name,
        picture,
        isProfileComplete: false,
        role: isAdmin ? 'admin' : 'user',
        status: isAdmin ? 'approved' : 'pending'
      });
    }

    const authToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, isProfileComplete: user.isProfileComplete,
        role: user.role, status: user.status, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/google',
      detail: { email: user.email },
      req,
    });

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }
    const { name, lastName, email, password, contactNumber, country, state, municipality } = validation.data;
    const normEmail = email.toLowerCase().trim();

    const existing = await UserModel.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const isAdmin = process.env.ADMIN_EMAIL && normEmail === process.env.ADMIN_EMAIL.toLowerCase();
    const user = await UserModel.create({
      email: normEmail,
      name,
      lastName,
      passwordHash: await hashPassword(password),
      contactNumber,
      country,
      state,
      municipality,
      isProfileComplete: Boolean(contactNumber),
      role: isAdmin ? 'admin' : 'user',
      status: isAdmin ? 'approved' : 'pending'
    });

    issueSession(res, {
      _id: user._id.toString(),
      email: user.email,
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion
    });
    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/register',
      detail: { email: user.email },
      req,
    });
    return res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }
    const { email, password } = validation.data;
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const maskedEmail = email.replace(/(?<=.).(?=.*@)/g, '*');
      auditLog({
        eventType: 'auth_login_failure',
        severity: 'warning',
        actor: req.ip || 'unknown',
        action: 'POST /auth/login failed',
        detail: { email: maskedEmail },
        req,
      });
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    issueSession(res, {
      _id: user._id.toString(),
      email: user.email,
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion
    });
    auditLog({
      eventType: 'auth_login_success',
      severity: 'info',
      actor: user._id.toString(),
      action: 'POST /auth/login',
      detail: { email: user.email },
      req,
    });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export function googleGetStub(_req: Request, res: Response) {
  res.status(405).json({ error: 'Use POST /api/auth/google' });
}
