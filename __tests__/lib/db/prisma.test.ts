/**
 * Unit Tests: Prisma Client Singleton
 * Tests database client initialization in lib/db/prisma.ts
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Mock PrismaClient to avoid actual database connections
const mockPrismaClient = jest.fn().mockImplementation(() => ({
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  alert: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: mockPrismaClient,
}));

describe('Prisma Client Singleton', () => {
  let prisma: unknown;

  beforeAll(async () => {
    // Clear module cache to test fresh import
    jest.resetModules();

    // Import after mock is set up
    const module = await import('@/lib/db/prisma');
    prisma = module.prisma;
  });

  describe('prisma export', () => {
    it('should export prisma client', () => {
      expect(prisma).toBeDefined();
    });

    it('should be an instance of PrismaClient mock', () => {
      expect(mockPrismaClient).toHaveBeenCalled();
    });

    it('should have user model', () => {
      expect((prisma as { user: unknown }).user).toBeDefined();
    });

    it('should have subscription model', () => {
      expect((prisma as { subscription: unknown }).subscription).toBeDefined();
    });

    it('should have alert model', () => {
      expect((prisma as { alert: unknown }).alert).toBeDefined();
    });
  });

  describe('Singleton pattern', () => {
    it('should return the same instance on subsequent imports', async () => {
      // Import again
      const { prisma: prisma2 } = await import('@/lib/db/prisma');

      // Should be the same instance (cached in globalThis)
      expect(prisma2).toBe(prisma);
    });

    it('should only create PrismaClient once', () => {
      // PrismaClient constructor should have been called only once
      // due to singleton pattern
      expect(mockPrismaClient.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Database models availability', () => {
    it('should have user.findUnique method', () => {
      const prismaTyped = prisma as { user: { findUnique: unknown } };
      expect(typeof prismaTyped.user.findUnique).toBe('function');
    });

    it('should have user.findMany method', () => {
      const prismaTyped = prisma as { user: { findMany: unknown } };
      expect(typeof prismaTyped.user.findMany).toBe('function');
    });

    it('should have user.create method', () => {
      const prismaTyped = prisma as { user: { create: unknown } };
      expect(typeof prismaTyped.user.create).toBe('function');
    });

    it('should have user.update method', () => {
      const prismaTyped = prisma as { user: { update: unknown } };
      expect(typeof prismaTyped.user.update).toBe('function');
    });

    it('should have user.delete method', () => {
      const prismaTyped = prisma as { user: { delete: unknown } };
      expect(typeof prismaTyped.user.delete).toBe('function');
    });

    it('should have subscription.findUnique method', () => {
      const prismaTyped = prisma as { subscription: { findUnique: unknown } };
      expect(typeof prismaTyped.subscription.findUnique).toBe('function');
    });

    it('should have subscription.create method', () => {
      const prismaTyped = prisma as { subscription: { create: unknown } };
      expect(typeof prismaTyped.subscription.create).toBe('function');
    });

    it('should have alert.findMany method', () => {
      const prismaTyped = prisma as { alert: { findMany: unknown } };
      expect(typeof prismaTyped.alert.findMany).toBe('function');
    });

    it('should have alert.create method', () => {
      const prismaTyped = prisma as { alert: { create: unknown } };
      expect(typeof prismaTyped.alert.create).toBe('function');
    });
  });
});
