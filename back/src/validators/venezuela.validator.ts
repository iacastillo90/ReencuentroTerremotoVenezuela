/**
 * validators/venezuela.validator.ts — Validación de formatos venezolanos
 *
 * PROPÓSITO:
 *   Utilidades de validación y limpieza específicas para formatos
 *   venezolanos (cédula de identidad, teléfono). Extraído y adaptado
 *   para ReencuentrosVE v3.0
 *
 * POLÍTICA DE PRIVACIDAD (TDD §Seguridad):
 *   - Los datos raw (cédula, teléfono) JAMÁS se persisten en MongoDB.
 *   - Solo se almacena el hash SHA-256 para verificación cruzada interna.
 *
 * FUNCIONES:
 *   - normalizeCedula: Normaliza cédula V/E + dígitos (V-12345678 → V12345678)
 *   - normalizePhoneVE: Normaliza teléfono a E.164 (+584141234567)
 *   - hashSensitiveData: SHA-256 de dato normalizado (nunca raw)
 *
 * @module venezuela.validator
 */
import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────
// 1. Cédula de Identidad Venezolana
//    Acepta: V-12345678 · E8765432 · 12.345.678 · v 12345678
// ─────────────────────────────────────────────────────────────
export function normalizeCedula(rawCedula: string | null | undefined): string | null {
  if (!rawCedula) return null;

  // Limpiar espacios, puntos y guiones
  const clean = rawCedula.replace(/[\s.-]/g, '').toUpperCase();

  // V o E seguido de 6 a 8 dígitos
  const cedulaRegex = /^[VE]?\d{6,8}$/;
  if (!cedulaRegex.test(clean)) return null;

  // Si solo enviaron números, asumir prefijo V
  return /^\d+$/.test(clean) ? `V${clean}` : clean;
}

// ─────────────────────────────────────────────────────────────
// 2. Número de Teléfono Venezolano
//    Acepta: 04141234567 · +584121234567 · 0416-123-4567 · 58 424 1234567
// ─────────────────────────────────────────────────────────────
export function normalizePhoneVE(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;

  // Conservar solo dígitos y signo +
  let clean = rawPhone.replace(/[^\d+]/g, '');

  if (clean.startsWith('0'))  clean = `+58${clean.substring(1)}`;
  if (clean.startsWith('58')) clean = `+${clean}`;

  // Operadoras móviles y fijos venezolanos válidos
  const phoneRegex = /^\+58(414|424|412|416|426|2\d{2})\d{7}$/;
  if (!phoneRegex.test(clean)) return null;

  return clean; // Formato E.164: +584141234567
}

// ─────────────────────────────────────────────────────────────
// 3. Hash SHA-256 de datos PII
//    Convierte cualquier string normalizado en un hash seguro
//    para comparación cruzada sin exponer el valor real.
// ─────────────────────────────────────────────────────────────
export function hashSensitiveData(normalizedData: string | null): string | null {
  if (!normalizedData) return null;
  return createHash('sha256').update(normalizedData).digest('hex');
}
