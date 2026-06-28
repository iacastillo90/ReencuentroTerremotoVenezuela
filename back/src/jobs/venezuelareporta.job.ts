import { PersonModel } from '../models/unified-person.model';
import crypto from 'crypto';

const SOURCE_ID = 'venezuelareporta';
const SOURCE_URL = 'https://venezuelareporta.org/api/v1/personas?limit=100';

export async function fetchVenezuelaReporta() {
  console.log(`[VenezuelaReporta] Iniciando sincronización...`);
  
  try {
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${SOURCE_URL}&offset=${offset}`;
      console.log(`[VenezuelaReporta] Obteniendo ${url}...`);
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ReencuentroVE/1.0 (Integración)' }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      const items = data.personas || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const operations = items.map((item: any) => {
        const idHash = crypto.createHash('sha256').update(`${SOURCE_ID}-${item.id}`).digest('hex');
        
        // Status mapping: buscando -> missing, a_salvo/encontrado -> found
        let mappedStatus = 'missing';
        if (item.status === 'a_salvo' || item.status === 'encontrado') {
          mappedStatus = 'found';
        }

        let gender = 'unknown';
        if (item.genero === 'masculino') gender = 'M';
        if (item.genero === 'femenino') gender = 'F';

        return {
          updateOne: {
            filter: { idHash },
            update: {
              $set: {
                type: 'person',
                normalizedName: (item.nombre || '').toLowerCase().trim(),
                name: (item.nombre || '').trim(),
                status: mappedStatus,
                age: item.edad || null,
                gender: gender,
                lastSeen: {
                  date: item.created_at ? new Date(item.created_at) : new Date(),
                  state: item.ciudad || 'Desconocido',
                  municipality: item.zona || 'Desconocido',
                  description: [item.ultima_vez, item.descripcion].filter(Boolean).join(' - '),
                  coordinates: {
                    type: 'Point',
                    coordinates: [-66.9, 10.48] // Cerca de La Guaira
                  }
                },
                photoUrl: item.foto_url || null,
                sourceRecords: [{ source: SOURCE_ID, externalId: item.id, rawData: item }],
                metadata: {
                  urgencyScore: mappedStatus === 'missing' ? 85 : 0,
                  confidenceScore: item.verificado ? 100 : 70,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              }
            },
            upsert: true
          }
        };
      });

      if (operations.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < operations.length; i += chunkSize) {
          await PersonModel.bulkWrite(operations.slice(i, i + chunkSize) as any[]);
        }
        totalProcessed += operations.length;
      }

      offset += items.length;
      
      // Delay to respect rate limits (120 req/min)
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[VenezuelaReporta] Sincronización completada: ${totalProcessed} personas procesadas.`);
    return totalProcessed;
    
  } catch (error: any) {
    console.error(`[VenezuelaReporta] Error crítico:`, error.message);
    throw error;
  }
}
