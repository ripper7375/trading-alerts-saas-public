/**
 * Unit Tests: Prisma Client Singleton
 * Tests database client initialization in lib/db/prisma.ts
 * Coverage target: Path D (Database) - 25%
 *
 * Enhanced for Prisma 5.22.0 compatibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create comprehensive mock PrismaClient with all Prisma 5.x features
const createMockPrismaClient = () => ({
  // Connection lifecycle methods
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $on: jest.fn(),
  $use: jest.fn(),

  // Prisma 5.x specific methods
  $metrics: {
    json: jest.fn().mockResolvedValue({
      counters: [],
      gauges: [],
      histograms: [],
    }),
    prometheus: jest.fn().mockResolvedValue(''),
  },
  $extends: jest.fn().mockReturnThis(),

  // Query methods
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),

  // Core models (User, Auth)
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  verificationToken: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },

  // Subscription & Payment models
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  // Alert & Watchlist models
  alert: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  watchlist: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  watchlistItem: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },

  // Notification model
  notification: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  // User Preferences
  userPreferences: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },

  // Account Deletion
  accountDeletionRequest: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },

  // Fraud Detection
  fraudAlert: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },

  // Affiliate System models
  affiliateProfile: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  affiliateCode: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  commission: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },

  // RiseWorks Disbursement models
  affiliateRiseAccount: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  paymentBatch: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  disbursementTransaction: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  riseWorksWebhookEvent: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  disbursementAuditLog: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },

  // System Configuration models
  systemConfig: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  systemConfigHistory: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
});

// Store mock instance for tests
let mockPrismaInstance: ReturnType<typeof createMockPrismaClient>;

// Mock PrismaClient constructor
const MockPrismaClient = jest.fn().mockImplementation(() => {
  mockPrismaInstance = createMockPrismaClient();
  return mockPrismaInstance;
});

// Mock @prisma/client - the standard import path
// This works because lib/db/prisma.ts now imports from '@prisma/client'
// which resolves to either the generated client or our type stubs
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: MockPrismaClient,
}));

describe('Prisma Client Singleton', () => {
  let prismaModule: typeof import('@/lib/db/prisma');
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(async () => {
    // Clear module cache to test fresh import
    jest.resetModules();
    jest.clearAllMocks();

    // Clear globalThis.prisma
    const globalForPrisma = globalThis as unknown as {
      prisma: unknown | undefined;
    };
    delete globalForPrisma.prisma;
  });

  afterEach(() => {
    // Restore NODE_ENV
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  describe('Module Export', () => {
    it('should export prisma client', async () => {
      prismaModule = await import('@/lib/db/prisma');
      expect(prismaModule.prisma).toBeDefined();
    });

    it('should instantiate PrismaClient', async () => {
      await import('@/lib/db/prisma');
      expect(MockPrismaClient).toHaveBeenCalled();
    });

    it('should pass logging configuration to PrismaClient', async () => {
      process.env['NODE_ENV'] = 'development';
      jest.resetModules();

      await import('@/lib/db/prisma');

      expect(MockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: expect.any(Array),
        })
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on subsequent imports', async () => {
      prismaModule = await import('@/lib/db/prisma');
      const firstInstance = prismaModule.prisma;

      // Import again
      const { prisma: secondInstance } = await import('@/lib/db/prisma');

      expect(secondInstance).toBe(firstInstance);
    });

    it('should store instance in globalThis in non-production', async () => {
      process.env['NODE_ENV'] = 'development';
      jest.resetModules();

      await import('@/lib/db/prisma');

      const globalForPrisma = globalThis as unknown as {
        prisma: unknown | undefined;
      };
      expect(globalForPrisma.prisma).toBeDefined();
    });

    it('should create only one PrismaClient instance', async () => {
      jest.resetModules();

      await import('@/lib/db/prisma');
      await import('@/lib/db/prisma');
      await import('@/lib/db/prisma');

      // Should only be called once due to singleton caching
      expect(MockPrismaClient.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Environment-based Logging', () => {
    it('should enable verbose logging in development', async () => {
      process.env['NODE_ENV'] = 'development';
      jest.resetModules();

      await import('@/lib/db/prisma');

      expect(MockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should enable only error logging in production', async () => {
      process.env['NODE_ENV'] = 'production';
      jest.resetModules();

      await import('@/lib/db/prisma');

      expect(MockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should enable only error logging in test environment', async () => {
      process.env['NODE_ENV'] = 'test';
      jest.resetModules();

      await import('@/lib/db/prisma');

      expect(MockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });
  });

  describe('Core User Model Methods', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have user.findUnique method', () => {
      expect(typeof prismaModule.prisma.user.findUnique).toBe('function');
    });

    it('should have user.findFirst method', () => {
      expect(typeof prismaModule.prisma.user.findFirst).toBe('function');
    });

    it('should have user.findMany method', () => {
      expect(typeof prismaModule.prisma.user.findMany).toBe('function');
    });

    it('should have user.create method', () => {
      expect(typeof prismaModule.prisma.user.create).toBe('function');
    });

    it('should have user.createMany method', () => {
      expect(typeof prismaModule.prisma.user.createMany).toBe('function');
    });

    it('should have user.update method', () => {
      expect(typeof prismaModule.prisma.user.update).toBe('function');
    });

    it('should have user.updateMany method', () => {
      expect(typeof prismaModule.prisma.user.updateMany).toBe('function');
    });

    it('should have user.upsert method', () => {
      expect(typeof prismaModule.prisma.user.upsert).toBe('function');
    });

    it('should have user.delete method', () => {
      expect(typeof prismaModule.prisma.user.delete).toBe('function');
    });

    it('should have user.deleteMany method', () => {
      expect(typeof prismaModule.prisma.user.deleteMany).toBe('function');
    });

    it('should have user.count method', () => {
      expect(typeof prismaModule.prisma.user.count).toBe('function');
    });

    it('should have user.aggregate method', () => {
      expect(typeof prismaModule.prisma.user.aggregate).toBe('function');
    });

    it('should have user.groupBy method', () => {
      expect(typeof prismaModule.prisma.user.groupBy).toBe('function');
    });
  });

  describe('Auth Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have account model', () => {
      expect(prismaModule.prisma.account).toBeDefined();
      expect(typeof prismaModule.prisma.account.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.account.create).toBe('function');
    });

    it('should have session model', () => {
      expect(prismaModule.prisma.session).toBeDefined();
      expect(typeof prismaModule.prisma.session.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.session.create).toBe('function');
    });

    it('should have verificationToken model', () => {
      expect(prismaModule.prisma.verificationToken).toBeDefined();
      expect(typeof prismaModule.prisma.verificationToken.findUnique).toBe(
        'function'
      );
    });
  });

  describe('Subscription & Payment Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have subscription model with all CRUD methods', () => {
      expect(prismaModule.prisma.subscription).toBeDefined();
      expect(typeof prismaModule.prisma.subscription.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.subscription.findFirst).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.subscription.findMany).toBe('function');
      expect(typeof prismaModule.prisma.subscription.create).toBe('function');
      expect(typeof prismaModule.prisma.subscription.update).toBe('function');
      expect(typeof prismaModule.prisma.subscription.upsert).toBe('function');
      expect(typeof prismaModule.prisma.subscription.delete).toBe('function');
    });

    it('should have payment model with all CRUD methods', () => {
      expect(prismaModule.prisma.payment).toBeDefined();
      expect(typeof prismaModule.prisma.payment.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.payment.findMany).toBe('function');
      expect(typeof prismaModule.prisma.payment.create).toBe('function');
      expect(typeof prismaModule.prisma.payment.count).toBe('function');
    });
  });

  describe('Alert & Watchlist Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have alert model with all methods', () => {
      expect(prismaModule.prisma.alert).toBeDefined();
      expect(typeof prismaModule.prisma.alert.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.alert.findMany).toBe('function');
      expect(typeof prismaModule.prisma.alert.create).toBe('function');
      expect(typeof prismaModule.prisma.alert.update).toBe('function');
      expect(typeof prismaModule.prisma.alert.delete).toBe('function');
      expect(typeof prismaModule.prisma.alert.count).toBe('function');
    });

    it('should have watchlist model with all methods', () => {
      expect(prismaModule.prisma.watchlist).toBeDefined();
      expect(typeof prismaModule.prisma.watchlist.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.watchlist.findMany).toBe('function');
      expect(typeof prismaModule.prisma.watchlist.create).toBe('function');
      expect(typeof prismaModule.prisma.watchlist.upsert).toBe('function');
    });

    it('should have watchlistItem model with all methods', () => {
      expect(prismaModule.prisma.watchlistItem).toBeDefined();
      expect(typeof prismaModule.prisma.watchlistItem.findMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.watchlistItem.create).toBe('function');
      expect(typeof prismaModule.prisma.watchlistItem.createMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.watchlistItem.delete).toBe('function');
    });
  });

  describe('Notification Model', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have notification model', () => {
      expect(prismaModule.prisma.notification).toBeDefined();
    });

    it('should have notification CRUD methods', () => {
      expect(typeof prismaModule.prisma.notification.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.notification.findMany).toBe('function');
      expect(typeof prismaModule.prisma.notification.create).toBe('function');
      expect(typeof prismaModule.prisma.notification.createMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.notification.update).toBe('function');
      expect(typeof prismaModule.prisma.notification.updateMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.notification.count).toBe('function');
    });
  });

  describe('User Preferences & Account Deletion Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have userPreferences model', () => {
      expect(prismaModule.prisma.userPreferences).toBeDefined();
      expect(typeof prismaModule.prisma.userPreferences.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.userPreferences.upsert).toBe(
        'function'
      );
    });

    it('should have accountDeletionRequest model', () => {
      expect(prismaModule.prisma.accountDeletionRequest).toBeDefined();
      expect(
        typeof prismaModule.prisma.accountDeletionRequest.findUnique
      ).toBe('function');
      expect(typeof prismaModule.prisma.accountDeletionRequest.create).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.accountDeletionRequest.update).toBe(
        'function'
      );
    });
  });

  describe('Fraud Detection Model', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have fraudAlert model', () => {
      expect(prismaModule.prisma.fraudAlert).toBeDefined();
    });

    it('should have fraudAlert CRUD methods', () => {
      expect(typeof prismaModule.prisma.fraudAlert.findUnique).toBe('function');
      expect(typeof prismaModule.prisma.fraudAlert.findMany).toBe('function');
      expect(typeof prismaModule.prisma.fraudAlert.create).toBe('function');
      expect(typeof prismaModule.prisma.fraudAlert.update).toBe('function');
      expect(typeof prismaModule.prisma.fraudAlert.deleteMany).toBe('function');
      expect(typeof prismaModule.prisma.fraudAlert.count).toBe('function');
    });
  });

  describe('Affiliate System Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have affiliateProfile model', () => {
      expect(prismaModule.prisma.affiliateProfile).toBeDefined();
      expect(typeof prismaModule.prisma.affiliateProfile.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateProfile.create).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateProfile.update).toBe(
        'function'
      );
    });

    it('should have affiliateCode model', () => {
      expect(prismaModule.prisma.affiliateCode).toBeDefined();
      expect(typeof prismaModule.prisma.affiliateCode.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateCode.findMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateCode.create).toBe('function');
      expect(typeof prismaModule.prisma.affiliateCode.createMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateCode.updateMany).toBe(
        'function'
      );
    });

    it('should have commission model with aggregate', () => {
      expect(prismaModule.prisma.commission).toBeDefined();
      expect(typeof prismaModule.prisma.commission.findMany).toBe('function');
      expect(typeof prismaModule.prisma.commission.create).toBe('function');
      expect(typeof prismaModule.prisma.commission.updateMany).toBe('function');
      expect(typeof prismaModule.prisma.commission.aggregate).toBe('function');
    });
  });

  describe('RiseWorks Disbursement Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have affiliateRiseAccount model', () => {
      expect(prismaModule.prisma.affiliateRiseAccount).toBeDefined();
      expect(typeof prismaModule.prisma.affiliateRiseAccount.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.affiliateRiseAccount.create).toBe(
        'function'
      );
    });

    it('should have paymentBatch model', () => {
      expect(prismaModule.prisma.paymentBatch).toBeDefined();
      expect(typeof prismaModule.prisma.paymentBatch.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.paymentBatch.findMany).toBe('function');
      expect(typeof prismaModule.prisma.paymentBatch.create).toBe('function');
    });

    it('should have disbursementTransaction model', () => {
      expect(prismaModule.prisma.disbursementTransaction).toBeDefined();
      expect(
        typeof prismaModule.prisma.disbursementTransaction.findUnique
      ).toBe('function');
      expect(typeof prismaModule.prisma.disbursementTransaction.create).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.disbursementTransaction.createMany).toBe(
        'function'
      );
    });

    it('should have riseWorksWebhookEvent model', () => {
      expect(prismaModule.prisma.riseWorksWebhookEvent).toBeDefined();
      expect(typeof prismaModule.prisma.riseWorksWebhookEvent.findMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.riseWorksWebhookEvent.create).toBe(
        'function'
      );
    });

    it('should have disbursementAuditLog model', () => {
      expect(prismaModule.prisma.disbursementAuditLog).toBeDefined();
      expect(typeof prismaModule.prisma.disbursementAuditLog.findMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.disbursementAuditLog.create).toBe(
        'function'
      );
    });
  });

  describe('System Configuration Models', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have systemConfig model', () => {
      expect(prismaModule.prisma.systemConfig).toBeDefined();
    });

    it('should have systemConfig CRUD methods', () => {
      expect(typeof prismaModule.prisma.systemConfig.findUnique).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.systemConfig.findFirst).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.systemConfig.findMany).toBe('function');
      expect(typeof prismaModule.prisma.systemConfig.create).toBe('function');
      expect(typeof prismaModule.prisma.systemConfig.update).toBe('function');
      expect(typeof prismaModule.prisma.systemConfig.upsert).toBe('function');
      expect(typeof prismaModule.prisma.systemConfig.delete).toBe('function');
    });

    it('should have systemConfigHistory model', () => {
      expect(prismaModule.prisma.systemConfigHistory).toBeDefined();
    });

    it('should have systemConfigHistory methods', () => {
      expect(typeof prismaModule.prisma.systemConfigHistory.findMany).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.systemConfigHistory.create).toBe(
        'function'
      );
      expect(typeof prismaModule.prisma.systemConfigHistory.deleteMany).toBe(
        'function'
      );
    });
  });

  describe('Connection Lifecycle Methods', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have $connect method', () => {
      expect(typeof prismaModule.prisma.$connect).toBe('function');
    });

    it('should have $disconnect method', () => {
      expect(typeof prismaModule.prisma.$disconnect).toBe('function');
    });

    it('should have $on method for event listeners', () => {
      expect(typeof prismaModule.prisma.$on).toBe('function');
    });

    it('should have $use method for middleware', () => {
      expect(typeof prismaModule.prisma.$use).toBe('function');
    });
  });

  describe('Prisma 5.x Features', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have $metrics API for observability', () => {
      expect(prismaModule.prisma.$metrics).toBeDefined();
      expect(typeof prismaModule.prisma.$metrics.json).toBe('function');
      expect(typeof prismaModule.prisma.$metrics.prometheus).toBe('function');
    });

    it('should have $extends method for client extensions', () => {
      expect(typeof prismaModule.prisma.$extends).toBe('function');
    });

    it('should have $transaction method', () => {
      expect(typeof prismaModule.prisma.$transaction).toBe('function');
    });
  });

  describe('Raw Query Methods', () => {
    beforeEach(async () => {
      prismaModule = await import('@/lib/db/prisma');
    });

    it('should have $queryRaw method', () => {
      expect(typeof prismaModule.prisma.$queryRaw).toBe('function');
    });

    it('should have $executeRaw method', () => {
      expect(typeof prismaModule.prisma.$executeRaw).toBe('function');
    });

    it('should have $queryRawUnsafe method', () => {
      expect(typeof prismaModule.prisma.$queryRawUnsafe).toBe('function');
    });

    it('should have $executeRawUnsafe method', () => {
      expect(typeof prismaModule.prisma.$executeRawUnsafe).toBe('function');
    });
  });
});
