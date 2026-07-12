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
