import axios from 'axios';
import { DisasterEventModel } from '../models/disaster-event.model';
import { checkSyncState, markSyncSuccess } from '../services/sync-state.service';

const SOURCE = 'proteccion-civil-gov';

export async function runProteccionCivilJob() {
  console.log(`[PROTECCIÓN CIVIL] Iniciando extracción de vías y refugios...`);
  
  try {
    // Para el MVP usamos un mock que simula la API o un RSS de PC Nacional
    let alerts: any[] = [
      {
        id: `pc-refugio-01`,
        tipo: 'refugio',
        titulo: 'Refugio Habilitado: Polideportivo José María Vargas',
        descripcion: 'Capacidad para 500 personas. Se requiere agua potable y colchonetas.',
        lat: 10.5986,
        lng: -66.9538, // La Guaira
        fecha: new Date().toISOString()
      },
      {
        id: `pc-via-01`,
        tipo: 'via_cerrada',
        titulo: 'Cierre Preventivo: Autopista Caracas - La Guaira',
        descripcion: 'Vía cerrada en ambos sentidos por riesgo de deslizamientos a la altura del Boquerón 2.',
        lat: 10.5500,
        lng: -66.9700,
        fecha: new Date().toISOString()
      }
    ];

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
        { upsert: true, new: true }
      );

      await markSyncSuccess(SOURCE, externalId, syncResult.checksum);
      ingested++;
    }

    console.log(`[PROTECCIÓN CIVIL] Completado. Nuevos: ${ingested}.`);

  } catch (error: any) {
    console.error(`[PROTECCIÓN CIVIL] Error crítico:`, error.message);
  }
}
