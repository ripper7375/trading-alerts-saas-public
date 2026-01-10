/**
 * Real-Time Candle Data API
 * Part 20 - Hot/Warm Tier Query Implementation
 *
 * Query Strategy:
 * - If limit <= 250: Query only Redis (HOT tier)
 * - If limit > 250: Query Redis (last 250) + PostgreSQL (older data)
 * - Graceful degradation if Redis is unavailable
 *
 * Query Parameters:
 * - symbol: Trading symbol (eurusd, btcusd, etc.)
 * - limit: Number of candles (default: 100, max: 10,000)
 * - timeframe: For PostgreSQL queries (m5, m15, m30, h1, h2, h4, h8, h12, d1)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";
import { Pool } from "pg";

// Types
interface Candle {
  t: number;  // timestamp (Unix seconds)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
}

interface QueryParams {
  symbol: string;
  limit: number;
  timeframe?: string;
}

// Environment configuration
const REDIS_URL = process.env.REDIS_URL || "";
const POSTGRESQL_URI = process.env.POSTGRESQL_URI || "";
const REALTIME_CANDLE_LIMIT = 250;
const MAX_CANDLE_LIMIT = 10000;

// PostgreSQL connection pool
const pgPool = new Pool({
  connectionString: POSTGRESQL_URI,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * GET /api/candles/[symbol]
 *
 * Query candles from hot/warm tiers with automatic fallback.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
): Promise<NextResponse> {
  try {
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      MAX_CANDLE_LIMIT
    );
    const timeframe = searchParams.get("timeframe") || "m5";
    const symbol = params.symbol.toLowerCase();

    // Validate parameters
    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 }
      );
    }

    const validTimeframes = ["m5", "m15", "m30", "h1", "h2", "h4", "h8", "h12", "d1"];
    if (timeframe && !validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}` },
        { status: 400 }
      );
    }

    // Query data based on limit
    let candles: Candle[] = [];

    if (limit <= REALTIME_CANDLE_LIMIT) {
      // HOT path: Query only Redis
      candles = await getFromRedis(symbol, limit);

      // Fallback to PostgreSQL if Redis fails
      if (candles.length === 0) {
        console.warn(`Redis query failed for ${symbol}, falling back to PostgreSQL`);
        candles = await getFromPostgreSQL(symbol, timeframe, limit);
      }
    } else {
      // WARM path: Query both Redis + PostgreSQL
      const [redisCandles, pgCandles] = await Promise.all([
        getFromRedis(symbol, REALTIME_CANDLE_LIMIT),
        getFromPostgreSQL(symbol, timeframe, limit - REALTIME_CANDLE_LIMIT),
      ]);

      // Combine results (PostgreSQL older data + Redis recent data)
      candles = [...pgCandles, ...redisCandles];

      // Sort by timestamp ascending
      candles.sort((a, b) => a.t - b.t);

      // Trim to requested limit
      candles = candles.slice(-limit);
    }

    return NextResponse.json({
      symbol,
      timeframe,
      limit,
      count: candles.length,
      candles,
      source: limit <= REALTIME_CANDLE_LIMIT ? "redis" : "redis+postgresql",
    });

  } catch (error) {
    console.error("Error fetching candles:", error);
    return NextResponse.json(
      { error: "Failed to fetch candle data" },
      { status: 500 }
    );
  }
}

/**
 * Query candles from Redis (HOT tier).
 *
 * Returns the last N candles from the real-time sorted set.
 *
 * @param symbol - Normalized symbol (e.g., "eurusd", "btcusd")
 * @param limit - Number of candles to retrieve
 * @returns Array of candles sorted by timestamp
 */
async function getFromRedis(symbol: string, limit: number): Promise<Candle[]> {
  if (!REDIS_URL) {
    console.warn("Redis URL not configured, skipping Redis query");
    return [];
  }

  let redisClient: ReturnType<typeof createClient> | null = null;

  try {
    // Create Redis client
    redisClient = createClient({
      url: REDIS_URL,
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
 * Returns older candles from the timeframe-specific table.
 *
 * @param symbol - Normalized symbol (e.g., "eurusd", "btcusd")
 * @param timeframe - Timeframe (m5, m15, m30, h1, h2, h4, h8, h12, d1)
 * @param limit - Number of candles to retrieve
 * @returns Array of candles sorted by timestamp
 */
async function getFromPostgreSQL(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<Candle[]> {
  if (!POSTGRESQL_URI) {
    console.warn("PostgreSQL URI not configured, skipping PostgreSQL query");
    return [];
  }

  try {
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

    const result = await pgPool.query(query, [limit]);

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
 * Health check endpoint
 */
export async function HEAD(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" });
}
