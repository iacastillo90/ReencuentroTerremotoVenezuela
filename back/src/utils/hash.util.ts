import { createHash } from 'crypto';

export function generateIdHash(normalizedName: string, state: string, age?: number): string {
  const base = `${normalizedName.trim().toLowerCase()}|${state.trim().toLowerCase()}|${age || 'unknown'}`;
  return createHash('sha256').update(base).digest('hex');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
