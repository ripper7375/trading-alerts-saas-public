/**
 * PostgreSQL Client Configuration
 *
 * Part 20 - Phase 04: Next.js API Routes
 * Creates PostgreSQL connection pool for indicator data queries.
 *
 * @module lib/db/postgresql
 */

import { Pool, PoolConfig } from 'pg';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POOL CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PostgreSQL connection pool configuration
 * - max: 20 connections for handling concurrent requests
 * - idleTimeoutMillis: 30s - release idle connections
 * - connectionTimeoutMillis: 2s - fail fast on connection issues
 */
const poolConfig: PoolConfig = {
  connectionString: process.env.POSTGRESQL_URI || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON POOL INSTANCE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Global pool instance
 * Reused across all requests in Next.js serverless environment
 */
let pool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 *
 * @returns PostgreSQL Pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    // Log pool events in development
    if (process.env.NODE_ENV === 'development') {
      pool.on('connect', () => {
        console.log('[PostgreSQL] New client connected to pool');
      });

      pool.on('error', (err: Error) => {
        console.error('[PostgreSQL] Pool error:', err.message);
      });
    }
  }

  return pool;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY FUNCTION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Execute a parameterized query against PostgreSQL
 *
 * @param text - SQL query text with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Array of typed result rows
 *
 * @example
 * const users = await query<User>('SELECT * FROM users WHERE id = $1', [userId]);
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();

  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH CHECK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check PostgreSQL connection health
 *
 * @returns Health status object
 */
export async function checkHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const result = await query<{ version: string }>('SELECT version()');
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      latencyMs,
      version: result[0]?.version,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      connected: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get table count in database
 *
 * @returns Number of tables
 */
export async function getTableCount(): Promise<number> {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM information_schema.tables
       WHERE table_schema = 'public'`
    );
    return parseInt(result[0]?.count || '0', 10);
  } catch {
    return 0;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLEANUP
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Close the pool connection
 * Typically called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Pool closed');
  }
}
