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
