/**
 * models/unified-person.model.ts — Modelo principal de personas
 *
 * PROPÓSITO:
 *   Define el schema unificado para todas las personas reportadas,
 *   independientemente de la fuente (web, WhatsApp, Telegram, scraping).
 *   Centraliza deduplicación vía idHash y soporta múltiples fuentes.
 *
 * CARACTERÍSTICAS:
 *   - externalIds: Múltiples IDs de fuentes externas para un misma persona
 *   - idHash: Hash determinístico (nombre + estado + edad) para dedup
 *   - lastSeen: GeoJSON coordinates para búsquedas geoespaciales
 *   - metadata: Auditoría completa (sync, source, confidence, auditStatus)
 *   - embedding/faceEncoding: Vectores para matching IA (select: false)
 *   - data: Schema.Types.Mixed para datos flexibles (validar con Zod antes)
 *
 * ÍNDICES (performance crítico):
 *   - { normalizedName: 1, lastSeen.state: 1 } — queries por nombre+estado
 *   - { status: 1, metadata.urgencyScore: -1 } — listados por urgencia
 *   - { lastSeen.coordinates: '2dsphere' } — búsquedas geoespaciales
 *   - { externalIds.source: 1, externalIds.id: 1 } — lookup por fuente
 *   - { name: 'text', ... } — full-text search
 *   - { metadata.reportedBy: 1 } — reports por usuario
 *   - { metadata.auditStatus: 1, status: 1, type: 1 } — moderación
 *
 * SEGURIDAD:
 *   - embedding/faceEncoding: { select: false } — nunca expuesto por defecto
 *   - data: Mixed type — debe validarse con personPayloadSchema antes de persistir
 *   - PII en metadata (IP, location) — excluir en proyecciones públicas
 *
 * DECISIONES TÉCNICAS:
 *   - idHash en lugar de _id: permite dedup antes de persistir
 *   - externalIds como array: soporta N fuentes para un mismo registro
 *   - metadata separado de data: metadata es estructurado, data es flexible
 *   - auditStatus para moderación: clean, pending_review, merged, dismissed
 *
 * CÓMO USAR:
 *   const person = await PersonModel.findOne({ idHash: 'abc123' });
 *   const persons = await PersonModel.find({ status: 'missing' }).select('-embedding -faceEncoding');
 */
import { Schema, model, Document, Types } from 'mongoose';

export interface UnifiedPerson extends Document {
  externalIds: Array<{
    source: 'venezuela-te-busca' | 'whatsapp' | 'web-form' | 'telegram' | 'manual' | string;
    id: string;
    addedAt: Date;
  }>;
  type: 'person' | 'animal';
  name: string;
  normalizedName: string;
  idHash: string;
  aliases: string[];
  status: 'missing' | 'found' | 'deceased' | 'unknown';
  lastSeen: {
    description: string;
    state: string;
    municipality?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
    date: Date;
  };
  age?: number;
  gender?: 'M' | 'F' | 'other' | 'unknown';
  description?: string;
  photoUrl?: string;
  contactPerson?: {
    name: string;
    phone?: string;
    relationship: string;
  };
  possiblyRelatedDisasters?: Types.ObjectId[];
  // WARNING: Schema.Types.Mixed below — must be validated with Zod before reaching the model.
  // See personPayloadSchema in validators/person.validator.ts for the expected shape.
  data?: {
    cedula_hash?: string;
    [key: string]: any;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastSync: Date;
    source: string;
    urgencyScore: number;
    confidenceScore?: number;
    confidenceLabel?: string;
    aiProcessed: boolean;
    isMinor?: boolean;
    auditStatus: 'clean' | 'pending_review' | 'merged' | 'dismissed' | 'pending_moderation';
    reportedBy?: Types.ObjectId | string;
    reporterIp?: string;
    reporterLocation?: { lat: number; lng: number };
    biometricHash?: string;
  };
  embedding?: number[];
  faceEncoding?: number[];
}

const UnifiedPersonSchema = new Schema<UnifiedPerson>({
  externalIds: [{ source: String, id: String, addedAt: Date }],
  type: { type: String, enum: ['person', 'animal'], required: true },
  name: { type: String, required: true },
  normalizedName: { type: String, required: true },
  idHash: { type: String, required: true, unique: true },
  aliases: [String],
  status: { type: String, enum: ['missing', 'found', 'deceased', 'unknown'], default: 'missing' },
  lastSeen: {
    description: String,
    state: String,
    municipality: String,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    date: Date,
  },
  age: Number,
  gender: { type: String, enum: ['M', 'F', 'other', 'unknown'] },
  description: String,
  photoUrl: String,
  contactPerson: {
    name: String,
    phone: String,
    relationship: String,
  },
  possiblyRelatedDisasters: [{ type: Schema.Types.ObjectId, ref: 'DisasterEvent' }],
  // WARNING: Must be validated with Zod before saving — see personPayloadSchema.
  data: { type: Schema.Types.Mixed },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastSync: { type: Date, default: Date.now },
    source: String,
    urgencyScore: { type: Number, default: 0 },
    confidenceScore: Number,
    confidenceLabel: String,
    aiProcessed: { type: Boolean, default: false },
    isMinor: { type: Boolean, default: false },
    auditStatus: { type: String, enum: ['clean', 'pending_review', 'merged', 'dismissed', 'pending_moderation'], default: 'clean' },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reporterIp: String,
    reporterLocation: {
      lat: Number,
      lng: Number
    },
    biometricHash: String
  },
  embedding: { type: [Number], select: false }, // Vector embedding textual (IA)
  faceEncoding: { type: [Number], select: false }, // Vector facial 128-d (face_recognition)
});

UnifiedPersonSchema.index({ normalizedName: 1, 'lastSeen.state': 1 });
UnifiedPersonSchema.index({ status: 1, 'metadata.urgencyScore': -1 });
UnifiedPersonSchema.index({ 'lastSeen.coordinates': '2dsphere' });
UnifiedPersonSchema.index({ 'externalIds.source': 1, 'externalIds.id': 1 });
UnifiedPersonSchema.index({ name: 'text', normalizedName: 'text', 'lastSeen.description': 'text' }, { weights: { name: 10, normalizedName: 5, 'lastSeen.description': 1 } });
UnifiedPersonSchema.index({ 'metadata.reportedBy': 1 });
UnifiedPersonSchema.index({ 'metadata.auditStatus': 1, status: 1, type: 1 });

export const PersonModel = model<UnifiedPerson>('UnifiedPerson', UnifiedPersonSchema);
