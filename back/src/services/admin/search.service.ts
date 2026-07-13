/**
 * services/admin/search.service — Gestión de solicitudes de búsqueda (admin)
 *
 * PROPÓSITO:
 *   Provee consulta administrativa de solicitudes de búsqueda realizadas
 *   por los usuarios, con datos del usuario solicitante populados.
 *
 * CARACTERÍSTICAS:
 *   - getAdminSearches: consulta paginada con populate de usuario
 *
 * @module search.service
 */

import { SearchRequestModel } from '../../models/search-request.model';

export async function getAdminSearches(limit: number, offset: number) {
  const [searches, total] = await Promise.all([
    SearchRequestModel.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    SearchRequestModel.countDocuments({}),
  ]);
  return { total, limit, offset, searches };
}
