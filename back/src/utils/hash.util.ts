/**
 * utils/hash.util.ts — Funciones de hashing
 *
 * PROPÓSITO:
 *   Provee funciones de hashing deterministico para deduplicación
 *   de personas (idHash) y protección de API keys (hashApiKey).
 *   Usa SHA-256 para consistencia y seguridad.
 *
 * CARACTERÍSTICAS:
 *   - generateIdHash(normalizedName, state, age): Hash determinístico
 *     para deduplicación. Misma persona = mismo hash.
 *   - hashApiKey(key): Hash SHA-256 de API key para almacenamiento seguro.
 *     Nunca se persisten API keys en texto plano.
 *
 * FLUJO DE DATOS (idHash):
 *   1. normalizeName + state + age → string base
 *   2. SHA-256 hash → hex string de 64 caracteres
 *   3. Se usa como identificador único en PersonModel
 *   4. Misma persona desde diferente fuente = mismo idHash = upsert automático
 *
 * FLUJO DE DATOS (API key):
 *   1. API key generada en createApiKey
 *   2. hashApiKey(key) → hash SHA-256
 *   3. Solo el hash se persiste en ApiKeyModel
 *   4. En autenticación, se hashea la key recibida y se compara con BD
 *
 * SEGURIDAD:
 *   - SHA-256: Hash seguro, no reversible
 *   - idHash determinístico: No revela información personal (es hash, no cifrado)
 *   - API key nunca en texto plano en BD: Si hay leak de BD, keys no comprometidas
 *   - 'unknown' para age undefined: Previene colisiones falsas
 *
 * DECISIONES TÉCNICAS:
 *   - SHA-256 sobre bcrypt: Más rápido (miles de upserts/segundo)
 *   - Determinístico: Necesario para dedup (misma entrada = mismo hash)
 *   - lowercase + trim: Normalización antes de hash (previene diferencias por mayúsculas)
 *   - age como 'unknown': No excluir age del hash (cambiaría todos los IDs existentes)
 *
 * CÓMO USAR:
 *   const idHash = generateIdHash('juan perez', 'caracas', 30);
 *   const hashedKey = hashApiKey('sk-abc123...');
 *
 * @module hash.util
 */
import { createHash } from 'crypto';

export function generateIdHash(normalizedName: string, state: string, age?: number): string {
  const base = `${normalizedName.trim().toLowerCase()}|${state.trim().toLowerCase()}|${age || 'unknown'}`;
  return createHash('sha256').update(base).digest('hex');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
