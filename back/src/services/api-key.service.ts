/**
 * services/api-key.service.ts — Gestión de API keys
 *
 * PROPÓSITO:
 *   Servicio para crear, validar, listar y revocar API keys utilizadas
 *   por partners, webhooks y administradores. Las keys se almacenan
 *   como hash SHA-256 (nunca en texto plano) con soporte de migración
 *   para keys legacy sin hash.
 *
 * CARACTERÍSTICAS:
 *   - createApiKey: Genera key con prefijo rtv_ + prefijo visible de 8 chars
 *   - validateApiKey: Verifica key contra hash + tipo + vigencia
 *   - listApiKeys: Lista keys sin el campo key (solo metadata)
 *   - revokeApiKey: Desactiva key (active: false)
 *   - Fallback legacy: Verifica también keys en texto plano
 *   - lastUsedAt: Actualiza timestamp de último uso
 *
 * FLUJO DE VALIDACIÓN:
 *   1. Cliente presenta API key en header (x-api-key, x-webhook-api-key, etc.)
 *   2. hashApiKey(key) → hash SHA-256
 *   3. Busca en ApiKeyModel por key hash + type + active + !expired
 *   4. Si no encuentra: Fallback a búsqueda con key en texto plano (legacy)
 *   5. Si legacy: Log warning + permite (migración gradual)
 *   6. Si válida: update lastUsedAt + return true
 *   7. Si inválida: return false
 *
 * SEGURIDAD:
 *   - Hash SHA-256: Si hay leak de BD, keys no comprometidas
 *   - keyPrefix de 8 chars: Identificación sin exponer key completa
 *   - expiresAt check: Keys con expiración se rechazan automáticamente
 *   - active flag: Revocación inmediata sin cambiar hash
 *   - keyPrefix visible: Útil para logs sin exponer key completa
 *   - Legacy fallback con warning: Migración segura sin downtime
 *
 * FORMATO DE KEY:
 *   rtv_<64 hex chars> → prefijo rtv_ + 8 chars visibles (keyPrefix)
 *   Ejemplo: rtv_a1b2c3d4...
 *
 * @module api-key.service
 */
import crypto from 'crypto';
import { ApiKeyModel, ApiKeyDocument } from '../models/api-key.model';
import { logger } from '../utils/logger.util';
import { hashApiKey } from '../utils/hash.util';

const KEY_PREFIX_LENGTH = 8;

function generateApiKey(): { key: string; keyPrefix: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const keyPrefix = raw.slice(0, KEY_PREFIX_LENGTH);
  return { key: `rtv_${raw}`, keyPrefix };
}

export async function createApiKey(
  name: string,
  type: 'admin' | 'webhook' | 'partner',
  expiresAt?: Date
): Promise<{ key: string; keyPrefix: string; id: string }> {
  const { key, keyPrefix } = generateApiKey();
  const keyHash = hashApiKey(key);
  const doc = await ApiKeyModel.create({ key: keyHash, keyPrefix, name, type, expiresAt });
  return { key, keyPrefix, id: doc._id.toString() };
}

export async function validateApiKey(
  rawKey: string,
  type: 'admin' | 'webhook' | 'partner'
): Promise<boolean> {
  const hashedKey = hashApiKey(rawKey);
  let doc = await ApiKeyModel.findOne({
    key: hashedKey,
    type,
    active: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  // Fallback: check raw key for legacy unhashed keys
  if (!doc) {
    doc = await ApiKeyModel.findOne({
      key: rawKey,
      type,
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });
    if (doc) {
      logger.warn({ keyPrefix: doc.keyPrefix }, '[ApiKey] Legacy unhashed key used — migrate by recreating the key');
    }
  }

  if (!doc) return false;

  await ApiKeyModel.updateOne({ _id: doc._id }, { lastUsedAt: new Date() });
  return true;
}

export async function listApiKeys(type?: string): Promise<ApiKeyDocument[]> {
  const filter: any = {};
  if (type) filter.type = type;
  return ApiKeyModel.find(filter).select('-key').sort({ createdAt: -1 });
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await ApiKeyModel.findByIdAndUpdate(id, { active: false });
  return result !== null;
}

