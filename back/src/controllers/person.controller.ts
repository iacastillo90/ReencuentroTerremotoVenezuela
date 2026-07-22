/**
 * controllers/person.controller.ts — Controlador de personas
 *
 * PROPÓSITO:
 *   Maneja las operaciones CRUD principales sobre personas reportadas:
 *   listar (con búsqueda y filtros), crear reportes, cerrar casos,
 *   y obtener conteos estadísticos. Es el controller más importante
 *   del sistema — recibe la mayor parte del tráfico de la API.
 *
 * CARACTERÍSTICAS:
 *   - getCounts: Estadísticas cacheadas (auspiciado, encontrado, total, pendiente)
 *   - getMyReports: Reportes del usuario autenticado (paginado)
 *   - getPersons: Búsqueda pública con filtros (nombre, estado, categoría, ubicación)
 *   - createPerson: Creación de reporte con upsert + dedup automático
 *   - closeCase: Cierre de caso con resolución (encontrado, fallecido, erróneo)
 *
 * FLUJO DE DATOS:
 *   - getPersons: Zod valida query params → personService.getPersons → toPublicPerson (excluye PII)
 *   - createPerson: Zod valida body → personService.createPerson → outbox (matching + IA)
 *   - closeCase: Zod valida body → personService.closeCase → log auditoría
 *
 * SEGURIDAD:
 *   - personSearchQuerySchema: sanitizedQueryParam en texto (previene NoSQL/ReDoS)
 *   - personPayloadSchema: Zod valida + sanitiza todo el payload
 *   - closeCaseSchema: resolución limitada a enum cerrado (found, deceased, erroneous)
 *   - toPublicPerson: Excluye embedding, faceEncoding, metadata sensibles
 *   - isAnonymous: Permite reportes anónimos (sin userId)
 *   - Rate limiting: 10 req/min para creación
 *
 * ENDPOINTS:
 *   GET    /api/persons/counts — Estadísticas
 *   GET    /api/persons/mine — Mis reportes (auth)
 *   GET    /api/persons — Búsqueda pública
 *   POST   /api/persons — Crear reporte (rate limit 10/min)
 *   POST   /api/persons/:idHash/close — Cerrar caso (auth)
 *
 * DECISIONES TÉCNICAS:
 *   - 3 schemas Zod separados: Cada handler tiene su propia validación
 *   - parseInt con fallback: getMyReports usa coerción manual (no Zod)
 *   - 202 para creación: Respuesta aceptada (procesamiento async vía outbox)
 *   - 200 para skipped: Si es duplicado exacto, responde OK sin crear
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { personPayloadSchema, personSearchQuerySchema } from '../validators/person.validator';
import * as personService from '../services/person.service';
import * as personReadService from '../services/person-read.service';
import { ValidationError } from '../middlewares/error.middleware';

const closeCaseSchema = z.object({
  resolution: z.enum(['found', 'deceased', 'erroneous']),
  notes: z.string().max(2000).optional(),
});

export async function getCounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await personReadService.getCounts();
    return res.status(200).json(counts);
  } catch (error) {
    next(error);
  }
}

const getMyReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function getMyReports(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId as string;
    const { limit, offset } = getMyReportsQuerySchema.parse(req.query);

    const result = await personReadService.getMyReports(userId, limit, offset);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPersons(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = personSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parámetros inválidos', details: parsed.error.issues });
    }
    const viewerRole = req.user?.role;

    const result = await personReadService.getPersons(parsed.data, viewerRole);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createPerson(req: Request, res: Response, next: NextFunction) {
  try {
    const validationResult = personPayloadSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Error de validación',
        details: validationResult.error.issues
      });
    }

    const payload = validationResult.data;
    const userId = payload.isAnonymous ? undefined : req.user?.userId as string;
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';

    const result = await personService.createPerson(payload, userId, ip);
    return res.status(result.status === 'skipped' ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function closeCase(req: Request, res: Response, next: NextFunction) {
  try {
    const idHash = req.params.idHash as string;
    const userId = req.user!.userId as string;
    const userRole = req.user!.role || 'user';

    const parsed = closeCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Resolución inválida', { errors: parsed.error.issues }));
    }

    const { resolution, notes } = parsed.data;
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown';

    const result = await personService.closeCase(idHash, userId, userRole, resolution, notes, ip, userAgent);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteMyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const idHash = req.params.idHash as string;
    const userId = req.user!.userId as string;
    const userRole = req.user!.role || 'user';
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) || 'unknown';
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown';

    const result = await personService.deleteMyReport(idHash, userId, userRole, ip, userAgent);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
