import { PrismaClient } from '.prisma/market-client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Client Singleton for the market-data schema (MarketDataV6 only).
 *
 * Session 2-4: the split non-market client (@/lib/db/prisma) is the
 * singleton nearly every consumer needs, but two call sites genuinely query
 * `market_data_v6` directly (app/api/market-data/channel/route.ts,
 * lib/jobs/alert-checker.ts) — a case-sensitive grep miss during this
 * session's CONFIRM (`MarketDataV6` the model name vs `marketDataV6` the
 * client property) meant this wasn't caught until `tsc --noEmit` surfaced it.
 * Rather than have the main singleton expose both schemas' models (Prisma
 * generates one client per schema file — there's no single client spanning
 * both), those two files import this separate singleton for MarketDataV6
 * specifically, side by side with `@/lib/db/prisma` where they also need
 * non-market models.
 *
 * Same adapter/pooling pattern as lib/db/prisma.ts — see that file's header
 * for the DIRECT_URL vs DATABASE_URL and `rejectUnauthorized` rationale.
 */

const globalForMarketPrisma = globalThis as unknown as {
  marketPrisma: PrismaClient | undefined;
};

/**
 * Built only when no client is cached on `globalThis`, so a dev hot reload
 * (which re-evaluates this module) does not construct a new adapter each time.
 */
function createMarketPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
    ssl: { rejectUnauthorized: false },
    // Pool bounds (Next.js remediation T1-d): the same as lib/db/prisma.ts,
    // which explains them. This singleton has its own pool, so an instance
    // that uses both can hold up to 2 x max connections.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 5,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const marketPrisma =
  globalForMarketPrisma.marketPrisma ?? createMarketPrismaClient();

if (process.env['NODE_ENV'] !== 'production')
  globalForMarketPrisma.marketPrisma = marketPrisma;
