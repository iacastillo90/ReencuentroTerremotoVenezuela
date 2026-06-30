import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function requireAdminOrVerifier(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.ADMIN_API_KEY;

  // 1. Check API Key
  if (apiKey && validKey && apiKey === validKey) {
    return next();
  }

  // 2. Check JWT Role
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role === 'admin' || decoded.role === 'verifier') {
        (req as any).user = decoded;
        return next();
      }
    } catch (e) {
      // invalid token, fall through to 401
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid Admin Credentials' });
}

export function requirePartnerApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-partner-api-key'];
  const validKey = process.env.PARTNER_API_KEY;

  if (!validKey) {
    console.warn('[Security] PARTNER_API_KEY is not defined in environment variables. Denying all partner access.');
    return res.status(403).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Partner API Key' });
  }

  next();
}

export const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] JWT_SECRET no está definido. El servidor aborta en producción.');
  }
  // Desarrollo: secreto ALEATORIO por proceso (no se hardcodea ningún secreto en el código).
  // Las sesiones se invalidan al reiniciar; define JWT_SECRET en .env para sesiones estables.
  console.warn('[Security] JWT_SECRET no definido: generando un secreto aleatorio temporal para desarrollo. Define JWT_SECRET en .env.');
  return crypto.randomBytes(48).toString('hex');
})();

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

// Adjunta req.user si hay un token válido, pero NO bloquea si no hay (vista pública vs ampliada)
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      (req as any).user = jwt.verify(token, JWT_SECRET);
    } catch {
      /* token inválido → continuar como anónimo */
    }
  }
  next();
}

export function requireProfileComplete(req: Request, res: Response, next: NextFunction) {
  requireUser(req, res, () => {
    if (!(req as any).user.isProfileComplete) {
      return res.status(403).json({ error: 'Forbidden: Profile incomplete' });
    }
    next();
  });
}

// RBAC Middleware
export function requireRoles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireUser(req, res, () => {
      const userRole = (req as any).user.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      next();
    });
  };
}
