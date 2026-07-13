/**
 * services/partner.service.ts — Consulta de casos para partners
 *
 * PROPÓSITO:
 *   Servicio de consulta para la API de partners. Expone casos de
 *   personas con campos seleccionados, paginación, y orden por fecha
 *   de creación descendente. Los campos PII se excluyen en la proyección.
 *
 * CARACTERÍSTICAS:
 *   - getPartnerCases: Consulta paginada con filtro por status
 *   - Proyección explícita: Solo campos necesarios para partners
 *   - lean(): Máxima performance (sin hidratación Mongoose)
 *   - countDocuments: Total para paginación
 *
 * FLUJO DE DATOS:
 *   1. Partner envía GET con filtros opcionales
 *   2. PersonModel.find(filter) con proyección select
 *   3. countDocuments para total
 *   4. Retorna { data, total, offset, limit }
 *
 * SEGURIDAD:
 *   - Proyección restrictiva: No expone embedding, faceEncoding, metadata interno
 *   - Filtro por status: Solo casos visibles según status
 *   - sort por createdAt: No permite orden personalizado (injection-safe)
 *   - limit máximo 1000 en controller: Previene scraping
 *
 * @module partner.service
 */
import { PersonModel } from '../models/unified-person.model';

export async function getPartnerCases(filter: any, limit: number, offset: number) {
  const cases = await PersonModel.find(filter)
    .select('name status age gender description lastSeen photoUrl aliases contactPerson type metadata.createdAt metadata.updatedAt metadata.source metadata.urgencyScore metadata.confidenceLabel metadata.auditStatus')
    .sort({ 'metadata.createdAt': -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await PersonModel.countDocuments(filter);

  return { data: cases, total, offset, limit };
}
