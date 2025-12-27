/**
 * Unit Tests: Admin Affiliate Management
 *
 * Tests admin-level affiliate listing and detail retrieval.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * @module __tests__/lib/admin/affiliate-management.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { prismaMock, testFactories } from '../../setup';

// Import will fail initially (RED phase) - this is expected!
import {
  getAffiliatesList,
  getAffiliateDetails,
  type AffiliateListFilters,
} from '@/lib/admin/affiliate-management';

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

      const result = await getAffiliatesList({ page: 1, limit: 20 });

      expect(result.affiliates).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by status', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);

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
        user: { email: 'john@example.com', name: 'John Doe' },
        affiliateCodes: [],
        commissions: [],
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
        user: { email: 'test@example.com', name: 'Test User' },
        affiliateCodes: [],
        commissions: [],
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
        user: { email: 'test@example.com', name: 'Test' },
        affiliateCodes: mockCodes,
        commissions: [],
      } as never);

      const result = await getAffiliateDetails('1');

      expect(result?.affiliateCodes).toHaveLength(2);
    });
  });
});
