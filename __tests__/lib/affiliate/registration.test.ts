/**
 * Unit Tests: Affiliate Registration
 *
 * Tests the affiliate registration process: user validation, immediate
 * profile activation (no separate email re-verification — the account is
 * already verified before it can reach this flow), and code distribution.
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

// Mock email sending — registration should not depend on real delivery
const mockSendAffiliateWelcomeEmail = jest.fn();
jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendAffiliateWelcomeEmail: (
    to: string,
    name: string,
    codesDistributed: number
  ) => mockSendAffiliateWelcomeEmail(to, name, codesDistributed),
}));

import { registerAffiliate } from '@/lib/affiliate/registration';

describe('Affiliate Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendAffiliateWelcomeEmail.mockResolvedValue({ success: true });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // registerAffiliate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('registerAffiliate', () => {
    const registrationData = {
      userId: 'user-123',
      fullName: 'John Doe',
      country: 'US',
      paymentMethod: 'WISE' as const,
      paymentDetails: { email: 'john@wise.com' },
    };

    it('should register and activate the affiliate immediately', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );

      const result = await registerAffiliate(registrationData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('active');
      expect(result.codesDistributed).toBe(15);
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

      await expect(registerAffiliate(registrationData)).rejects.toThrow(
        'Already registered as affiliate'
      );
    });

    it('should reject if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        registerAffiliate({ ...registrationData, userId: 'nonexistent-user' })
      ).rejects.toThrow('User not found');
    });

    it('should create the affiliate profile as ACTIVE with no verification token', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );

      await registerAffiliate(registrationData);

      expect(prismaMock.affiliateProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            fullName: 'John Doe',
            country: 'US',
            paymentMethod: 'WISE',
            status: 'ACTIVE',
            verifiedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should distribute the first month of codes on registration', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );

      await registerAffiliate(registrationData);

      // Should create 15 codes (CODES_PER_MONTH)
      expect(prismaMock.affiliateCode.create).toHaveBeenCalledTimes(15);
    });

    it('should send a welcome email but not fail registration if it errors', async () => {
      const mockUser = testFactories.createUser({ isAffiliate: false });

      prismaMock.user.findUnique.mockResolvedValue(mockUser as never);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        isAffiliate: true,
      } as never);
      prismaMock.affiliateProfile.create.mockResolvedValue(
        testFactories.createAffiliateProfile() as never
      );
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue(
        testFactories.createAffiliateCode() as never
      );
      mockSendAffiliateWelcomeEmail.mockRejectedValue(
        new Error('Resend unavailable')
      );

      const result = await registerAffiliate(registrationData);

      expect(mockSendAffiliateWelcomeEmail).toHaveBeenCalledWith(
        mockUser.email,
        'John Doe',
        15
      );
      expect(result.success).toBe(true);
    });
  });
});
