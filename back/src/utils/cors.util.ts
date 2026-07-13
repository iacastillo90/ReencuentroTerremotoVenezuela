/**
 * utils/cors.util.ts — Utilitario CORS (allowlist exacta)
 *
 * PROPÓSITO:
 *   Configuración de CORS con allowlist exacta para prevenir
 *   ataques de origin reflection. NO usa comodines ni coincidencia
 *   por sufijo. El esquema (http vs https) debe coincidir exactamente.
 *
 * CARACTERÍSTICAS:
 *   - normalizeOrigin: Limpia origin (trim, lowercase, sin trailing slash)
 *   - buildAllowedOrigins: Construye Set desde CSV de ENV
 *   - isOriginAllowed: Coincidencia exacta (no substring/suffix)
 *
 * SEGURIDAD:
 *   - NO coincidencia por sufijo: https://evil.com?localhost:5173 NO pasa
 *   - NO equivalencia http/https: Debe listarse explícitamente
 *   - Entradas vacías descartadas: Comas extra en CORS_ORIGINS no rompen
 *
 * @module cors.util
 */
export function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Construye la allowlist normalizada una sola vez (al arranque).
 * Descarta entradas vacías (p. ej. comas colgantes en CORS_ORIGINS).
 */
export function buildAllowedOrigins(csv: string): Set<string> {
  return new Set(
    csv
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
  );
}

/**
 * Coincidencia EXACTA del origin normalizado contra la allowlist.
 * Se evita cualquier coincidencia por substring/sufijo (p. ej.
 * https://localhost:5173.evil.com) y cualquier equivalencia de esquema.
 */
export function isOriginAllowed(origin: string, allowed: Set<string>): boolean {
  return allowed.has(normalizeOrigin(origin));
}
