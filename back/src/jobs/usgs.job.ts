/**
 * jobs/usgs.job — Sincronización de sismos USGS
 *
 * PROPÓSITO:
 *   Consulta la API de USGS (United States Geological Survey) para
 *   obtener sismos recientes (magnitud ≥ 2.5) en el área de Venezuela
 *   y los inserta como eventos de desastre tipo "earthquake".
 *
 * CARACTERÍSTICAS:
 *   - Filtro por bounding box de Venezuela
 *   - Clasifica severidad según magnitud
 *   - Inserción masiva con bulkWrite
 *
 * @module usgs.job
 */

import { z } from 'zod';
import { DisasterEventModel } from '../models/disaster-event.model';
import { getTargetBoundingBox } from '../utils/geo.util';
import { logger } from '../utils/logger.util';

const rawDataSchema = z.record(z.string(), z.unknown());

export async function fetchUSGSEarthquakes() {
  const bbox = getTargetBoundingBox();
  
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
              `&minlatitude=${bbox.minLat}&maxlatitude=${bbox.maxLat}` +
              `&minlongitude=${bbox.minLon}&maxlongitude=${bbox.maxLon}` +
              `&minmagnitude=2.5&orderby=time&limit=50`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const features = data.features || [];

    const operations = features.map((feature: any) => {
      const { id, properties, geometry } = feature;
      const magnitude = properties.mag;
      const depth = geometry.coordinates[2];
      
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (magnitude >= 7) severity = 'critical';
      else if (magnitude >= 6) severity = 'high';
      else if (magnitude >= 4.5) severity = 'medium';

      return {
        updateOne: {
          filter: { externalId: `usgs-${id}` },
          update: {
            $set: {
              type: 'earthquake',
              severity,
              coordinates: {
                type: 'Point',
                coordinates: [geometry.coordinates[0], geometry.coordinates[1]]
              },
              radius_km: magnitude * 15, // Aproximación empírica
              title: properties.title,
              description: properties.place || 'Sismo en Venezuela',
              source: 'usgs',
              occurredAt: new Date(properties.time),
              metadata: {
                magnitude,
                depth_km: depth,
                rawData: rawDataSchema.parse(properties)
              }
            }
          },
          upsert: true
        }
      };
    });

    if (operations.length > 0) {
      await DisasterEventModel.bulkWrite(operations);
      logger.info({ count: operations.length }, '[USGS Sync] Processed earthquakes.');
    }

    return operations.length;
  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[USGS Sync] Error fetching data');
    throw error;
  }
}
