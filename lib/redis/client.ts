/**
 * Redis Client
 *
 * Redis connection using ioredis with lazy initialization.
 * Supports connection URL from environment variables.
 */

import Redis, { RedisOptions } from 'ioredis';

// Singleton instance
let redisClient: Redis | null = null;

/**
 * Redis connection options
 */
const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number): number | null => {
    // Retry with exponential backoff, max 30 seconds
    if (times > 10) {
      return null; // Stop retrying
    }
    return Math.min(times * 500, 30000);
  },
  enableReadyCheck: true,
  lazyConnect: true,
};

/**
 * Get Redis client instance (lazy initialization)
 *
 * @returns Redis client instance
 * @throws Error if REDIS_URL is not set
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env['REDIS_URL'];

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  redisClient = new Redis(redisUrl, REDIS_OPTIONS);

  // Set up event handlers
  redisClient.on('connect', () => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info('Redis client connected');
    }
  });

  redisClient.on('error', (error: Error) => {
    console.error('Redis client error:', error.message);
  });

  redisClient.on('close', () => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info('Redis client disconnected');
    }
  });

  return redisClient;
}

/**
 * Export redis client for direct use
 * This is a lazy getter - client is only created when accessed
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop: keyof Redis) {
    const client = getRedisClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Check if Redis is connected
 *
 * @returns true if connected, false otherwise
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Gracefully disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
  connected: boolean;
  status: string;
} {
  if (!redisClient) {
    return { connected: false, status: 'not_initialized' };
  }

  const status = redisClient.status;
  return {
    connected: status === 'ready',
    status,
  };
}
