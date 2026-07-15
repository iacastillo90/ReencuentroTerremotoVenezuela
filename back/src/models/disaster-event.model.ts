/**
 * models/disaster-event.model.ts — Modelo de eventos de desastre
 *
 * PROPÓSITO:
 *   Define el schema para eventos sísmicos, meteorológicos y sociales
 *   que afectan a Venezuela. Incluye coordenadas GeoJSON para búsquedas
 *   espaciales y cruce con reportes de personas desaparecidas.
 *
 * CARACTERÍSTICAS:
 *   - type: 6 categorías (earthquake, flood, fire, hurricane, landslide, social)
 *   - severity: 4 niveles (low, medium, high, critical)
 *   - coordinates: GeoJSON Point [longitude, latitude] para queries 2dsphere
 *   - radius_km: Radio de afectación en kilómetros
 *   - validUntil: Fecha de expiración del evento (después ya no está activo)
 *   - externalId: ID único de la fuente (USGS, INAMEH, etc.) con unique index
 *   - metadata: Datos específicos del tipo (magnitud, profundidad, viento, lluvia)
 *
 * ÍNDICES CRÍTICOS:
 *   - { coordinates: '2dsphere' }: Búsquedas geoespaciales (cruce con personas)
 *   - { type: 1, severity: 1, occurredAt: -1 }: Listados por tipo + severidad + fecha
 *   - { validUntil: 1 }: Query de eventos activos (validUntil > now)
 *   - externalId: unique (previene duplicados de la misma fuente)
 *
 * FLUJO DE DATOS:
 *   1. Scrapers (GDACS, USGS, INAMEH) crean/actualizan eventos
 *   2. Geo-enrich busca eventos cercanos a personas reportadas
 *   3. Query por tipo/fecha/lugar devuelve eventos relevantes
 *   4. Active disasters: validUntil > now OR occurredAt reciente
 *
 * SEGURIDAD:
 *   - rawData: Mixed type — validar con Zod antes de persistir
 *   - externalId único: Previene duplicados, upsertable
 *   - Datos de APIs públicas: Sin PII, contenido público
 *
 * FUENTES DE DATOS:
 *   - GDACS (desastres globales)
 *   - USGS (terremotos)
 *   - INAMEH (clima Venezuela)
 *   - FUNVISIS (sismos Venezuela)
 *   - Protección Civil Venezuela
 *
 * CÓMO USAR:
 *   const event = await DisasterEventModel.findOne({ externalId: 'usgs-123' });
 *   const active = await DisasterEventModel.find({ validUntil: { $gt: new Date() } });
 *   const nearby = await DisasterEventModel.find({ coordinates: { $near: { $geometry: { type: 'Point', coordinates: [-66.9, 10.5] }, $maxDistance: 30000 }}});
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IDisasterEvent extends Document {
  type: 'earthquake' | 'flood' | 'fire' | 'hurricane' | 'landslide' | 'social';
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  radius_km?: number;
  title: string;
  description: string;
  source: string;
  externalId: string;
  occurredAt: Date;
  validUntil?: Date;
  affectedAreas: string[];
  metadata: {
    magnitude?: number;
    depth_km?: number;
    windSpeed_kmh?: number;
    rainfallMm?: number;
    // WARNING: Schema.Types.Mixed below — must be validated with Zod before persisting.
    rawData: any;
  };
}

const disasterEventSchema = new Schema<IDisasterEvent>({
  type: {
    type: String,
    enum: ['earthquake', 'flood', 'fire', 'hurricane', 'landslide', 'social'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  radius_km: { type: Number },
  title: { type: String, required: true },
  description: { type: String, required: true },
  source: { type: String, required: true },
  externalId: { type: String, required: true, unique: true },
  occurredAt: { type: Date, required: true },
  validUntil: { type: Date },
  affectedAreas: [{ type: String }],
  metadata: {
    magnitude: { type: Number },
    depth_km: { type: Number },
    windSpeed_kmh: { type: Number },
    rainfallMm: { type: Number },
    // WARNING: Must be validated with Zod before persisting — raw external API data.
    rawData: { type: Schema.Types.Mixed, default: {} }
  }
}, { timestamps: true });

// CRÍTICO: Índice geoespacial para cruces eficientes (Fuzzy y Radio)
disasterEventSchema.index({ coordinates: '2dsphere' });
disasterEventSchema.index({ type: 1, severity: 1, occurredAt: -1 });
disasterEventSchema.index({ validUntil: 1 });

export const DisasterEventModel = mongoose.model<IDisasterEvent>('DisasterEvent', disasterEventSchema);
