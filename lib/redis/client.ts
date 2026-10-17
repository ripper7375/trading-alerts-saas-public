/**
 * Redis Client
 *
 * Redis connection using ioredis with lazy initialization.
 * Supports connection URL from environment variables.
 */

import Redis, { RedisOptions } from 'ioredis';

// Singleton instance
let redisClient: Redis | null = null;

// Outside production the instance is also kept on globalThis, so a dev hot
// reload (which re-evaluates this module and would otherwise open a second
// socket and leak the first) finds the client it already made.
const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
};

/** The singleton, recovered from globalThis after a dev hot reload. */
function currentClient(): Redis | null {
  if (!redisClient && process.env['NODE_ENV'] !== 'production') {
    redisClient = globalForRedis.redisClient ?? null;
  }
  return redisClient;
}

function rememberClient(client: Redis | null): void {
  redisClient = client;
  if (process.env['NODE_ENV'] !== 'production') {
    globalForRedis.redisClient = client ?? undefined;
  }
}

/**
 * Redis connection options
 */
const REDIS_OPTIONS: RedisOptions = {
  // Time limits (Next.js remediation T1-d). `connectTimeout` bounds the TCP
  // connect; `commandTimeout` makes a command that gets no reply fail with
  // "Command timed out" after 3 s instead of hanging the request. ioredis
  // starts that timer when the command is issued, so with `lazyConnect` it
  // also covers the time a first command waits for the connection. Do NOT set
  // `enableOfflineQueue: false`: it rejects commands at once while the client
  // is still 'connecting' on a cold start.
  connectTimeout: 5_000,
  commandTimeout: 3_000,
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
  const existing = currentClient();
  if (existing) {
    return existing;
  }

  const redisUrl = process.env['REDIS_URL'];

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const client = new Redis(redisUrl, REDIS_OPTIONS);
  rememberClient(client);

  // Set up event handlers
  client.on('connect', () => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info('Redis client connected');
    }
  });

  client.on('error', (error: Error) => {
    console.error('Redis client error:', error.message);
  });

  client.on('close', () => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info('Redis client disconnected');
    }
  });

  return client;
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
  const existing = currentClient();
  if (existing) {
    await existing.quit();
    rememberClient(null);
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
  connected: boolean;
  status: string;
} {
  const existing = currentClient();
  if (!existing) {
    return { connected: false, status: 'not_initialized' };
  }

  const status = existing.status;
  return {
    connected: status === 'ready',
    status,
  };
}
