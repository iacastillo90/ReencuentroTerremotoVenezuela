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
 * Escape regex special characters to prevent regex injection.
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
