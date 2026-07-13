/**
 * controllers/search-request.controller.ts — Solicitudes de búsqueda
 *
 * PROPÓSITO:
 *   Permite a usuarios crear y gestionar solicitudes de búsqueda de
 *   personas desaparecidas. Cada solicitud activa (status='activa')
 *   alimenta el motor de matching que busca coincidencias en la BD.
 *
 * CARACTERÍSTICAS:
 *   - createSearchRequestHandler: Crear solicitud con validación Zod
 *   - getMySearchRequestsHandler: Listar mis solicitudes (sin paginación)
 *   - updateSearchRequestStatusHandler: Cambiar estado (activa/resuelta/cancelada)
 *   - Sólo el dueño puede modificar su solicitud
 *
 * FLUJO DE DATOS:
 *   1. Usuario crea solicitud con searchName + description opcional
 *   2. Zod valida (createSearchRequestSchema)
 *   3. search-request.service.createSearchRequest persiste
 *   4. Encolar matching job (vía outbox o directo)
 *   5. Usuario consulta estado vía GET /mine
 *   6. Si encuentra persona: updateStatus a 'resuelta'
 *
 * SEGURIDAD:
 *   - requireUser: Solo usuarios autenticados
 *   - userId propagation: Cada handler toma userId de req.user
 *   - Ownership check en update: updateSearchRequestStatus valida dueño
 *   - Status enum cerrado: 'activa' | 'resuelta' | 'cancelada'
 *
 * ENDPOINTS:
 *   POST   /api/search-requests — Crear solicitud
 *   GET    /api/search-requests/mine — Mis solicitudes
 *   PATCH  /api/search-requests/:id/status — Cambiar estado
 *
 * @module search-request.controller
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../middlewares/error.middleware';
import { createSearchRequest, getMySearchRequests, updateSearchRequestStatus } from '../services/search-request.service';

const createSearchRequestSchema = z.object({
  searchName: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).optional(),
  category: z.enum(['menor', 'adulto', 'adulto_mayor', 'mascota']).optional(),
  isMinor: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['activa', 'resuelta', 'cancelada']),
});

export async function createSearchRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    const parsed = createSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Datos de solicitud inválidos', { errors: parsed.error.issues }));
    }
    const { searchName, description, category, isMinor } = parsed.data;

    const newRequest = await createSearchRequest({
      user: userId,
      searchName,
      description,
      category,
      isMinor,
    });

    return res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
}

export async function getMySearchRequestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const requests = await getMySearchRequests(userId);
    return res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
}

export async function updateSearchRequestStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('Estado inválido', { errors: parsed.error.issues }));
    }
    const { status } = parsed.data;

    const request = await updateSearchRequestStatus(id, userId, status);

    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    return res.status(200).json(request);
  } catch (error) {
    next(error);
  }
}
