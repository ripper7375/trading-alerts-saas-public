/**
 * Unit Tests: Affiliate Code Generator
 *
 * Tests code generation and distribution logic for affiliate system.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * @module __tests__/lib/affiliate/code-generator.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { prismaMock, testFactories } from '../../setup';
import { CODE_GENERATION, AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

// Import will fail initially (RED phase) - this is expected!
import {
  generateUniqueCode,
  distributeCodes,
} from '@/lib/affiliate/code-generator';

describe('Affiliate Code Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // generateUniqueCode
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('generateUniqueCode', () => {
    it('should generate 8-character alphanumeric code', async () => {
      // No existing code with this value
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const code = await generateUniqueCode();

      // Should be exactly 8 characters
      expect(code).toHaveLength(CODE_GENERATION.CODE_LENGTH);
      // Should only contain uppercase letters and numbers
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should generate unique codes on consecutive calls', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const code1 = await generateUniqueCode();
      const code2 = await generateUniqueCode();

      // Codes should be different (statistically extremely likely)
      expect(code1).not.toBe(code2);
    });

    it('should retry if generated code already exists', async () => {
      // First call: code exists, Second call: code is unique
      prismaMock.affiliateCode.findUnique
        .mockResolvedValueOnce(testFactories.createAffiliateCode() as never)
        .mockResolvedValueOnce(null);

      const code = await generateUniqueCode();

      expect(code).toBeDefined();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      // Should have checked twice
      expect(prismaMock.affiliateCode.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max generation attempts', async () => {
      // Always return existing code (simulate collision)
      prismaMock.affiliateCode.findUnique.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );

      await expect(generateUniqueCode()).rejects.toThrow(
        'Failed to generate unique code'
      );

      // Should have tried MAX_GENERATION_ATTEMPTS times
      expect(prismaMock.affiliateCode.findUnique).toHaveBeenCalledTimes(
        CODE_GENERATION.MAX_GENERATION_ATTEMPTS
      );
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // distributeCodes
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('distributeCodes', () => {
    it('should distribute specified number of codes', async () => {
      const affiliateProfileId = 'aff-profile-123';
      const count = 5;

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      await distributeCodes(affiliateProfileId, count, 'MONTHLY');

      // Should create exactly 'count' codes
      expect(prismaMock.affiliateCode.create).toHaveBeenCalledTimes(count);
    });

    it('should set correct discount and commission percentages', async () => {
      const affiliateProfileId = 'aff-profile-123';

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      await distributeCodes(affiliateProfileId, 1, 'INITIAL');

      // Check the create call includes correct percentages
      expect(prismaMock.affiliateCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountPercent: AFFILIATE_CONFIG.DISCOUNT_PERCENT,
            commissionPercent: AFFILIATE_CONFIG.COMMISSION_PERCENT,
          }),
        })
      );
    });

    it('should set expiry date to end of current month', async () => {
      const affiliateProfileId = 'aff-profile-123';

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      await distributeCodes(affiliateProfileId, 1, 'MONTHLY');

      // Get the expiry date from the create call
      const createCall = prismaMock.affiliateCode.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;

      // Should be at end of month (day 28-31)
      expect(expiresAt.getDate()).toBeGreaterThanOrEqual(28);
      // Should be end of day
      expect(expiresAt.getHours()).toBe(23);
      expect(expiresAt.getMinutes()).toBe(59);
      expect(expiresAt.getSeconds()).toBe(59);
    });

    it('should update affiliate profile with distributed count', async () => {
      const affiliateProfileId = 'aff-profile-123';
      const count = 15;

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      await distributeCodes(affiliateProfileId, count, 'MONTHLY');

      // Should update profile with increment
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: affiliateProfileId },
        data: { totalCodesDistributed: { increment: count } },
      });
    });

    it('should set correct distribution reason', async () => {
      const affiliateProfileId = 'aff-profile-123';

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      // Test INITIAL reason
      await distributeCodes(affiliateProfileId, 1, 'INITIAL');

      expect(prismaMock.affiliateCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            distributionReason: 'INITIAL',
          }),
        })
      );
    });

    it('should return created codes', async () => {
      const affiliateProfileId = 'aff-profile-123';
      const mockCode = testFactories.createAffiliateCode();

      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(mockCode as never);
      prismaMock.affiliateProfile.update.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      const result = await distributeCodes(affiliateProfileId, 3, 'MONTHLY');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(mockCode);
    });
  });
});
