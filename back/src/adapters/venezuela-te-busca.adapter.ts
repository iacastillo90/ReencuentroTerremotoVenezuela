/**
 * adapters/venezuela-te-busca.adapter — Adaptador para Venezuela Te Busca
 *
 * PROPÓSITO:
 *   Normaliza los datos de personas reportadas por la plataforma
 *   Venezuela Te Busca al formato interno PersonPayload.
 *
 * CARACTERÍSTICAS:
 *   - Valida campos críticos (id_registro, nombres, estado_desaparicion)
 *   - Mapea nombres compuestos, edad y estado de desaparición
 *
 * @module venezuela-te-busca.adapter
 */

import { ISourceAdapter } from './base.adapter';
import { PersonPayload } from '../validators/person.validator';

export interface VTBData {
  id_registro: string;
  nombres: string;
  apellidos: string;
  estado_desaparicion: string;
  municipio?: string;
  fecha_reporte: string;
  edad_aprox?: number | string;
}

export class VenezuelaTeBuscaAdapter implements ISourceAdapter<VTBData> {
  sourceName = 'venezuela-te-busca';

  normalize(rawData: VTBData): PersonPayload {
    if (!rawData.id_registro || !rawData.nombres || !rawData.estado_desaparicion) {
      throw new Error('VTBAdapter: Missing critical fields (id_registro, nombres, estado_desaparicion)');
    }

    return {
      source: this.sourceName,
      externalId: String(rawData.id_registro),
      type: 'person',
      name: `${rawData.nombres} ${rawData.apellidos || ''}`.trim(),
      estado: rawData.estado_desaparicion,
      date: rawData.fecha_reporte ? new Date(rawData.fecha_reporte).toISOString() : new Date().toISOString(),
      data: {
        age: rawData.edad_aprox ? Number(rawData.edad_aprox) : undefined
      }
    };
  }
}
