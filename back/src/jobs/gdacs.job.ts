import Parser from 'rss-parser';
import { z } from 'zod';
import { DisasterEventModel } from '../models/disaster-event.model';
import { getTargetBoundingBox, isPointInsideBBox } from '../utils/geo.util';
import { logger } from '../utils/logger.util';

const rawDataSchema = z.record(z.string(), z.unknown());

const parser = new Parser({
  customFields: {
    item: [
      ['geo:Point', 'geoPoint'],
      ['gdacs:severity', 'gdacsSeverity'],
      ['gdacs:eventtype', 'gdacsEventType'],
      ['gdacs:eventname', 'gdacsEventName'],
    ]
  }
});

export async function fetchGDACS() {
  const url = 'https://www.gdacs.org/xml/rss.xml';
  const bbox = getTargetBoundingBox();

  try {
    const feed = await parser.parseURL(url);
    const operations: any[] = [];

    for (const item of feed.items) {
      // Validar si tiene coordenadas
      if (!item.geoPoint) continue;
      
      const parts = item.geoPoint.split(' ');
      if (parts.length !== 2) continue;
      
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);

      // GDACS es global, filtramos manualmente usando nuestra bounding box
      if (!isPointInsideBBox(lon, lat, bbox)) {
        continue;
      }

      // Mapear GDACS severity a nuestro enum
      const rawSeverity = (item as any).gdacsSeverity;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (rawSeverity === 'Orange') severity = 'high';
      else if (rawSeverity === 'Red') severity = 'critical';
      else if (rawSeverity === 'Green') severity = 'medium'; // Green is still an event

      // Mapear el tipo de evento
      const rawType = (item as any).gdacsEventType;
      let type = 'social';
      if (rawType === 'EQ') type = 'earthquake';
      else if (rawType === 'FL') type = 'flood';
      else if (rawType === 'TC') type = 'hurricane'; // Tropical Cyclone
      else if (rawType === 'VO') type = 'fire'; // Volcano mapped to fire broadly or other
      else if (rawType === 'DR') type = 'flood'; // Drought
      
      const externalId = `gdacs-${item.guid || item.link}`;

      operations.push({
        updateOne: {
          filter: { externalId },
          update: {
            $set: {
              type,
              severity,
              coordinates: {
                type: 'Point',
                coordinates: [lon, lat]
              },
              radius_km: 50, // GDACS warnings son grandes, ~50km
              title: (item as any).gdacsEventName || item.title || 'Alerta GDACS',
              description: item.contentSnippet || (item as any).description || '',
              source: 'gdacs',
              occurredAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              metadata: {
                rawData: rawDataSchema.parse(item)
              }
            }
          },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      await DisasterEventModel.bulkWrite(operations as any[]);
      logger.info({ count: operations.length }, '[GDACS Sync] Processed global alerts.');
    } else {
       logger.info('[GDACS Sync] No active alerts for target region.');
    }

    return operations.length;
  } catch (error: any) {
    logger.error({ err: (error as Error).message }, '[GDACS Sync] Error fetching data');
    throw error;
  }
}
