import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { generateCsrfToken } from '../middlewares/csrf.middleware';
import { googleAuthSchema, profileUpdateSchema, registerSchema, loginSchema } from '../validators/auth.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { hashPassword, verifyPassword } from '../utils/password.util';
import { JWT_SECRET } from '../utils/jwt-secret.util';
import { logger } from '../utils/logger.util';

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || (process.env.DEV_MODE === 'true' ? 'dev-client-id' : '');
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

function issueSession(res: Response, user: { _id: string; email: string; isProfileComplete: boolean; role: string; status: string; tokenVersion: number }): string {
  const authToken = jwt.sign(
    { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
      role: user.role, status: user.status, tokenVersion: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true',
    sameSite: (process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true') ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return authToken;
}

export function getCsrfToken(req: Request, res: Response) {
  const token = generateCsrfToken();
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true',
    sameSite: (process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true') ? 'none' : 'lax',
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
      secure: process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true',
      sameSite: (process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true') ? 'none' : 'lax',
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

    return res.status(200).json({ token: authToken, user });
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

    const authToken = issueSession(res, {
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
    return res.status(201).json({ token: authToken, user });
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

    const authToken = issueSession(res, {
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
    return res.status(200).json({ token: authToken, user });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { sector, contactNumber } = validation.data;

    const user = await UserModel.findByIdAndUpdate(
      req.user!.userId,
      { sector, contactNumber, isProfileComplete: true, $inc: { tokenVersion: 1 } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const authToken = jwt.sign(
      { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete,
        role: user.role, status: user.status, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true',
      sameSite: (process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true') ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ token: authToken, user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    res.clearCookie('token');

    auditLog({
      eventType: 'auth_logout',
      severity: 'info',
      actor: userId,
      action: 'POST /auth/logout',
      req,
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export function googleGetStub(_req: Request, res: Response) {
  res.status(405).json({ error: 'Use POST /api/auth/google' });
}
