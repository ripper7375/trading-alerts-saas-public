import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis_broker:6379';

// One shared connection for rate-limit counters and the BullMQ pub/sub bridge.
// BullMQ requires maxRetriesPerRequest: null on any connection it manages.
export function createRedisConnection(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}
