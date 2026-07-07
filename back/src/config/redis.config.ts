import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Auto-detect TLS for cloud providers like Upstash/Render
const isTLS = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  ...(isTLS ? { tls: { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } } : {})
});
