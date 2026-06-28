import { distance } from 'fastest-levenshtein';

/**
 * Calculates the similarity score between two strings using Levenshtein distance.
 * Returns a score between 0 and 1, where 1 is an exact match.
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();

  if (cleanA === cleanB) return 1;

  const maxLen = Math.max(cleanA.length, cleanB.length);
  if (maxLen === 0) return 1;

  return (maxLen - distance(cleanA, cleanB)) / maxLen;
}
