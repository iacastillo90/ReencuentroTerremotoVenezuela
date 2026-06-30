import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { DisasterEventModel } from '../models/disaster-event.model';
import { getTargetBoundingBox } from '../utils/geo.util';

const rawDataSchema = z.record(z.string(), z.unknown());

export async function fetchFIRMSFires() {
  const apiKey = process.env.FIRMS_API_KEY;
  if (!apiKey) {
    console.warn('[FIRMS Sync] Missing FIRMS_API_KEY. Skipping fire sync.');
    return 0;
  }

  const bbox = getTargetBoundingBox();
  const bboxString = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  
  // Usamos el sensor VIIRS_SNPP_NRT para detección en tiempo real, día 1
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bboxString}/1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvData = await response.text();
    
    // Si la respuesta es vacía o solo cabeceras
    if (!csvData || csvData.trim().split('\n').length <= 1) {
      return 0;
    }

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    const operations = records.map((record: any) => {
      const lat = parseFloat(record.latitude);
      const lon = parseFloat(record.longitude);
      const frp = parseFloat(record.frp); // Fire Radiative Power
      
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (frp > 100) severity = 'critical';
      else if (frp > 50) severity = 'high';
      else if (frp > 20) severity = 'medium';

      // Usamos lat/lon y fecha para un id unívoco aproximado ya que FIRMS no provee un ID único
      const dateStr = record.acq_date + 'T' + record.acq_time.padStart(4, '0').slice(0, 2) + ':' + record.acq_time.padStart(4, '0').slice(2, 4) + 'Z';
      const occurredAt = new Date(dateStr);
      
      const externalId = `firms-${lat.toFixed(4)}-${lon.toFixed(4)}-${occurredAt.getTime()}`;

      return {
        updateOne: {
          filter: { externalId },
          update: {
            $set: {
              type: 'fire',
              severity,
              coordinates: {
                type: 'Point',
                coordinates: [lon, lat]
              },
              radius_km: 5, // Foco de incendio, radio de impacto aproximado 5km
              title: 'Incendio Forestal / Foco de Calor',
              description: `Detección térmica satelital (FRP: ${frp} MW)`,
              source: 'nasa-firms',
              occurredAt,
              validUntil: new Date(occurredAt.getTime() + 24 * 60 * 60 * 1000), // Válido por 24h
              metadata: {
                rawData: rawDataSchema.parse(record)
              }
            }
          },
          upsert: true
        }
      };
    });

    if (operations.length > 0) {
      await DisasterEventModel.bulkWrite(operations as any[]);
      console.log(`[FIRMS Sync] Processed ${operations.length} fire alerts.`);
    }

    return operations.length;
  } catch (error: any) {
    console.error('[FIRMS Sync] Error fetching data:', error.message);
    throw error;
  }
}
