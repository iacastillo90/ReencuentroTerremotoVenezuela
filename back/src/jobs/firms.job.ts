/**
 * jobs/firms.job — Sincronización de incendios satelitales (NASA FIRMS)
 *
 * PROPÓSITO:
 *   Consulta la API de FIRMS (Fire Information for Resource Management System)
 *   de la NASA para detectar focos de calor/incendios en el área objetivo
 *   y los inserta como eventos de desastre tipo "fire".
 *
 * CARACTERÍSTICAS:
 *   - Usa datos del sensor VIIRS_SNPP_NRT en tiempo real
 *   - Filtra por bounding box de Venezuela
 *   - Clasifica severidad según Fire Radiative Power (FRP)
 *   - Inserción masiva con bulkWrite
 *
 * SEGURIDAD:
 *   - Requiere FIRMS_API_KEY en variable de entorno
 *
 * @module firms.job
 */

import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { DisasterEventModel } from '../models/disaster-event.model';
import { getTargetBoundingBox } from '../utils/geo.util';
import { logger } from '../utils/logger.util';

const rawDataSchema = z.record(z.string(), z.unknown());

export async function fetchFIRMSFires() {
  const apiKey = process.env.FIRMS_API_KEY;
  if (!apiKey) {
    logger.warn('[FIRMS Sync] Missing FIRMS_API_KEY. Skipping fire sync.');
    return 0;
  }

  const bbox = getTargetBoundingBox();
  const bboxString = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  
  // Usamos el sensor VIIRS_SNPP_NRT para detección en tiempo real, día 1
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bboxString}/1`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
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
      logger.info({ count: operations.length }, '[FIRMS Sync] Processed fire alerts.');
    }

    return operations.length;
  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[FIRMS Sync] Error fetching data');
    throw error;
  }
}
