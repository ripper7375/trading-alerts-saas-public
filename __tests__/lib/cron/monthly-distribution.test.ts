/**
 * Monthly Distribution Cron Tests
 *
 * Tests for the monthly affiliate code distribution cron job.
 * Verifies that active affiliates receive their monthly codes
 * and proper error handling is in place.
 *
 * @module __tests__/lib/cron/monthly-distribution.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import { runMonthlyDistribution } from '@/lib/cron/monthly-distribution';
import type { DistributeCodesFunction } from '@/lib/cron/monthly-distribution';

import { prismaMock, testFactories } from '../../setup';

describe('Monthly Distribution Cron', () => {
  let mockDistributeCodes: jest.Mock<DistributeCodesFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDistributeCodes = jest
      .fn<DistributeCodesFunction>()
      .mockResolvedValue([]);
  });

  describe('runMonthlyDistribution', () => {
    it('should distribute codes to all active affiliates', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'user-1',
        email: 'user1@test.com',
      });
      const mockUser2 = testFactories.createUser({
        id: 'user-2',
        email: 'user2@test.com',
      });

      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: 'aff-1',
          userId: mockUser1.id,
          status: 'ACTIVE',
        }),
        testFactories.createAffiliateProfile({
          id: 'aff-2',
          userId: mockUser2.id,
          status: 'ACTIVE',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
      ] as never);

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.distributed).toBe(2);
      expect(mockDistributeCodes).toHaveBeenCalledTimes(2);
      expect(mockDistributeCodes).toHaveBeenCalledWith(
        'aff-1',
        AFFILIATE_CONFIG.CODES_PER_MONTH,
        'MONTHLY'
      );
      expect(mockDistributeCodes).toHaveBeenCalledWith(
        'aff-2',
        AFFILIATE_CONFIG.CODES_PER_MONTH,
        'MONTHLY'
      );
    });

    it('should only distribute to ACTIVE affiliates', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-active',
        email: 'active@test.com',
      });

      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: 'aff-active',
          userId: mockUser.id,
          status: 'ACTIVE',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.distributed).toBe(1);
      expect(mockDistributeCodes).toHaveBeenCalledTimes(1);
      expect(mockDistributeCodes).toHaveBeenCalledWith(
        'aff-active',
        AFFILIATE_CONFIG.CODES_PER_MONTH,
        'MONTHLY'
      );
    });

    it('should handle no active affiliates gracefully', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.distributed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDistributeCodes).not.toHaveBeenCalled();
    });

    it('should handle distribution errors gracefully', async () => {
      const mockUser = testFactories.createUser({
        id: 'user-1',
        email: 'user1@test.com',
      });

      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: 'aff-1',
          userId: mockUser.id,
          status: 'ACTIVE',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.user.findMany.mockResolvedValue([mockUser] as never);
      mockDistributeCodes.mockRejectedValue(new Error('Distribution failed'));

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.distributed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('user1@test.com');
      expect(result.errors[0]).toContain('Distribution failed');
    });

    it('should continue processing after individual failures', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'user-1',
        email: 'user1@test.com',
      });
      const mockUser2 = testFactories.createUser({
        id: 'user-2',
        email: 'user2@test.com',
      });

      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: 'aff-1',
          userId: mockUser1.id,
          status: 'ACTIVE',
        }),
        testFactories.createAffiliateProfile({
          id: 'aff-2',
          userId: mockUser2.id,
          status: 'ACTIVE',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
      ] as never);

      // First call fails, second succeeds
      mockDistributeCodes
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce([]);

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.distributed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(mockDistributeCodes).toHaveBeenCalledTimes(2);
    });

    it('should return total affiliates processed', async () => {
      const mockUser1 = testFactories.createUser({
        id: 'u1',
        email: 'u1@test.com',
      });
      const mockUser2 = testFactories.createUser({
        id: 'u2',
        email: 'u2@test.com',
      });
      const mockUser3 = testFactories.createUser({
        id: 'u3',
        email: 'u3@test.com',
      });

      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: 'a1',
          userId: mockUser1.id,
          status: 'ACTIVE',
        }),
        testFactories.createAffiliateProfile({
          id: 'a2',
          userId: mockUser2.id,
          status: 'ACTIVE',
        }),
        testFactories.createAffiliateProfile({
          id: 'a3',
          userId: mockUser3.id,
          status: 'ACTIVE',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.user.findMany.mockResolvedValue([
        mockUser1,
        mockUser2,
        mockUser3,
      ] as never);

      const result = await runMonthlyDistribution({
        distributeCodes: mockDistributeCodes,
      });

      expect(result.totalAffiliates).toBe(3);
      expect(result.distributed).toBe(3);
    });
  });
});
