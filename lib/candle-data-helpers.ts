/**
 * Candle Data Helpers
 * Part 20 - Hot/Warm Tier Query Utilities
 *
 * Reusable utilities for querying candle data from Redis and PostgreSQL.
 */

import { createClient } from "redis";
import { Pool } from "pg";

// Types
export interface Candle {
  t: number;  // timestamp (Unix seconds)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
}

export interface CandleQueryOptions {
  symbol: string;
  limit: number;
  timeframe?: string;
  startTime?: number;  // Unix timestamp (optional filter)
  endTime?: number;    // Unix timestamp (optional filter)
}

// Configuration
const REDIS_URL = process.env.REDIS_URL || "";
const POSTGRESQL_URI = process.env.POSTGRESQL_URI || "";
export const REALTIME_CANDLE_LIMIT = 250;
export const MAX_CANDLE_LIMIT = 10000;

// PostgreSQL connection pool (singleton)
let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: POSTGRESQL_URI,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pgPool;
}

/**
 * Query candles using hot/warm tier strategy.
 *
 * Automatically selects the optimal query path:
 * - Small queries (≤250 candles): Redis only
 * - Large queries (>250 candles): Redis + PostgreSQL
 *
 * @param options - Query options
 * @returns Array of candles sorted by timestamp
 */
export async function queryCandles(options: CandleQueryOptions): Promise<Candle[]> {
  const { symbol, limit, timeframe = "m5" } = options;
  const normalizedSymbol = symbol.toLowerCase();

  let candles: Candle[] = [];

  if (limit <= REALTIME_CANDLE_LIMIT) {
    // HOT path: Query only Redis
    candles = await getFromRedis(normalizedSymbol, limit);

    // Fallback to PostgreSQL if Redis fails
    if (candles.length === 0) {
      console.warn(`Redis query failed for ${normalizedSymbol}, falling back to PostgreSQL`);
      candles = await getFromPostgreSQL(normalizedSymbol, timeframe, limit);
    }
  } else {
    // WARM path: Query both Redis + PostgreSQL
    const [redisCandles, pgCandles] = await Promise.all([
      getFromRedis(normalizedSymbol, REALTIME_CANDLE_LIMIT),
      getFromPostgreSQL(normalizedSymbol, timeframe, limit - REALTIME_CANDLE_LIMIT),
    ]);

    // Combine results (PostgreSQL older data + Redis recent data)
    candles = [...pgCandles, ...redisCandles];

    // Sort by timestamp ascending
    candles.sort((a, b) => a.t - b.t);

    // Trim to requested limit
    candles = candles.slice(-limit);
  }

  // Apply time range filters if provided
  if (options.startTime) {
    candles = candles.filter((c) => c.t >= options.startTime!);
  }

  if (options.endTime) {
    candles = candles.filter((c) => c.t <= options.endTime!);
  }

  return candles;
}

/**
 * Query candles from Redis (HOT tier).
 *
 * @param symbol - Normalized symbol (e.g., "eurusd", "btcusd")
 * @param limit - Number of candles to retrieve
 * @returns Array of candles sorted by timestamp
 */
export async function getFromRedis(symbol: string, limit: number): Promise<Candle[]> {
  if (!REDIS_URL) {
    console.warn("Redis URL not configured, skipping Redis query");
    return [];
  }

  let redisClient: ReturnType<typeof createClient> | null = null;

  try {
    // Create Redis client
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            return new Error("Redis reconnect limit exceeded");
          }
          return retries * 100; // exponential backoff
        },
      },
    });

    // Connect to Redis
    await redisClient.connect();

    // Query sorted set (last N members)
    const redisKey = `${symbol}:realtime`;
    const results = await redisClient.zRange(redisKey, -limit, -1);

    // Parse JSON candle data
    const candles: Candle[] = results.map((item) => JSON.parse(item));

    console.log(`Retrieved ${candles.length} candles from Redis for ${symbol}`);

    return candles;

  } catch (error) {
    console.error(`Redis query error for ${symbol}:`, error);
    return [];
  } finally {
    // Close Redis connection
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (err) {
        console.error("Error disconnecting from Redis:", err);
      }
    }
  }
}

/**
 * Query candles from PostgreSQL (WARM tier).
 *
 * @param symbol - Normalized symbol (e.g., "eurusd", "btcusd")
 * @param timeframe - Timeframe (m5, m15, m30, h1, h2, h4, h8, h12, d1)
 * @param limit - Number of candles to retrieve
 * @returns Array of candles sorted by timestamp
 */
export async function getFromPostgreSQL(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<Candle[]> {
  if (!POSTGRESQL_URI) {
    console.warn("PostgreSQL URI not configured, skipping PostgreSQL query");
    return [];
  }

  try {
    const pool = getPgPool();
    const tableName = `${symbol}_${timeframe}`;

    // Query last N candles from PostgreSQL
    const query = `
      SELECT
        EXTRACT(EPOCH FROM timestamp)::bigint AS t,
        open AS o,
        high AS h,
        low AS l,
        close AS c
      FROM ${tableName}
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    // Reverse to get ascending order
    const candles: Candle[] = result.rows.reverse();

    console.log(
      `Retrieved ${candles.length} candles from PostgreSQL (${tableName})`
    );

    return candles;

  } catch (error) {
    console.error(`PostgreSQL query error for ${symbol}_${timeframe}:`, error);
    return [];
  }
}

/**
 * Get the latest candle for a symbol from Redis.
 *
 * @param symbol - Normalized symbol
 * @returns Latest candle or null
 */
export async function getLatestCandle(symbol: string): Promise<Candle | null> {
  const candles = await getFromRedis(symbol, 1);
  return candles.length > 0 ? candles[0] : null;
}

/**
 * Check Redis health.
 *
 * @returns True if Redis is available, false otherwise
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (!REDIS_URL) {
    return false;
  }

  let redisClient: ReturnType<typeof createClient> | null = null;

  try {
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  } finally {
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (err) {
        console.error("Error disconnecting from Redis:", err);
      }
    }
  }
}

/**
 * Check PostgreSQL health.
 *
 * @returns True if PostgreSQL is available, false otherwise
 */
export async function isPostgreSQLAvailable(): Promise<boolean> {
  if (!POSTGRESQL_URI) {
    return false;
  }

  try {
    const pool = getPgPool();
    const result = await pool.query("SELECT 1");
    return result.rowCount === 1;
  } catch (error) {
    console.error("PostgreSQL health check failed:", error);
    return false;
  }
}

/**
 * Close all database connections.
 *
 * Should be called during application shutdown.
 */
export async function closeConnections(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
