import { PrismaClient } from '@prisma/client';

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
