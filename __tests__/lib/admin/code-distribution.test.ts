/**
 * Unit Tests: Admin Code Distribution
 *
 * Tests admin-level code distribution, suspension, and reactivation.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * @module __tests__/lib/admin/code-distribution.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { prismaMock, testFactories } from '../../setup';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // Part 17A

// Mock the Part 17A code-generator
jest.mock('@/lib/affiliate/code-generator', () => ({
  distributeCodes: jest.fn(),
}));

// Import will fail initially (RED phase) - this is expected!
import {
  distributeCodesAdmin,
  suspendAffiliate,
  reactivateAffiliate,
} from '@/lib/admin/code-distribution';

describe('Admin Code Distribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // distributeCodesAdmin
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('distributeCodesAdmin', () => {
    it('should distribute codes to active affiliate', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'ACTIVE',
        fullName: 'John Doe',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);
      (distributeCodes as jest.Mock).mockResolvedValue([
        testFactories.createAffiliateCode(),
      ]);

      const result = await distributeCodesAdmin('aff-1', 10, 'Bonus for performance');

      expect(result.success).toBe(true);
      expect(distributeCodes).toHaveBeenCalledWith('aff-1', 10, 'ADMIN_BONUS');
    });

    it('should reject distribution to suspended affiliate', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'SUSPENDED',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);

      await expect(
        distributeCodesAdmin('aff-1', 10, 'Bonus')
      ).rejects.toThrow('Can only distribute codes to active affiliates');
    });

    it('should reject distribution to pending affiliate', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'PENDING_VERIFICATION',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);

      await expect(
        distributeCodesAdmin('aff-1', 10, 'Bonus')
      ).rejects.toThrow('Can only distribute codes to active affiliates');
    });

    it('should validate count minimum (1)', async () => {
      await expect(
        distributeCodesAdmin('aff-1', 0, 'Bonus')
      ).rejects.toThrow('Count must be between 1 and 50');
    });

    it('should validate count maximum (50)', async () => {
      await expect(
        distributeCodesAdmin('aff-1', 51, 'Bonus')
      ).rejects.toThrow('Count must be between 1 and 50');
    });

    it('should throw if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(
        distributeCodesAdmin('nonexistent', 10, 'Bonus')
      ).rejects.toThrow('Affiliate not found');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // suspendAffiliate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('suspendAffiliate', () => {
    it('should suspend an active affiliate', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'ACTIVE',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        ...mockAffiliate,
        status: 'SUSPENDED',
        suspensionReason: 'Policy violation',
        suspendedAt: new Date(),
      } as never);

      const result = await suspendAffiliate('aff-1', 'Policy violation');

      expect(result.status).toBe('SUSPENDED');
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: expect.objectContaining({
          status: 'SUSPENDED',
          suspensionReason: 'Policy violation',
        }),
      });
    });

    it('should throw if affiliate already suspended', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'SUSPENDED',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);

      await expect(
        suspendAffiliate('aff-1', 'Another reason')
      ).rejects.toThrow('Affiliate is already suspended');
    });

    it('should throw if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(
        suspendAffiliate('nonexistent', 'Reason')
      ).rejects.toThrow('Affiliate not found');
    });

    it('should require a suspension reason', async () => {
      await expect(
        suspendAffiliate('aff-1', '')
      ).rejects.toThrow('Suspension reason is required');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // reactivateAffiliate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('reactivateAffiliate', () => {
    it('should reactivate a suspended affiliate', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'SUSPENDED',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        ...mockAffiliate,
        status: 'ACTIVE',
        suspensionReason: null,
        suspendedAt: null,
      } as never);

      const result = await reactivateAffiliate('aff-1');

      expect(result.status).toBe('ACTIVE');
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-1' },
        data: {
          status: 'ACTIVE',
          suspensionReason: null,
          suspendedAt: null,
        },
      });
    });

    it('should throw if affiliate not suspended', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({
        id: 'aff-1',
        status: 'ACTIVE',
      });

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(mockAffiliate as never);

      await expect(
        reactivateAffiliate('aff-1')
      ).rejects.toThrow('Affiliate is not suspended');
    });

    it('should throw if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(
        reactivateAffiliate('nonexistent')
      ).rejects.toThrow('Affiliate not found');
    });
  });
});
