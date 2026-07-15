/**
 * services/search-request.service.ts — Solicitudes de búsqueda (CRUD)
 *
 * PROPÓSITO:
 *   Servicio para gestionar solicitudes de búsqueda de usuarios.
 *   Al crear una solicitud, encola automáticamente un job de matching
 *   para detectar coincidencias con personas en la BD.
 *
 * CARACTERÍSTICAS:
 *   - createSearchRequest: Crea solicitud + encola matching job
 *   - getMySearchRequests: Lista solicitudes del usuario (ordenadas por fecha)
 *   - updateSearchRequestStatus: Cambia estado con ownership check
 *   - Encolado automático: personMatchingQueue al crear
 *
 * FLUJO DE DATOS:
 *   1. Usuario crea solicitud con searchName, description, category
 *   2. SearchRequestModel.create persiste la solicitud
 *   3. personMatchingQueue.enqueue: Encola job de matching
 *   4. Si matching encuentra coincidencias → se notifica al usuario
 *
 * SEGURIDAD:
 *   - Ownership check en update: findOneAndUpdate con user: userId
 *   - Encolado de matching: No expone datos sensibles en la queue
 *
 * @module search-request.service
 */
import { SearchRequestModel, ISearchRequest } from '../models/search-request.model';
import { personMatchingQueue } from '../queues/person-matching.queue';

interface CreateSearchRequestData {
  user: string;
  searchName: string;
  description?: string;
  category?: 'menor' | 'adulto' | 'adulto_mayor' | 'mascota';
  isMinor?: boolean;
}

export async function createSearchRequest(data: CreateSearchRequestData): Promise<ISearchRequest> {
  const newRequest = await SearchRequestModel.create(data);

  await personMatchingQueue.enqueue({ idHash: newRequest._id.toString(), source: 'search-request' });

  return newRequest as ISearchRequest;
}

export async function getMySearchRequests(userId: string) {
  return SearchRequestModel.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function updateSearchRequestStatus(id: string, userId: string, status: string) {
  const request = await SearchRequestModel.findOneAndUpdate(
    { _id: id, user: userId },
    { status },
    { new: true }
  );
  return request;
}
