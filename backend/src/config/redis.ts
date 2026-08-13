import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL;

const redis = new Redis(redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: !process.env.REDIS_URL,
  retryStrategy(times) {
    // If REDIS_URL is not set, stop retrying after 3 attempts to prevent infinite spam
    if (!process.env.REDIS_URL && times > 3) {
      return null;
    }
    // Backoff retry every 5s up to 10s
    return Math.min(times * 1000, 10000);
  },
});

let logCount = 0;
redis.on('error', (err) => {
  if (logCount < 1) {
    const msg = err?.message || 'ECONNREFUSED (Redis server not running)';
    logger.warn('Redis', `Connection offline (${msg}). Webhook background queue disabled.`);
    logCount++;
  }
});

redis.on('connect', () => {
  logCount = 0;
  logger.info('Redis', 'Connected successfully');
});

export default redis;


