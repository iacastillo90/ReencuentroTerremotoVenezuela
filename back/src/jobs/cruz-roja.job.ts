import axios from 'axios';
import { DisasterEventModel } from '../models/disaster-event.model';
import { checkSyncState, markSyncSuccess } from '../services/sync-state.service';

const SOURCE = 'cruz-roja-ve';

export async function runCruzRojaJob() {
  console.log(`[CRUZ ROJA] Iniciando extracción de requerimientos médicos...`);
  
  try {
    // Mock simulando la API de la Cruz Roja Venezolana
    let alerts: any[] = [
      {
        id: `crv-donantes-01`,
        tipo: 'donacion_sangre',
        titulo: 'Urgente: Donantes de Sangre O- y A+',
        descripcion: 'Se requieren donantes urgentes en la Sede Central de la Cruz Roja en Candelaria para atender heridos del colapso estructural.',
        lat: 10.5042,
        lng: -66.8997, // La Candelaria, Caracas
        fecha: new Date().toISOString()
      },
      {
        id: `crv-insumos-01`,
        tipo: 'insumos',
        titulo: 'Centro de Acopio: Insumos Quirúrgicos',
        descripcion: 'Estamos recibiendo gasas, suturas, alcohol y solución fisiológica. NO ROPA.',
        lat: 10.5042,
        lng: -66.8997,
        fecha: new Date().toISOString()
      }
    ];

    let ingested = 0;
    for (const alert of alerts) {
      const externalId = alert.id;
      
      const syncResult = await checkSyncState(SOURCE, externalId, alert);
      if (syncResult.status === 'skipped') continue;

      await DisasterEventModel.findOneAndUpdate(
        { externalId, source: SOURCE },
        {
          type: 'social',
          severity: 'medium',
          title: `Cruz Roja: ${alert.titulo}`,
          description: alert.descripcion,
          source: SOURCE,
          externalId,
          occurredAt: new Date(alert.fecha),
          coordinates: {
            type: 'Point',
            coordinates: [alert.lng, alert.lat]
          },
          affectedAreas: ['Caracas'],
          metadata: { subType: alert.tipo, rawData: alert }
        },
        { upsert: true, new: true }
      );

      await markSyncSuccess(SOURCE, externalId, syncResult.checksum);
      ingested++;
    }

    console.log(`[CRUZ ROJA] Completado. Nuevos: ${ingested}.`);

  } catch (error: any) {
    console.error(`[CRUZ ROJA] Error crítico:`, error.message);
  }
}
