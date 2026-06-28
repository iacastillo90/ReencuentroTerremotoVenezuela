import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Export connection to be reused by queues and workers
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});
