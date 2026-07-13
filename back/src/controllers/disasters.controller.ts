/**
 * controllers/disasters.controller.ts — Controlador de desastres
 *
 * PROPÓSITO:
 *   Expone endpoints para consultar eventos de desastres naturales
 *   (sismos, inundaciones, incendios, huracanes, deslizamientos).
 *   Soporta filtros por tipo, fecha, ubicación y severidad.
 *
 * CARACTERÍSTICAS:
 *   - getDisasters: Query con filtros (tipo, fecha range, geo)
 *   - getActiveDisasters: Desastres activos (validUntil > now)
 *   - disasterQuerySchema: Valida type, date ranges, coordinates
 *   - GeoJSON queries: 2dsphere index para búsquedas por radio
 *
 * FLUJO DE DATOS:
 *   1. Request con query params (type, from, to, lat, lng, radius)
 *   2. Zod valida y transforma fechas (ISO strings → Date objects)
 *   3. Service construye filtro MongoDB con operadores geoespaciales
 *   4. Query optimizada con índices (type, occurredAt, coordinates)
 *
 * SEGURIDAD:
 *   - Endpoint público (sin auth) — datos de interés público
 *   - Rate limiting global (previene scraping masivo)
 *   - Zod validation previene NoSQL injection
 *   - sanitizedQueryParam en ubicación (previene ReDoS)
 *
 * ENDPOINTS:
 *   GET /api/disasters — Query con filtros
 *   GET /api/disasters/active — Solo desastres activos
 *
 * EJEMPLOS:
 *   GET /api/disasters?type=earthquake&from=2024-01-01&to=2024-12-31
 *   GET /api/disasters/active?lat=10.5&lng=-66.9&radius=100
 *
 * DECISIONES TÉCNICAS:
 *   - disasterQuerySchema usa z.coerce.date para flexibilidad
 *   - Active disasters calcula validUntil > now en tiempo real
 *   - Geo queries usan $nearSphere con maxDistance (km → radians)
 */
import { Request, Response, NextFunction } from 'express';
import { queryDisasters, getActiveDisasters, disasterQuerySchema } from '../services/disaster-events.service';

export async function getDisasters(req: Request, res: Response, next: NextFunction) {
  try {
    const queryValidation = disasterQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: 'Parámetros de consulta inválidos', details: queryValidation.error.issues });
    }

    const disasters = await queryDisasters(queryValidation.data);

    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
}

export async function getActiveDisastersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const disasters = await getActiveDisasters();
    return res.status(200).json(disasters);
  } catch (error) {
    next(error);
  }
}
