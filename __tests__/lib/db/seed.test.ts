/**
 * Unit Tests: Database Seed Functions
 * Tests database seeding helpers in lib/db/seed.ts
 * Coverage target: Path D (Database) - 25%
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock bcrypt
const mockHash = jest.fn();
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

// Mock PrismaClient
const mockUserUpsert = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserDelete = jest.fn();
const mockAlertCreate = jest.fn();
const mockAlertDeleteMany = jest.fn();
const mockFraudAlertDeleteMany = jest.fn();
const mockPaymentDeleteMany = jest.fn();

// Create mock prisma client
const createMockPrisma = () => ({
  user: {
    upsert: mockUserUpsert,
    findUnique: mockUserFindUnique,
    delete: mockUserDelete,
  },
  alert: {
    create: mockAlertCreate,
    deleteMany: mockAlertDeleteMany,
  },
  fraudAlert: {
    deleteMany: mockFraudAlertDeleteMany,
  },
  payment: {
    deleteMany: mockPaymentDeleteMany,
  },
});

describe('Database Seed Functions', () => {
  let seedAdmin: typeof import('@/lib/db/seed').seedAdmin;
  let seedSampleAlerts: typeof import('@/lib/db/seed').seedSampleAlerts;
  let seedCompleteSetup: typeof import('@/lib/db/seed').seedCompleteSetup;
  let cleanupTestData: typeof import('@/lib/db/seed').cleanupTestData;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Default mock implementations
    mockHash.mockResolvedValue('hashed_password_123');

    // Import seed functions
    const seedModule = await import('@/lib/db/seed');
    seedAdmin = seedModule.seedAdmin;
    seedSampleAlerts = seedModule.seedSampleAlerts;
    seedCompleteSetup = seedModule.seedCompleteSetup;
    cleanupTestData = seedModule.cleanupTestData;
  });

  describe('seedAdmin', () => {
    it('should create an admin user with hashed password', async () => {
      const mockPrisma = createMockPrisma();
      const expectedAdmin = {
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      };
      mockUserUpsert.mockResolvedValue(expectedAdmin);

      const result = await seedAdmin(
        mockPrisma as never,
        'admin@test.com',
        'password123',
        'Admin User'
      );

      expect(mockHash).toHaveBeenCalledWith('password123', 10);
      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'admin@test.com' },
          create: expect.objectContaining({
            email: 'admin@test.com',
            password: 'hashed_password_123',
            tier: 'PRO',
            role: 'ADMIN',
          }),
        })
      );
      expect(result).toEqual(expectedAdmin);
    });

    it('should use default name if not provided', async () => {
      const mockPrisma = createMockPrisma();
      mockUserUpsert.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      });

      await seedAdmin(mockPrisma as never, 'admin@test.com', 'password123');

      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: 'Admin User',
          }),
        })
      );
    });

    it('should throw error if email is missing', async () => {
      const mockPrisma = createMockPrisma();

      await expect(
        seedAdmin(mockPrisma as never, '', 'password123')
      ).rejects.toThrow('Email and password are required');
    });

    it('should throw error if password is missing', async () => {
      const mockPrisma = createMockPrisma();

      await expect(
        seedAdmin(mockPrisma as never, 'admin@test.com', '')
      ).rejects.toThrow('Email and password are required');
    });

    it('should set emailVerified to current date', async () => {
      const mockPrisma = createMockPrisma();
      mockUserUpsert.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      });

      await seedAdmin(mockPrisma as never, 'admin@test.com', 'password123');

      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            emailVerified: expect.any(Date),
            isActive: true,
          }),
        })
      );
    });

    it('should set hasUsedStripeTrial to false', async () => {
      const mockPrisma = createMockPrisma();
      mockUserUpsert.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      });

      await seedAdmin(mockPrisma as never, 'admin@test.com', 'password123');

      expect(mockUserUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            hasUsedStripeTrial: false,
            hasUsedThreeDayPlan: false,
          }),
        })
      );
    });
  });

  describe('seedSampleAlerts', () => {
    it('should create 2 sample alerts', async () => {
      const mockPrisma = createMockPrisma();
      mockAlertCreate.mockImplementation(
        (args: { data: { symbol: string; name: string } }) =>
          Promise.resolve({
            id: 'alert-123',
            symbol: args.data.symbol,
            timeframe: 'H1',
            name: args.data.name,
            isActive: true,
            createdAt: new Date(),
          })
      );

      const result = await seedSampleAlerts(mockPrisma as never, 'user-123');

      expect(result).toHaveLength(2);
      expect(mockAlertCreate).toHaveBeenCalledTimes(2);
    });

    it('should create XAUUSD M5 resistance alert', async () => {
      const mockPrisma = createMockPrisma();
      const createdAlerts: { symbol: string; name: string }[] = [];
      mockAlertCreate.mockImplementation(
        (args: { data: { symbol: string; name: string } }) => {
          createdAlerts.push({
            symbol: args.data.symbol,
            name: args.data.name,
          });
          return Promise.resolve({
            id: 'alert-123',
            symbol: args.data.symbol,
            timeframe: 'H1',
            name: args.data.name,
            isActive: true,
            createdAt: new Date(),
          });
        }
      );

      await seedSampleAlerts(mockPrisma as never, 'user-123');

      expect(createdAlerts).toContainEqual({
        symbol: 'XAUUSD',
        name: 'XAUUSD M5 Resistance Alert',
      });
    });

    it('should create XAUUSD M15 support alert', async () => {
      const mockPrisma = createMockPrisma();
      const createdAlerts: { symbol: string; name: string }[] = [];
      mockAlertCreate.mockImplementation(
        (args: { data: { symbol: string; name: string } }) => {
          createdAlerts.push({
            symbol: args.data.symbol,
            name: args.data.name,
          });
          return Promise.resolve({
            id: 'alert-123',
            symbol: args.data.symbol,
            timeframe: 'H1',
            name: args.data.name,
            isActive: true,
            createdAt: new Date(),
          });
        }
      );

      await seedSampleAlerts(mockPrisma as never, 'user-123');

      expect(createdAlerts).toContainEqual({
        symbol: 'XAUUSD',
        name: 'XAUUSD M15 Support Alert',
      });
    });

    it('should set all alerts as active', async () => {
      const mockPrisma = createMockPrisma();
      mockAlertCreate.mockImplementation(() =>
        Promise.resolve({
          id: 'alert-123',
          symbol: 'BTCUSD',
          timeframe: 'H1',
          name: 'Test Alert',
          isActive: true,
          createdAt: new Date(),
        })
      );

      const result = await seedSampleAlerts(mockPrisma as never, 'user-123');

      result.forEach((alert) => {
        expect(alert.isActive).toBe(true);
      });
    });

    it('should include condition JSON in alert creation', async () => {
      const mockPrisma = createMockPrisma();
      mockAlertCreate.mockImplementation(
        (_args: { data: { condition: string } }) =>
          Promise.resolve({
            id: 'alert-123',
            symbol: 'BTCUSD',
            timeframe: 'H1',
            name: 'Test Alert',
            isActive: true,
            createdAt: new Date(),
          })
      );

      await seedSampleAlerts(mockPrisma as never, 'user-123');

      expect(mockAlertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            condition: expect.any(String),
          }),
        })
      );
    });
  });

  describe('seedCompleteSetup', () => {
    it('should create admin and alerts (V8: no watchlists)', async () => {
      const mockPrisma = createMockPrisma();
      const adminResult = {
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      };
      mockUserUpsert.mockResolvedValue(adminResult);
      mockAlertCreate.mockImplementation(
        (args: { data: { symbol: string; name: string } }) =>
          Promise.resolve({
            id: 'alert-123',
            symbol: args.data.symbol,
            timeframe: 'H1',
            name: args.data.name,
            isActive: true,
            createdAt: new Date(),
          })
      );

      const result = await seedCompleteSetup(
        mockPrisma as never,
        'admin@test.com',
        'password123',
        'Admin User'
      );

      expect(result.admin).toEqual(adminResult);
      expect(result.alerts).toHaveLength(2);
    });

    it('should throw error if admin creation fails', async () => {
      const mockPrisma = createMockPrisma();
      mockUserUpsert.mockRejectedValue(new Error('Database error'));

      await expect(
        seedCompleteSetup(mockPrisma as never, 'admin@test.com', 'password123')
      ).rejects.toThrow('Database error');
    });

    it('should use admin ID for subsequent creations', async () => {
      const mockPrisma = createMockPrisma();
      mockUserUpsert.mockResolvedValue({
        id: 'admin-xyz-789',
        email: 'admin@test.com',
        name: 'Admin User',
        tier: 'PRO',
        role: 'ADMIN',
        createdAt: new Date(),
      });
      mockAlertCreate.mockResolvedValue({
        id: 'alert-123',
        symbol: 'XAUUSD',
        timeframe: 'M5',
        name: 'Test',
        isActive: true,
        createdAt: new Date(),
      });

      await seedCompleteSetup(
        mockPrisma as never,
        'admin@test.com',
        'password123'
      );

      // Alerts should use admin ID
      expect(mockAlertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-xyz-789',
          }),
        })
      );
    });
  });

  describe('cleanupTestData', () => {
    it('should delete user and related data', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        alerts: [],
        payments: [],
        fraudAlerts: [],
      });

      await cleanupTestData(mockPrisma as never, 'test@test.com');

      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@test.com' },
        })
      );
      expect(mockUserDelete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should not throw if user not found', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        cleanupTestData(mockPrisma as never, 'nonexistent@test.com')
      ).resolves.not.toThrow();

      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it('should delete fraud alerts before user', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        alerts: [],
        payments: [],
        fraudAlerts: [{ id: 'fraud-1' }],
      });

      await cleanupTestData(mockPrisma as never, 'test@test.com');

      expect(mockFraudAlertDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should delete payments before user', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        alerts: [],
        payments: [{ id: 'payment-1' }],
        fraudAlerts: [],
      });

      await cleanupTestData(mockPrisma as never, 'test@test.com');

      expect(mockPaymentDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should delete alerts before user', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        alerts: [{ id: 'alert-1' }],
        payments: [],
        fraudAlerts: [],
      });

      await cleanupTestData(mockPrisma as never, 'test@test.com');

      expect(mockAlertDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should throw error if cleanup fails', async () => {
      const mockPrisma = createMockPrisma();
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        alerts: [],
        payments: [],
        fraudAlerts: [],
      });
      mockUserDelete.mockRejectedValue(new Error('Delete failed'));

      await expect(
        cleanupTestData(mockPrisma as never, 'test@test.com')
      ).rejects.toThrow('Delete failed');
    });
  });
});
