/**
 * jobs/reencuentro.job — Sincronización con API de Reencuentro
 *
 * PROPÓSITO:
 *   Consulta la API pública de Reencuentro/ApoyaVe para obtener
 *   reportes de personas y los sincroniza con la base de datos
 *   mediante el adaptador y el servicio syncFromSource.
 *
 * CARACTERÍSTICAS:
 *   - Paginación de la API externa
 *   - Fallback a datos mock para desarrollo (ALLOW_MOCK_DATA)
 *   - Usa syncFromSource para deduplicación por idHash
 *
 * @module reencuentro.job
 */

import { PersonModel } from '../models/unified-person.model';
import crypto from 'crypto';
import { ReencuentroAdapter } from '../adapters/reencuentro.adapter';
import { syncFromSource } from '../services/sync-source.service';
import { logger } from '../utils/logger.util';

const SOURCE_ID = 'reencuentro-api';
const SOURCE_URL = 'https://ayudahumanitariavenezuela.com/api/persons';
const adapter = new ReencuentroAdapter();

export async function fetchReencuentroPersons() {
  logger.info({ url: SOURCE_URL }, 'Starting Reencuentro sync');

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'ReencuentroVE/1.0 (Integración)' },
      signal: AbortSignal.timeout(10000),
    });

    let items: any[] = [];
    let usingMock = false;

    if (response.ok) {
      const data = await response.json();
      items = Array.isArray(data) ? data : data.items || [];
    } else if (process.env.ALLOW_MOCK_DATA === 'true') {
      if (process.env.NODE_ENV === 'production') {
        logger.error('ALLOW_MOCK_DATA=true in production — aborting');
        return 0;
      }
      logger.warn({ status: response.status }, 'API returned error — using mock data');
      items = generateMockReencuentroData();
      usingMock = true;
    } else {
      logger.warn({ status: response.status }, 'API returned error — mock disabled, no records inserted');
      return 0;
    }

    const result = await syncFromSource(items, {
      source: SOURCE_ID,
      adapter,
      usingMock,
    });

    logger.info({ processed: result.processed }, 'Reencuentro sync completed');
    return result.processed;
  } catch (error: any) {
    logger.error({ err: error }, 'Reencuentro sync critical error');
    throw error;
  }
}

function generateMockReencuentroData() {
  const names = ['Carlos', 'Luis', 'Jose', 'Maria', 'Ana', 'Carmen', 'Jorge', 'Miguel', 'Sofia', 'Valentina'];
  const lastNames = ['Rodriguez', 'Perez', 'Gonzalez', 'Gomez', 'Lopez', 'Diaz', 'Martinez', 'Hernandez'];
  const states = ['Vargas', 'Distrito Capital', 'Miranda', 'Aragua', 'Carabobo'];

  const mockData = [];
  for (let i = 1; i <= 250; i++) {
    mockData.push({
      id: `ext-reencuentro-${i}`,
      nombre: `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      status: Math.random() > 0.85 ? 'found' : 'missing',
      edad: Math.floor(Math.random() * 60) + 5,
      estado: states[Math.floor(Math.random() * states.length)],
      descripcion: 'Reporte ingresado desde la central de ApoyaVe/Reencuentro.',
      foto: `https://i.pravatar.cc/150?u=reencuentro-${i}`,
    });
  }
  return mockData;
}
