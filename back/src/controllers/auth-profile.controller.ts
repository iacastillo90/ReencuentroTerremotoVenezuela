/**
 * controllers/auth-profile.controller.ts — Perfil y sesión
 *
 * PROPÓSITO:
 *   Maneja las operaciones de perfil de usuario y gestión de sesión
 *   que no son parte del flujo principal de autenticación:
 *   - getMe: obtener perfil del usuario autenticado
 *   - updateProfile: actualizar perfil (invalida sesión previa)
 *   - logout: cerrar sesión (incrementa tokenVersion)
 *
 * SEGURIDAD:
 *   - updateProfile incrementa tokenVersion para invalidar JWT anteriores
 *   - AuditLog registra todos los logout
 *   - Zod validation en inputs
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { profileUpdateSchema } from '../validators/auth.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { JWT_SECRET } from '../utils/jwt-secret.util';

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
      { returnDocument: 'after' }
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

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
