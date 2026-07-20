import { PrismaClient } from '.prisma/non-market-client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Client Singleton for Next.js Application
 *
 * Reuses PrismaClient instance across hot reloads in development
 * Prevents connection pool exhaustion during development
 * Follows Prisma best practices for Next.js integration
 *
 * Session 2-4: repointed from the default '@prisma/client' output to the
 * split non-market client (generator output = node_modules/.prisma/non-market-client,
 * prisma/non-market-data/schema.prisma). This is the choke point every
 * `import { prisma } from '@/lib/db/prisma'` consumer goes through; the two
 * call sites that genuinely need MarketDataV6 (app/api/market-data/channel/route.ts,
 * lib/jobs/alert-checker.ts) import the separate `marketPrisma` singleton from
 * `@/lib/db/market-prisma` instead/alongside — see that file's header for why a
 * second singleton exists rather than one client exposing both.
 * Imported via the bare `.prisma/non-market-client` specifier (not `@prisma/client`)
 * because this generator has a custom `output` — same resolution mechanism
 * `@prisma/client`'s own default.js uses internally (`require('.prisma/client/default')`).
 *
 * Prisma 7 requires a driver adapter for every PrismaClient instantiation —
 * DATABASE_URL here is the pooled (PgBouncer) connection string per
 * LESSONS-LEARNED.md L3; migrations/CLI use DIRECT_URL via prisma.config.ts
 * instead. `rejectUnauthorized: false` preserves the pre-v7 Rust engine's
 * permissive cert handling — v7's node-pg driver validates certs by default,
 * which would otherwise change behavior against Railway's proxy TLS setup.
 */

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false },
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma;
