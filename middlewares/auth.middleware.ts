import { Request, Response, NextFunction } from 'express';

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
