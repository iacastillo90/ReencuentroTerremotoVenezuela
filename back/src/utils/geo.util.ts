/**
 * utils/geo.util.ts — Bounding box geográfico
 *
 * PROPÓSITO:
 *   Define el bounding box del país objetivo (Venezuela por defecto)
 *   y provee validación de puntos geográficos. Se usa para filtrar
 *   coordenadas inválidas o fuera del área de interés.
 *
 * CARACTERÍSTICAS:
 *   - getTargetBoundingBox: Retorna bbox desde ENV o default Venezuela
 *   - isPointInsideBBox: Verifica si coordenadas están dentro del bbox
 *   - Fallback a Venezuela si ENV inválido: -73.4,0.6,-59.8,12.2
 *
 * @module geo.util
 */
import { logger } from './logger.util';

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

// Default a Venezuela si no hay variable de entorno
const DEFAULT_BBOX_STR = '-73.4,0.6,-59.8,12.2'; // minLon,minLat,maxLon,maxLat

export function getTargetBoundingBox(): BoundingBox {
  const bboxStr = process.env.TARGET_COUNTRY_BBOX || DEFAULT_BBOX_STR;
  const parts = bboxStr.split(',').map(p => parseFloat(p.trim()));
  
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    return {
      minLon: parts[0],
      minLat: parts[1],
      maxLon: parts[2],
      maxLat: parts[3]
    };
  }
  
  logger.warn('[GeoUtil] Invalid TARGET_COUNTRY_BBOX, falling back to Venezuela.');
  return { minLon: -73.4, minLat: 0.6, maxLon: -59.8, maxLat: 12.2 };
}

export function isPointInsideBBox(lon: number, lat: number, bbox: BoundingBox): boolean {
  return lon >= bbox.minLon && lon <= bbox.maxLon &&
         lat >= bbox.minLat && lat <= bbox.maxLat;
}
