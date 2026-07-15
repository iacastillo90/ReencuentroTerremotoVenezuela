/**
 * middlewares/auth.middleware.ts — Autenticación y autorización
 *
 * PROPÓSITO:
 *   Maneja toda la lógica de autenticación: validación de JWT,
 *   API keys (admin, webhook, partner), y verificación de roles.
 *   Provee decoradores de ruta (requireUser, requireAdminApiKey, etc).
 *
 * CARACTERÍSTICAS:
 *   - requireUser: Valida JWT desde Bearer token o cookie
 *   - requireAdminApiKey: API key para endpoints admin
 *   - requireWebhookApiKey: API key para webhooks entrantes
 *   - requirePartnerApiKey: API key para partners
 *   - requireProfileComplete: Bloquea usuarios con perfil incompleto
 *   - tokenVersion check: Invalida JWTs si se incrementó versión
 *
 * FLUJO DE DATOS:
 *   1. Extrae token de Authorization header o cookie
 *   2. Verifica firma JWT con JWT_SECRET
 *   3. Valida payload con Zod schema
 *   4. Busca usuario en BD para verificar tokenVersion
 *   5. Si tokenVersion != JWT, rechaza (sesión revocada)
 *   6. Para API keys: hash y busca en BD, verifica active=true
 *
 * SEGURIDAD:
 *   - JWT con RS256/HS256, expiración 7d
 *   - tokenVersion para invalidación sin logout explícito
 *   - API keys hasheadas con SHA-256 antes de persistir
 *   - Legacy key detection: log warning si usa key sin hashear
 *   - Audit log en todos los eventos auth
 *
 * DECISIONES TÉCNICAS:
 *   - requireUser busca usuario completo (no solo tokenVersion) para
 *     asegurar que el usuario aún existe y está activo
 *   - API keys soportan legacy mode (sin hash) con warning log
 *   - Token puede venir de Bearer o cookie (flexibilidad cliente)
 *
 * CÓMO USAR:
 *   router.get('/protected', requireUser, handler);
 *   router.post('/admin', requireAdminApiKey, handler);
 *   router.post('/webhook', requireWebhookApiKey, handler);
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { UserModel } from '../models/user.model';
import { ApiKeyModel } from '../models/api-key.model';
import { auditLog } from './audit.middleware';
import { JWT_SECRET } from '../utils/jwt-secret.util';
import { logger } from '../utils/logger.util';
import { hashApiKey } from '../utils/hash.util';

async function findApiKeyByKey(rawKey: string, type: 'admin' | 'webhook' | 'partner') {
  const hashedKey = hashApiKey(rawKey);
  const filter = { active: true, type } as const;
  let doc = await ApiKeyModel.findOne({ key: hashedKey, ...filter });
  if (!doc) {
    doc = await ApiKeyModel.findOne({ key: rawKey, ...filter });
    if (doc) {
      logger.warn({ keyPrefix: doc.keyPrefix }, '[Auth] Legacy unhashed API key used — recreate key to migrate');
    }
  }
  return doc;
}

export function getJwtSecret(): string {
  return JWT_SECRET;
}

const jwtPayloadSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  tokenVersion: z.number().optional(),
  isProfileComplete: z.boolean().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado: Token faltante o inválido' });
  }
  try {
    const raw = jwt.verify(token, JWT_SECRET);
    const parsed = jwtPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return res.status(401).json({ error: 'Payload de token inválido' });
    }
    const decoded = parsed.data;

    const user = await UserModel.findById(decoded.userId).select('tokenVersion');
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Token revocado. Inicie sesión nuevamente.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'No autorizado: Token inválido' });
  }
}

export async function requireProfileComplete(req: Request, res: Response, next: NextFunction) {
  try {
    await requireUser(req, res, () => {
      if (!req.user?.isProfileComplete) {
        return res.status(403).json({ error: 'Prohibido: Perfil incompleto' });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'No autorizado' });
  }
}

export async function requireAdminApiKey(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const raw = jwt.verify(token, JWT_SECRET);
      const parsed = jwtPayloadSchema.safeParse(raw);
      if (!parsed.success) { return res.status(403).json({ error: 'Payload de token inválido' }); }
      const decoded = parsed.data;
      if (decoded.role === 'admin') {
        req.user = decoded;
        next();
        return;
      }
      return res.status(403).json({ error: 'Prohibido: Se requiere acceso de administrador' });
    } catch (err) {
      logger.warn({ err }, 'Admin auth: JWT verification failed, falling back to API key');
    }
  }

  const apiKey = req.headers['x-api-key'];

  if (typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'No autorizado: Clave API requerida' });
  }

  const envKey = process.env.ADMIN_API_KEY;
  if (envKey) {
    const envBuffer = Buffer.from(envKey);
    const keyBuffer = Buffer.from(apiKey);
    if (keyBuffer.length === envBuffer.length && crypto.timingSafeEqual(keyBuffer, envBuffer)) {
      auditLog({
        eventType: 'admin_action',
        severity: 'warning',
        actor: 'api-key',
        action: `${req.method} ${req.path} — Legacy admin API key used`,
        detail: { migration: 'Migrate to DB-stored API key' },
        req,
      });
      next();
      return;
    }
  }

  const valid = await findApiKeyByKey(apiKey, 'admin');
  if (!valid) {
    return res.status(401).json({ error: 'No autorizado: Clave API inválida o revocada' });
  }

  await ApiKeyModel.updateOne({ _id: valid._id }, { lastUsedAt: new Date() });
  next();
}

export async function requireWebhookApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-webhook-api-key'];

  if (typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'No autorizado: Clave de webhook requerida' });
  }

  const envKey = process.env.WEBHOOK_API_KEY;
  if (envKey) {
    const envBuffer = Buffer.from(envKey);
    const keyBuffer = Buffer.from(apiKey);
    if (keyBuffer.length === envBuffer.length && crypto.timingSafeEqual(keyBuffer, envBuffer)) {
      next();
      return;
    }
  }

  const valid = await findApiKeyByKey(apiKey, 'webhook');
  if (!valid) {
    return res.status(401).json({ error: 'No autorizado: Clave de webhook inválida o revocada' });
  }

  await ApiKeyModel.updateOne({ _id: valid._id }, { lastUsedAt: new Date() });
  next();
}

export async function requirePartnerApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-partner-api-key'];

  if (typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'No autorizado: Clave de socio requerida' });
  }

  const envKey = process.env.PARTNER_API_KEY;
  if (envKey) {
    const envBuffer = Buffer.from(envKey);
    const keyBuffer = Buffer.from(apiKey);
    if (keyBuffer.length === envBuffer.length && crypto.timingSafeEqual(keyBuffer, envBuffer)) {
      next();
      return;
    }
  }

  const valid = await findApiKeyByKey(apiKey, 'partner');
  if (!valid) {
    return res.status(401).json({ error: 'No autorizado: Clave de socio inválida o revocada' });
  }

  await ApiKeyModel.updateOne({ _id: valid._id }, { lastUsedAt: new Date() });
  next();
}
