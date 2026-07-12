import { VenezuelaReportaAdapter } from '../adapters/venezuelareporta.adapter';
import { syncFromSource } from '../services/sync-source.service';
import { logger } from '../utils/logger.util';

const SOURCE_ID = 'venezuelareporta';
const SOURCE_URL = 'https://venezuelareporta.org/api/v1/personas?limit=100';
const adapter = new VenezuelaReportaAdapter();

export async function fetchVenezuelaReporta() {
  logger.info('Starting VenezuelaReporta sync');

  try {
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${SOURCE_URL}&offset=${offset}`;
      logger.info({ url }, 'Fetching VenezuelaReporta page');

      const response = await fetch(url, {
        headers: { 'User-Agent': 'ReencuentroVE/1.0 (Integración)' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const items = data.personas || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      const result = await syncFromSource(items, {
        source: SOURCE_ID,
        adapter,
      });

      totalProcessed += result.processed;
      offset += items.length;

      await new Promise(r => setTimeout(r, 500));
    }

    logger.info({ total: totalProcessed }, 'VenezuelaReporta sync completed');
    return totalProcessed;
  } catch (error: any) {
    logger.error({ err: error }, 'VenezuelaReporta sync critical error');
    throw error;
  }
}
