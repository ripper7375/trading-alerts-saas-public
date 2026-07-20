/**
 * Unit Tests: Admin Affiliate Management
 *
 * Tests admin-level affiliate listing and detail retrieval.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * @module __tests__/lib/admin/affiliate-management.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

/* eslint-disable import/order -- this whole block MUST stay in this exact
 * order: '../../setup' first, before any '@/lib/...' import. Its
 * jest.mock() calls only take effect if this file loads first (see
 * __tests__/setup.ts's header comment). `eslint --fix`/import/order WILL
 * silently reorder this without a disable — it already has once (Session
 * 2-4) — breaking the Prisma mock for every test in this file with no
 * error, just wrong results. Do not remove this disable block. */
import { prismaMock, testFactories } from '../../setup';

import {
  getAffiliatesList,
  getAffiliateDetails,
} from '@/lib/admin/affiliate-management';
/* eslint-enable import/order */

// Import will fail initially (RED phase) - this is expected!

describe('Admin Affiliate Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAffiliatesList
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getAffiliatesList', () => {
    it('should return paginated affiliates', async () => {
      const mockAffiliates = [
        testFactories.createAffiliateProfile({
          id: '1',
          fullName: 'John Doe',
          status: 'ACTIVE',
        }),
        testFactories.createAffiliateProfile({
          id: '2',
          fullName: 'Jane Smith',
          status: 'PENDING_VERIFICATION',
        }),
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as never
      );
      prismaMock.affiliateProfile.count.mockResolvedValue(2);
      prismaMock.user.findMany.mockResolvedValue([
        testFactories.createUser({ id: 'user-123' }),
      ] as never);

      const result = await getAffiliatesList({ page: 1, limit: 20 });

      expect(result.affiliates).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by status', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);

      await getAffiliatesList({ status: 'ACTIVE', page: 1, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('should filter by country', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);

      await getAffiliatesList({ country: 'US', page: 1, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'US' }),
        })
      );
    });

    it('should filter by payment method', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);

      await getAffiliatesList({ paymentMethod: 'PAYPAL', page: 1, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentMethod: 'PAYPAL' }),
        })
      );
    });

    it('should apply pagination correctly', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(100);
      prismaMock.user.findMany.mockResolvedValue([]);

      await getAffiliatesList({ page: 3, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3 - 1) * 20
          take: 20,
        })
      );
    });

    it('should calculate total pages correctly', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(55);
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await getAffiliatesList({ page: 1, limit: 20 });

      expect(result.totalPages).toBe(3); // Math.ceil(55 / 20)
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAffiliateDetails
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getAffiliateDetails', () => {
    it('should return affiliate with full details', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: '1',
        fullName: 'John Doe',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        ...mockAffiliate,
        affiliateCodes: [],
        commissions: [],
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        email: 'john@example.com',
        name: 'John Doe',
      } as never);

      const result = await getAffiliateDetails('1');

      expect(result).toBeDefined();
      expect(result?.fullName).toBe('John Doe');
    });

    it('should throw error if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(getAffiliateDetails('nonexistent')).rejects.toThrow(
        'Affiliate not found'
      );
    });

    it('should include user email in response', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({ id: '1' });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        ...mockAffiliate,
        affiliateCodes: [],
        commissions: [],
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        name: 'Test User',
      } as never);

      const result = await getAffiliateDetails('1');

      expect(result?.user?.email).toBe('test@example.com');
    });

    it('should include affiliate codes', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({ id: '1' });
      const mockCodes = [
        testFactories.createAffiliateCode({ code: 'CODE1', status: 'ACTIVE' }),
        testFactories.createAffiliateCode({ code: 'CODE2', status: 'USED' }),
      ];

      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        ...mockAffiliate,
        affiliateCodes: mockCodes,
        commissions: [],
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        name: 'Test',
      } as never);

      const result = await getAffiliateDetails('1');

      expect(result?.affiliateCodes).toHaveLength(2);
    });
  });
});
