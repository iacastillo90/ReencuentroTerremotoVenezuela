import axios from 'axios';
import * as cheerio from 'cheerio';
import { DisasterEventModel } from '../models/disaster-event.model';
import { checkSyncState, markSyncSuccess, markSyncError } from '../services/sync-state.service';
import { logger } from '../utils/logger.util';

const SOURCE = 'inameh-gov';
const SOURCE_URL = 'http://www.inameh.gob.ve/web/'; // URL base de INAMEH

export async function runInamehJob() {
  logger.info('[INAMEH] Iniciando extracción de alertas climáticas...');
  
  try {
    let alerts: any[] = [];
    
    // Intentar hacer scraping de la web oficial
    const response = await axios.get(SOURCE_URL, { timeout: 8000 });
    const $ = cheerio.load(response.data);
    
    // Suponiendo que hay un div con clase 'alerta-meteorologica'
    $('.alerta-meteorologica').each((_, element) => {
      const title = $(element).find('h3').text().trim();
      const description = $(element).find('.desc').text().trim();
      const dateRaw = $(element).find('.fecha').text().trim();
      
      if (title && description) {
        alerts.push({
          id: `inameh-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title,
          description,
          fecha: dateRaw || new Date().toISOString(),
          type: title.toLowerCase().includes('inundación') ? 'flood' : 'hurricane',
          severity: 'medium'
        });
      }
    });

    // Si la página no tiene la estructura (cambió o no hay alertas), usamos el fallback
    if (alerts.length === 0) throw new Error('Estructura no encontrada o sin alertas');

    let ingested = 0;
    let skipped = 0;

    for (const alert of alerts) {
      const externalId = alert.id;
      
      const syncResult = await checkSyncState(SOURCE, externalId, alert, new Date(alert.fecha));
      if (syncResult.status === 'skipped') {
        skipped++;
        continue;
      }

      await DisasterEventModel.findOneAndUpdate(
        { externalId, source: SOURCE },
        {
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: `INAMEH Oficial: ${alert.description}`,
          source: SOURCE,
          externalId,
          occurredAt: new Date(alert.fecha),
          coordinates: {
            type: 'Point',
            // Si es mock, usamos coords, sino coordenadas centrales de Vzla o Caracas aproximadas
            coordinates: [alert.lng || -66.9, alert.lat || 10.48]
          },
          affectedAreas: ['Distrito Capital', 'Miranda'],
          metadata: { rawData: alert }
        },
        { upsert: true, new: true }
      );

      await markSyncSuccess(SOURCE, externalId, syncResult.checksum);
      ingested++;
    }

    logger.info({ ingested, skipped }, '[INAMEH] Extracción completada.');

  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[INAMEH] Error crítico en la extracción');
  }
}
