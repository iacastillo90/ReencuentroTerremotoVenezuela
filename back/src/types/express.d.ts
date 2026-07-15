/**
 * types/express.d.ts — Extensiones de tipos Express
 *
 * PROPÓSITO:
 *   Extiende la interfaz Request de Express para incluir los datos
 *   del usuario autenticado inyectados por el middleware de autenticación.
 *
 * CARACTERÍSTICAS:
 *   - user: userId, email, role, status, tokenVersion, isProfileComplete
 *   - AuthenticatedRequest: tipo helper con user no-nullable
 *
 * @module express.d
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        role?: string;
        status?: string;
        tokenVersion?: number;
        isProfileComplete?: boolean;
      };
    }
  }
}

export type AuthenticatedRequest = Request & {
  user: NonNullable<Request['user']>;
};
