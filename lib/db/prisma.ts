import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Client Singleton for Next.js Application
 *
 * Reuses PrismaClient instance across hot reloads in development
 * Prevents connection pool exhaustion during development
 * Follows Prisma best practices for Next.js integration
 *
 * Note: We import from '@prisma/client' which uses the generated client
 * or falls back to type stubs (types/prisma-stubs.d.ts) when the client
 * cannot be generated locally due to network restrictions.
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
