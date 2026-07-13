/**
 * config/redis.config.ts — Conexión a Redis
 *
 * PROPÓSITO:
 *   Configura y exporta la conexión a Redis usando ioredis. Soporta
 *   TLS automático para Upstash (rediss://) y configuración de
 *   maxRetriesPerRequest (null para compatibilidad con BullMQ).
 *
 * CARACTERÍSTICAS:
 *   - Auto-detecta TLS para URLs rediss:// y upstash.io
 *   - maxRetriesPerRequest: null (BullMQ requirement)
 *   - Eventos: connect, error, close con logging
 *   - REDIS_TLS_REJECT_UNAUTHORIZED: Configurable (false para self-signed)
 *
 * @module redis.config
 */
import Redis from 'ioredis';
import { logger } from '../utils/logger.util';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const isTLS = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  ...(isTLS ? { tls: { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } } : {})
});

connection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

connection.on('connect', () => {
  logger.info('Redis connected successfully');
});

connection.on('close', () => {
  logger.warn('Redis connection closed');
});
