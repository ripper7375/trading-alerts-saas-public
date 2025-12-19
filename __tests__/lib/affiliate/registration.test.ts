/**
 * Unit Tests: Affiliate Registration
 *
 * Tests the affiliate registration process including
 * user validation, profile creation, and email verification.
 *
 * @module __tests__/lib/affiliate/registration.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { prismaMock, testFactories } from '../../setup';

// Mock next-auth
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: () => mockGetServerSession(),
}));

// Mock auth-options
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Import will fail initially (RED phase) - this is expected!
import {
  registerAffiliate,
  verifyAffiliateEmail,
} from '@/lib/affiliate/registration';

describe('Affiliate Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // registerAffiliate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('registerAffiliate', () => {
    it('should register user as affiliate successfully', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });
      const registrationData = {
        userId: 'user-123',
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL' as const,
        paymentDetails: { email: 'john@paypal.com' },
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      const result = await registerAffiliate(registrationData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('verify your email');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { isAffiliate: true },
        })
      );
    });

    it('should reject if user is already an affiliate', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: true });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);

      await expect(
        registerAffiliate({
          userId: 'user-123',
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: { email: 'john@paypal.com' },
        })
      ).rejects.toThrow('Already registered as affiliate');
    });

    it('should reject if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        registerAffiliate({
          userId: 'nonexistent-user',
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: { email: 'john@paypal.com' },
        })
      ).rejects.toThrow('User not found');
    });

    it('should create affiliate profile with verification token', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );

      await registerAffiliate({
        userId: 'user-123',
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: { email: 'john@paypal.com' },
      });

      expect(prismaMock.affiliateProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            fullName: 'John Doe',
            country: 'US',
            paymentMethod: 'PAYPAL',
            status: 'PENDING_VERIFICATION',
          }),
        })
      );
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // verifyAffiliateEmail
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('verifyAffiliateEmail', () => {
    it('should verify email with valid token', async () => {
      const mockProfile = testFactories.createAffiliateProfile({
        status: 'PENDING_VERIFICATION',
      });

      prismaMock.affiliateProfile.findFirst.mockResolvedValue({
        ...mockProfile,
        id: 'profile-123',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'ACTIVE',
      } as never);
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      prismaMock.affiliateProfile.update.mockResolvedValue(
        mockProfile as never
      );

      const result = await verifyAffiliateEmail('valid-token-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('verified');
    });

    it('should reject invalid verification token', async () => {
      prismaMock.affiliateProfile.findFirst.mockResolvedValue(null);

      await expect(verifyAffiliateEmail('invalid-token')).rejects.toThrow(
        'Invalid verification token'
      );
    });

    it('should distribute initial codes after verification', async () => {
      const mockProfile = testFactories.createAffiliateProfile({
        status: 'PENDING_VERIFICATION',
      });

      prismaMock.affiliateProfile.findFirst.mockResolvedValue({
        ...mockProfile,
        id: 'profile-123',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        ...mockProfile,
        status: 'ACTIVE',
      } as never);
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );

      await verifyAffiliateEmail('valid-token-123');

      // Should create 15 codes (CODES_PER_MONTH)
      expect(prismaMock.affiliateCode.create).toHaveBeenCalledTimes(15);
    });
  });
});
