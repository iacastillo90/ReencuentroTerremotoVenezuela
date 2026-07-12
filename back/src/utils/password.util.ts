import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
 * Formato almacenado: "<salt-hex>:<hash-hex>".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hashBuf = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${hashBuf.toString('hex')}`;
}

/** Verifica una contraseña contra el hash almacenado (comparación en tiempo constante). */
export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const testBuf = await scryptAsync(password, salt, 64) as Buffer;
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}
