/**
 * services/localizado.service.ts — Personas localizadas (CRUD)
 *
 * PROPÓSITO:
 *   Servicio de consulta e ingesta de personas localizadas en refugios,
 *   hospitales y albergues. Aplica safeRegexQuery para prevenir ReDoS
 *   y toPublicLocalizado para filtrar PII según el rol del viewer.
 *
 * CARACTERÍSTICAS:
 *   - getLocalizados: Búsqueda paginada con filtros por nombre/cédula/ubicación
 *   - postLocalizados: Inserción masiva con ordered:false (tolera duplicados)
 *   - safeRegexQuery en todos los inputs de texto
 *   - toPublicLocalizado: Excluye datos sensibles según rol
 *
 * FLUJO DE DATOS (GET):
 *   1. Query params: q (búsqueda texto), location (filtro ubicación)
 *   2. safeRegexQuery sanitiza cada input
 *   3. Filtro $or: name O cedula (regex case-insensitive)
 *   4. sort createdAt desc + skip/limit
 *   5. toPublicLocalizado mapea cada resultado
 *   6. countDocuments para total de paginación
 *
 * FLUJO DE DATOS (POST):
 *   1. Arreglo de objetos localizados
 *   2. insertMany con ordered:false (si un registro falla, continúa)
 *
 * SEGURIDAD:
 *   - safeRegexQuery: Previene ReDoS en inputs de texto libre
 *   - toPublicLocalizado: Diferente proyección según role (admin vs user)
 *   - lean(): Sin hidratación Mongoose (protege contra prototype pollution)
 *   - limit por defecto 100: Previene scraping masivo
 *
 * @module localizado.service
 */
import { LocalizadoModel } from '../models/localizado.model';
import { safeRegexQuery } from '../utils/regex-escape.util';
import { toPublicLocalizado } from '../utils/person-view.util';

export async function getLocalizados(query: Record<string, any>, viewerRole?: string) {
  const q = query.q as string | undefined;
  const location = query.location as string | undefined;
  const maxLimit = query.limit ?? 100;
  const skip = query.offset ?? 0;

  const filter: any = {};

  if (q) {
    const sanitizedQ = safeRegexQuery(String(q));
    if (sanitizedQ) {
      const searchRegex = new RegExp(sanitizedQ, 'i');
      filter.$or = [
        { name: searchRegex },
        { cedula: searchRegex }
      ];
    }
  }

  if (location) {
    const sanitizedLocation = safeRegexQuery(String(location));
    if (sanitizedLocation) {
      filter.location = new RegExp(sanitizedLocation, 'i');
    }
  }

  const data = await LocalizadoModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(maxLimit)
    .lean();

  const publicData = data.map((d: any) => toPublicLocalizado(d, viewerRole));
  const total = await LocalizadoModel.countDocuments(filter);

  return { data: publicData, total, offset: skip, limit: maxLimit };
}

export async function postLocalizados(data: any[]) {
  const result = await LocalizadoModel.insertMany(data, { ordered: false });
  return result;
}
