/**
 * adapters/venezuelareporta.adapter — Adaptador para VenezuelaReporta
 *
 * PROPÓSITO:
 *   Normaliza los datos de personas reportadas por la plataforma
 *   VenezuelaReporta al formato interno PersonPayload.
 *
 * CARACTERÍSTICAS:
 *   - Mapea status "a_salvo"/"encontrado" → "found"
 *   - Extrae nombre, ciudad, foto, edad y fecha del reporte
 *
 * @module venezuelareporta.adapter
 */

import { ISourceAdapter } from './base.adapter';
import { PersonPayload } from '../validators/person.validator';

export interface VenezuelaReportaRaw {
  id?: string;
  nombre?: string;
  status?: string;
  edad?: number | string;
  genero?: string;
  ciudad?: string;
  zona?: string;
  ultima_vez?: string;
  descripcion?: string;
  foto_url?: string;
  ficha_url?: string;
  origen?: string;
  verificado_por?: string;
  created_at?: string;
  cedula?: string;
}

export class VenezuelaReportaAdapter implements ISourceAdapter<VenezuelaReportaRaw> {
  sourceName = 'venezuelareporta';

  normalize(rawData: VenezuelaReportaRaw): PersonPayload {
    const mappedStatus = rawData.status === 'a_salvo' || rawData.status === 'encontrado' ? 'found' : 'missing';

    return {
      source: this.sourceName,
      externalId: String(rawData.id || ''),
      type: 'person',
      name: (rawData.nombre || '').trim(),
      estado: rawData.ciudad || 'Desconocido',
      date: rawData.created_at ? new Date(rawData.created_at).toISOString() : new Date().toISOString(),
      photoUrl: rawData.foto_url || undefined,
      data: {
        age: rawData.edad ? Number(rawData.edad) : undefined,
      },
    };
  }
}
