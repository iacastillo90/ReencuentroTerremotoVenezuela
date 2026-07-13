/**
 * controllers/localizado.controller.ts — Personas localizadas (refugios/hospitales)
 *
 * PROPÓSITO:
 *   Gestiona el ingreso y consulta de personas localizadas en refugios,
 *   hospitales, y albergues durante desastres. Recibe datos de partners
 *   (protección civil, hospitales) via API key y expone consulta pública.
 *
 * CARACTERÍSTICAS:
 *   - getLocalizadosHandler: Consulta paginada con filtros (role-aware)
 *   - postLocalizadosHandler: Ingesta masiva desde partners
 *   - Zod validation con localizadoPayloadSchema
 *   - Audit log en fallos de validación
 *
 * FLUJO DE DATOS:
 *   1. Partner envía POST con arreglo de personas localizadas
 *   2. Zod valida (localizadoPayloadSchema)
 *   3. localizado.service.postLocalizados procesa e inserta
 *   4. Respuesta 201 con conteo de insertados
 *   5. Si duplicate key (11000): 201 con aviso de duplicados omitidos
 *
 * SEGURIDAD:
 *   - x-partner-api-key: Solo partners autenticados pueden POST
 *   - Zod validation: Previene inyección de datos maliciosos
 *   - viewerRole en GET: Admin ve datos completos, usuario público ve limitado
 *   - Audit log en validation_failure: Trazabilidad de intentos inválidos
 *   - Duplicados manejados graceful: No hay error 500 por unique key
 *
 * ENDPOINTS:
 *   GET  /api/localizados — Listar localizados (público con filtros)
 *   POST /api/localizados — Ingestar localizados (partner API key)
 *
 * @module localizado.controller
 */
import { Request, Response, NextFunction } from 'express';
import { localizadoPayloadSchema } from '../validators/localizado.validator';
import { auditLog } from '../middlewares/audit.middleware';
import { getLocalizados, postLocalizados } from '../services/localizado.service';

export async function getLocalizadosHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const viewerRole = req.user?.role;
    const result = await getLocalizados(req.query as Record<string, any>, viewerRole);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function postLocalizadosHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = localizadoPayloadSchema.safeParse(req.body);
    if (!validation.success) {
      auditLog({
        eventType: 'validation_failure',
        severity: 'warning',
        actor: 'system',
        action: 'POST /localizados validation failed',
        detail: { issues: validation.error.issues },
        req,
      });
      return res.status(400).json({ error: 'Error de validación', details: validation.error.issues });
    }

    const { data } = validation.data;
    const result = await postLocalizados(data);

    return res.status(201).json({ ok: true, message: 'Localizados ingested successfully', count: result.length });
  } catch (error: any) {
    if (error.code === 11000) {
       return res.status(201).json({ ok: true, message: 'Ingested with some duplicates skipped' });
    }
    next(error);
  }
}
