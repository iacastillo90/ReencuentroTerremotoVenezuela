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
