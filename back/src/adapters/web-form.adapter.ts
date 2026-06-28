import { ISourceAdapter } from './base.adapter';
import { PersonPayload } from '../validators/person.validator';

export interface WebFormData {
  submission_id: string;
  nombre_completo: string;
  lugar_visto_estado: string;
  lugar_visto_ciudad?: string;
  edad?: number;
  es_mascota?: boolean;
  timestamp: string;
}

export class WebFormAdapter implements ISourceAdapter<WebFormData> {
  sourceName = 'web-form';

  normalize(rawData: WebFormData): PersonPayload {
    if (!rawData.submission_id || !rawData.nombre_completo || !rawData.lugar_visto_estado) {
      throw new Error('WebFormAdapter: Missing critical fields');
    }

    return {
      source: this.sourceName,
      externalId: rawData.submission_id,
      type: rawData.es_mascota ? 'animal' : 'person',
      name: rawData.nombre_completo.trim(),
      estado: rawData.lugar_visto_estado.trim(),
      date: rawData.timestamp ? new Date(rawData.timestamp).toISOString() : new Date().toISOString(),
      data: {
        age: rawData.edad
      }
    };
  }
}
