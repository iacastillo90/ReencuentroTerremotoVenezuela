/**
 * adapters/reencuentro.adapter — Adaptador para la API de Reencuentro
 *
 * PROPÓSITO:
 *   Normaliza los datos de personas provenientes de la API de
 *   Reencuentro/ApoyaVe al formato interno PersonPayload.
 *
 * CARACTERÍSTICAS:
 *   - Mapea campos como nombre, apellido, estado, foto y edad
 *   - Construye URLs absolutas para fotos relativas
 *
 * @module reencuentro.adapter
 */

import { ISourceAdapter } from './base.adapter';
import { PersonPayload } from '../validators/person.validator';

export interface ReencuentroRaw {
  id?: string;
  _id?: string;
  nombre?: string;
  apellido?: string;
  status?: string;
  edad?: number | string;
  sexo?: string;
  estado?: string;
  municipio?: string;
  descripcion?: string;
  foto?: string;
  lastSeen?: {
    date?: string;
    state?: string;
    municipality?: string;
  };
}

export class ReencuentroAdapter implements ISourceAdapter<ReencuentroRaw> {
  sourceName = 'reencuentro-api';

  normalize(rawData: ReencuentroRaw): PersonPayload {
    return {
      source: this.sourceName,
      externalId: String(rawData.id || rawData._id || ''),
      type: 'person',
      name: `${rawData.nombre || ''} ${rawData.apellido || ''}`.trim(),
      estado: rawData.estado || rawData.lastSeen?.state || 'Desconocido',
      date: new Date().toISOString(),
      photoUrl: rawData.foto
        ? (rawData.foto.startsWith('/') ? `https://ayudahumanitariavenezuela.com${rawData.foto}` : rawData.foto)
        : undefined,
      data: {
        age: rawData.edad ? Number(rawData.edad) : undefined,
      },
    };
  }
}
