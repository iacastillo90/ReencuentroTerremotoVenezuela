import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.ADMIN_API_KEY;

  if (!validKey) {
    console.warn('[Security] ADMIN_API_KEY is not defined in environment variables. Denying all admin access.');
    return res.status(403).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
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
