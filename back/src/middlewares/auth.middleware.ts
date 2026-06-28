import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../models/user.model';
import { auditLog } from './audit.middleware';

// JWT_SECRET startup validation — fail-fast in production
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET is required in production');
    process.exit(1);
  }
  const generated = crypto.randomBytes(64).toString('hex');
  console.warn('[WARN] JWT_SECRET not set. Generated temporary development secret.');
  return generated;
})();

export function getJwtSecret(): string {
  return JWT_SECRET;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // tokenVersion check — fetch user from DB
    const user = await UserModel.findById(decoded.userId).select('tokenVersion');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Token revoked. Please login again.' });
    }

    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export async function requireProfileComplete(req: Request, res: Response, next: NextFunction) {
  try {
    await requireUser(req, res, () => {
      if (!(req as any).user.isProfileComplete) {
        return res.status(403).json({ error: 'Forbidden: Profile incomplete' });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction) {
  // First: try JWT with admin role
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role === 'admin') {
        (req as any).user = decoded;
        next();
        return;
      }
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    } catch {
      // JWT invalid — fall through to API key check
    }
  }

  // Fallback: existing API key check (legacy)
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.ADMIN_API_KEY;

  if (!validKey) {
    console.warn('[Security] ADMIN_API_KEY is not defined in environment variables. Denying all admin access.');
    return res.status(403).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }

  // Log legacy API key usage for migration tracking
  auditLog({
    eventType: 'admin_action',
    severity: 'warning',
    actor: 'api-key',
    action: `${req.method} ${req.path} — Legacy admin API key used`,
    detail: { migration: 'Migrate to JWT admin auth' },
    req,
  });

  next();
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
