import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton for Next.js Application
 *
 * Reuses PrismaClient instance across hot reloads in development
 * Prevents connection pool exhaustion during development
 * Follows Prisma best practices for Next.js integration
 *
 * Schema: 60-column MarketData flat schema (v2.0 — EA v2.26+)
 *   - 8 system columns (OHLCV + metadata)
 *   - 16 FREE tier indicator columns (fractal_diagonal, fractal_horizontal)
 *   - 36 PRO tier indicator columns (moving_averages, body_momentum, heiken_ashi,
 *       keltner_channels, support_resistance, zigzag, dual_tema_hl, pinbar_detection)
 *
 * Note: We import from '@prisma/client' which uses the generated client
 * or falls back to type stubs (types/prisma-stubs.d.ts) when the client
 * cannot be generated locally due to network restrictions.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma;
