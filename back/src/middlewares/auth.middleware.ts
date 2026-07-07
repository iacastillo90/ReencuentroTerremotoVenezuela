import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { auditLog } from './audit.middleware';
import { JWT_SECRET } from '../utils/jwt-secret.util';

export function getJwtSecret(): string {
  return JWT_SECRET;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
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

export function requireWebhookApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-webhook-api-key'];
  const validKey = process.env.WEBHOOK_API_KEY;

  if (!validKey) {
    console.error('[FATAL] WEBHOOK_API_KEY is not defined in environment variables. Denying all webhook access.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook API key' });
  }

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
