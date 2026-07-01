/**
 * Normaliza un origin/entrada de allowlist para comparación: recorta espacios,
 * pasa a minúsculas y elimina barras finales. NO elimina el esquema: el esquema
 * forma parte del origin web y tratarlo como equivalente (http ≡ https) abriría
 * un downgrade con credenciales. Si un despliegue necesita ambos esquemas,
 * deben listarse explícitamente en CORS_ORIGINS.
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
