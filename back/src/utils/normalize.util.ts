/**
 * utils/normalize.util.ts — Normalización + Censura PII
 *
 * PROPÓSITO:
 *   Convierte registros raw de cualquier adaptador al formato normalizado
 *   unificado. Actúa como Censor PII: elimina datos sensibles (cédula,
 *   teléfono, dirección) antes de persistir, reemplazándolos con hashes.
 *
 * CARACTERÍSTICAS:
 *   - normalize: Transforma RawRecord → NormalizedRecord
 *   - Censura cédula: hashSensitiveData (SHA-256)
 *   - Censura teléfono: normalizePhoneVE + hashSensitiveData
 *   - Purga campos sensibles: diagnóstico, historia_clínica, dirección exacta
 *   - Checksum MD5: Para idempotencia por origen (sync state)
 *
 * CAMPOS PURGADOS:
 *   cedula → cedula_hash (hash)
 *   telefono_privado → contact_hash (E.164 + hash)
 *   diagnostico, historia_clinica, telefono, direccion_exacta → eliminados
 *
 * @module normalize.util
 */
import crypto from 'crypto';
import { normalizeCedula, normalizePhoneVE, hashSensitiveData } from '../validators/venezuela.validator';

interface RawRecord {
  source: string;
  externalId?: string;
  type?: string;
  name?: string;
  estado?: string;
  municipio?: string;
  mediaUrl?: string;
  mediaType?: string;
  cedula?: string;
  diagnostico?: string;
  historia_clinica?: string;
  telefono?: string;
  telefono_privado?: string;
  direccion_exacta?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface NormalizedRecord {
  source: string;
  externalId: string | null;
  type: 'person' | 'animal';
  name: string | null;
  estado: string | null;
  municipio: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  data: Record<string, any>;
  checksum: string;
}

/**
 * Convierte un objeto raw desde cualquier adaptador al formato normalizado unificado.
 * Actúa como Censor PII para eliminar datos sensibles antes de persistir.
 */
export function normalize(raw: RawRecord): NormalizedRecord {
  const normalized: NormalizedRecord = {
    source: raw.source,
    externalId: raw.externalId || null,
    type: raw.type === 'animal' ? 'animal' : 'person',
    name: raw.name ? String(raw.name).toUpperCase() : null,
    estado: raw.estado || null,
    municipio: raw.municipio || null,
    mediaUrl: raw.mediaUrl || null,
    mediaType: raw.mediaType || null,
    data: raw.data ? { ...raw.data } : {},
    checksum: ''
  };

  // ── Cédula: validar formato venezolano y hashear (jamás persiste el valor raw) ──
  const rawCedula = raw.cedula || normalized.data.cedula;
  const cleanCedula = normalizeCedula(rawCedula);
  normalized.data.cedula_hash = hashSensitiveData(cleanCedula);
  delete normalized.data.cedula;
  delete raw.cedula;

  // ── Teléfono privado: normalizar a E.164 y hashear ──
  const rawPhone = (raw as any).telefono_privado || normalized.data.telefono_privado;
  const cleanPhone = normalizePhoneVE(rawPhone);
  normalized.data.contact_hash = hashSensitiveData(cleanPhone);

  // ── Purgar todos los campos PII sensibles antes de persistir ──
  const sensitiveKeys = [
    'diagnostico', 'historia_clinica',
    'telefono', 'telefono_privado', 'direccion_exacta',
    'cedula'
  ];
  sensitiveKeys.forEach(key => {
    delete (raw as any)[key];
    delete normalized.data[key];
  });

  // Checksum MD5 para idempotencia por origen (sync_state)
  normalized.checksum = crypto
    .createHash('md5')
    .update(JSON.stringify({
      name: normalized.name,
      estado: normalized.estado,
      mediaUrl: normalized.mediaUrl,
      data: normalized.data
    }))
    .digest('hex');

  return normalized;
}
