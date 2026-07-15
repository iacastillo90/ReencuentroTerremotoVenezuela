/**
 * validators/auth.validator — Esquemas Zod para autenticación
 *
 * PROPÓSITO:
 *   Define esquemas de validación para autenticación con Google OAuth,
 *   registro con correo/contraseña, inicio de sesión y actualización de perfil.
 *
 * SCHEMAS:
 *   - googleAuthSchema: token de Google
 *   - profileUpdateSchema: sector y número de contacto
 *   - registerSchema: nombre, email, password, contacto, ubicación
 *   - loginSchema: email y password
 *
 * @module auth.validator
 */

import { z } from 'zod';
import { sanitizedString } from '../utils/sanitize.util';

export const googleAuthSchema = z.object({
  token: sanitizedString.pipe(z.string().min(10).max(5000)),
});

export const profileUpdateSchema = z.object({
  sector: sanitizedString.pipe(z.string().min(2).max(255)),
  contactNumber: sanitizedString.pipe(z.string().min(7).max(20)),
});

// Registro con correo/contraseña. La contraseña NO se sanitiza (alteraría el valor);
// solo se valida longitud. El correo se valida como email y se normaliza en el modelo.
export const registerSchema = z.object({
  name: sanitizedString.pipe(z.string().min(2).max(100)),
  lastName: sanitizedString.pipe(z.string().min(1).max(100)).optional(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  contactNumber: sanitizedString.pipe(z.string().min(7).max(20)).optional(),
  country: sanitizedString.pipe(z.string().max(100)).optional(),
  state: sanitizedString.pipe(z.string().max(100)).optional(),
  municipality: sanitizedString.pipe(z.string().max(100)).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export type GoogleAuthPayload = z.infer<typeof googleAuthSchema>;
export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
