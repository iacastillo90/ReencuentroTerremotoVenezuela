/**
 * models/api-key.model.ts — API keys para autenticación de servicios
 *
 * PROPÓSITO:
 *   Almacena API keys utilizadas para autenticación machine-to-machine
 *   (partners, webhooks, administradores). La key completa se almacena
 *   como hash SHA-256 (nunca en texto plano). Solo el keyPrefix (8 chars)
 *   es visible para identificación en logs.
 *
 * CARACTERÍSTICAS:
 *   - key: Hash SHA-256 de la API key (unique)
 *   - keyPrefix: Primeros 8 chars para identificación visual
 *   - name: Nombre descriptivo (ej. "Protección Civil")
 *   - type: admin | webhook | partner
 *   - active: Flag de activación (revocación lógica)
 *   - lastUsedAt: Timestamp de último uso
 *   - expiresAt: Fecha de expiración opcional
 *   - permissions: Lista de permisos granular (futuro)
 *
 * ÍNDICES:
 *   - key: unique (búsqueda por hash)
 *   - keyPrefix: index (identificación)
 *   - type: index (filtro por tipo)
 *   - active: index (filtro de keys activas)
 *
 * @module api-key.model
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface ApiKeyDocument extends Document {
  key: string;
  keyPrefix: string;
  name: string;
  type: 'admin' | 'webhook' | 'partner';
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  permissions?: string[];
}

const apiKeySchema = new Schema<ApiKeyDocument>({
  key: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['admin', 'webhook', 'partner'], required: true, index: true },
  active: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
  expiresAt: { type: Date },
  permissions: [{ type: String }],
});

export const ApiKeyModel = mongoose.model<ApiKeyDocument>('ApiKey', apiKeySchema);
