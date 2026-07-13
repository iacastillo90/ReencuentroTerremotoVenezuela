/**
 * utils/sanitize.util.ts — Sanitización de entrada (XSS Prevention)
 *
 * PROPÓSITO:
 *   Provee funciones y schemas Zod para sanitizar inputs de usuario
 *   y prevenir ataques XSS y NoSQL injection. Toda entrada de texto
 *   del usuario debe pasar por sanitize() o sanitizedString antes
 *   de llegar a BD o ser renderizada.
 *
 * CARACTERÍSTICAS:
 *   - sanitize(): Stripea todas las etiquetas HTML (sanitize-html)
 *   - sanitizeWithOptions(): Versión configurable con opciones custom
 *   - sanitizedString: Zod schema que trim + sanitize + valida longitud
 *   - sanitizedStringOptional: Versión opcional para campos no requeridos
 *   - sanitizedQueryParam: Para query params (con max 200 chars)
 *   - safeIdString: Para IDs/hashes (solo trim + maxLength, sin HTML sanitize)
 *   - redactPhoneNumbers: Reemplaza números telefónicos en strings
 *
 * FLUJO DE SANITIZACIÓN:
 *   1. Zod schema recibe input del usuario
 *   2. .trim() elimina espacios leading/trailing
 *   3. .transform(sanitize) pasa por sanitize-html (elimina <script>, etc)
 *   4. .pipe(z.string().max(N)) valida longitud final
 *   5. Controller recibe string limpio y seguro
 *
 * SEGURIDAD:
 *   - sanitizeHtml con allowedTags=[]: Elimina TODO el HTML (no solo scripts)
 *   - Truncamiento a 10000 chars: Previene ReDoS con inputs gigantes
 *   - safeIdString no sanitiza HTML: Para hashes/IDs que pueden contener +
 *   - redactPhoneNumbers: Para logging (nunca exponer números en logs)
 *   - No trust user input: Sanitización en capas (Zod + transform)
 *
 * DECISIONES TÉCNICAS:
 *   - 10000 char limit: Balance entre seguridad y utilidad
 *   - sanitize-html sobre regex: Maneja HTML malformado, no solo <script>
 *   - Zod pipe vs transform directo: Composable, reutilizable
 *   - safeIdString separado: No dañar hashes/IDs con sanitize-html
 *   - Re-export desde regex-escape.util: Evita duplicación (un punto de entrada)
 *
 * CÓMO USAR:
 *   const safeName = sanitize(req.body.name);
 *   const schema = z.object({ name: sanitizedString });
 *   const safeQuery = z.object({ q: sanitizedQueryParam });
 *   log.info({ phone: redactPhoneNumbers(user.phone) }, 'User registered');
 */
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

/**
 * Strip all HTML tags.
 */
export function sanitize(str: string): string {
  if (!str) return '';
  const truncated = str.length > 10000 ? str.slice(0, 10000) : str;
  return sanitizeHtml(truncated, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

/**
 * Sanitize with custom options.
 */
export function sanitizeWithOptions(str: string, options?: Partial<sanitizeHtml.IOptions>): string {
  if (!str) return '';
  const truncated = str.length > 10000 ? str.slice(0, 10000) : str;
  return sanitizeHtml(truncated, {
    allowedTags: [],
    allowedAttributes: {},
    ...options,
  });
}

/**
 * Base Zod pipe — trim then sanitize via transform.
 * Output type: string (sanitized)
 */
export const sanitizedBase = z.string()
  .trim()
  .transform((v) => sanitize(v));

/**
 * Zod schema — sanitized required string.
 * Strips HTML, trims, requires min 1 char, max 5000 output.
 */
export const sanitizedString = sanitizedBase.pipe(z.string().min(1).max(5000));

/**
 * Zod schema — sanitized optional string.
 * Strips HTML, trims, allows undefined/omitted.
 * Note: additional constraints (max length) must use .pipe() in the caller.
 */
export const sanitizedStringOptional = z.string()
  .trim()
  .transform((v) => sanitize(v))
  .optional();

/**
 * Safe string for IDs, hashes, and tokens that should NOT be HTML-sanitized
 * but must still be validated. Trims and limits length only.
 */
export const safeIdString = z.string().trim().max(256);

/**
 * Pre-sanitized query parameter string.
 */
export const sanitizedQueryParam = z.string()
  .trim()
  .transform((v) => sanitize(v))
  .pipe(z.string().max(200));

export { escapeRegex, safeRegexQuery } from './regex-escape.util';

const PHONE_REGEX = /\+?\d{7,15}/g;

/**
 * Redact phone numbers from a string — replaces with [TELÉFONO REDACTADO].
 */
export function redactPhoneNumbers(str: string): string {
  if (!str) return '';
  return str.replace(PHONE_REGEX, '[TELÉFONO REDACTADO]');
}
