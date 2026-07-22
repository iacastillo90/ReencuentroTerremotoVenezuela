/**
 * jobs/proteccion-civil.job — Sincronización de alertas de Protección Civil
 *
 * PROPÓSITO:
 *   Extrae información de vías cerradas y refugios habilitados desde
 *   la API de Protección Civil y los registra como eventos de desastre.
 *
 * CARACTERÍSTICAS:
 *   - Mapea vías cerradas como "landslide" y refugios como "social"
 *   - Deduplicación mediante checkSyncState
 *
 * @module proteccion-civil.job
 */

import axios from 'axios';
import { DisasterEventModel } from '../models/disaster-event.model';
import { checkSyncState, markSyncSuccess } from '../services/sync-state.service';
import { logger } from '../utils/logger.util';

const SOURCE = 'proteccion-civil-gov';

export async function runProteccionCivilJob() {
  logger.info('[PROTECCIÓN CIVIL] Iniciando extracción de vías y refugios...');
  
  try {
    // TODO: Reemplazar con integración real a API o RSS de PC Nacional
    let alerts: any[] = [];

    let ingested = 0;
    for (const alert of alerts) {
      const externalId = alert.id;
      
      const syncResult = await checkSyncState(SOURCE, externalId, alert);
      if (syncResult.status === 'skipped') continue;

      // Mapeamos refugios y vías como eventos 'social' o 'landslide' dependiendo
      const eventType = alert.tipo === 'via_cerrada' ? 'landslide' : 'social';
      const severity = alert.tipo === 'via_cerrada' ? 'high' : 'low';

      await DisasterEventModel.findOneAndUpdate(
        { externalId, source: SOURCE },
        {
          type: eventType,
          severity,
          title: `Protección Civil: ${alert.titulo}`,
          description: alert.descripcion,
          source: SOURCE,
          externalId,
          occurredAt: new Date(alert.fecha),
          coordinates: {
            type: 'Point',
            coordinates: [alert.lng, alert.lat]
          },
          affectedAreas: ['Vargas', 'Caracas'],
          metadata: { subType: alert.tipo, rawData: alert }
        },
        { upsert: true, returnDocument: 'after' }
      );

      await markSyncSuccess(SOURCE, externalId, syncResult.checksum);
      ingested++;
    }

    logger.info({ ingested }, '[PROTECCIÓN CIVIL] Completado.');

  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[PROTECCIÓN CIVIL] Error crítico');
  }
}
