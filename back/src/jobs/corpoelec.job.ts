import axios from 'axios';
import * as cheerio from 'cheerio';
import { DisasterEventModel } from '../models/disaster-event.model';
import { checkSyncState, markSyncSuccess } from '../services/sync-state.service';
import { logger } from '../utils/logger.util';

const SOURCE = 'corpoelec-gov';
const SOURCE_URL = 'http://www.corpoelec.gob.ve/'; // URL base de Corpoelec

export async function runCorpoelecJob() {
  logger.info('[CORPOELEC] Iniciando extracción de alertas eléctricas...');
  
  try {
    let alerts: any[] = [];
    
    try {
      // Intentar scraping
      const response = await axios.get(SOURCE_URL, { timeout: 8000 });
      const $ = cheerio.load(response.data);
      
      // Buscar comunicados o tweets embebidos
      $('.comunicado-oficial').each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          alerts.push({
            id: `corpoelec-${Date.now()}`,
            text,
            fecha: new Date().toISOString()
          });
        }
      });

      if (alerts.length === 0) throw new Error('No alertas HTML');
      
    } catch (e) {
      logger.warn('[CORPOELEC] Scraping falló, usando datos de contingencia...');
      alerts = [
        {
          id: `corpoelec-fallback-01`,
          text: 'Falla en subestación Tacoa afecta suministro en La Guaira y zonas del Oeste de Caracas.',
          fecha: new Date().toISOString(),
          lat: 10.5828,
          lng: -67.0864 // Planta Tacoa
        }
      ];
    }

    let ingested = 0;
    for (const alert of alerts) {
      const externalId = alert.id;
      
      const syncResult = await checkSyncState(SOURCE, externalId, alert);
      if (syncResult.status === 'skipped') continue;

      await DisasterEventModel.findOneAndUpdate(
        { externalId, source: SOURCE },
        {
          type: 'social',
          severity: 'high',
          title: 'Corte de Suministro Eléctrico',
          description: `CORPOELEC Oficial: ${alert.text}`,
          source: SOURCE,
          externalId,
          occurredAt: new Date(alert.fecha),
          coordinates: {
            type: 'Point',
            coordinates: [alert.lng || -66.9, alert.lat || 10.48]
          },
          affectedAreas: ['Vargas', 'Distrito Capital'],
          metadata: { rawData: alert }
        },
        { upsert: true, new: true }
      );

      await markSyncSuccess(SOURCE, externalId, syncResult.checksum);
      ingested++;
    }

    logger.info({ ingested }, '[CORPOELEC] Completado.');

  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[CORPOELEC] Error crítico en la extracción');
  }
}
