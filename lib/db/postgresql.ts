/**
 * PostgreSQL Client for Part 20 SQLite + PostgreSQL Architecture
 *
 * Provides connection pooling for PostgreSQL database access.
 * Used for reading indicator data synced from SQLite.
 *
 * @module lib/db/postgresql
 */

import { Pool, PoolClient } from 'pg';

// Global pool instance (singleton pattern for Next.js)
let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRESQL_URI,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

/**
 * Execute a parameterized query and return typed results
 *
 * @param text - SQL query string with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Array of typed row objects
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

/**
 * Get a client from the pool for transaction or multiple query usage
 *
 * IMPORTANT: Always release the client when done!
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   // ... multiple queries
 *   await client.query('COMMIT');
 * } finally {
 *   client.release();
 * }
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Check if the database connection is healthy
 *
 * @returns true if connection is successful, false otherwise
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
} {
  const p = getPool();
  return {
    total: p.totalCount,
    idle: p.idleCount,
    waiting: p.waitingCount,
  };
}

/**
 * Gracefully close the pool (for shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Export the getPool function for advanced usage
export { getPool };
