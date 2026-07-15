/**
 * utils/regex-escape.util.ts — Escape de regex + ReDoS prevention
 *
 * PROPÓSITO:
 *   Previene ReDoS (Regular expression Denial of Service) escapando
 *   caracteres especiales de regex en inputs de usuario y limitando
 *   la longitud máxima del string.
 *
 * CARACTERÍSTICAS:
 *   - escapeRegex: Escapa metacaracteres .^$*+?{}[]\\|()
 *   - safeRegexQuery: Trim + límite 200 chars + escape
 *
 * USO:
 *   const safe = safeRegexQuery(userInput); // "John Doe"
 *   const regex = new RegExp(safe, 'i');
 *
 * @module regex-escape.util
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.^$*+?{}[\]\\|()]/g, '\\$&');
}

/**
 * Safe regex query — trim, limit to 200 chars, escape metacharacters.
 * Returns empty string if input is too long or empty.
 */
export function safeRegexQuery(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.length > 200) return '';
  return escapeRegex(trimmed);
}
