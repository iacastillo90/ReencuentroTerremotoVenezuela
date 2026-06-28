import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-reencuentro-2024';

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
