/**
 * Admin Affiliate Management Service Tests (Session 4A-6, File 2/3)
 *
 * Assertions ported unchanged from
 * __tests__/lib/admin/affiliate-management.test.ts, adapted to NestJS's
 * testing module (.overrideProvider-style DI) instead of jest.mock()
 * module hoisting — same conversion pattern as Session 4A-4's
 * ConversionProcessorService tests.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, testFactories } from '../test-utils/prisma-mock';

import { AdminAffiliateManagementService } from './affiliate-management.service';

describe('AdminAffiliateManagementService', () => {
  let service: AdminAffiliateManagementService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminAffiliateManagementService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(AdminAffiliateManagementService);
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

      const result = await service.getAffiliatesList({ page: 1, limit: 20 });

      expect(result.affiliates).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by status', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getAffiliatesList({
        status: 'ACTIVE',
        page: 1,
        limit: 20,
      });

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

      await service.getAffiliatesList({ country: 'US', page: 1, limit: 20 });

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

      await service.getAffiliatesList({
        paymentMethod: 'PAYPAL',
        page: 1,
        limit: 20,
      });

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

      await service.getAffiliatesList({ page: 3, limit: 20 });

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

      const result = await service.getAffiliatesList({ page: 1, limit: 20 });

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

      const result = await service.getAffiliateDetails('1');

      expect(result).toBeDefined();
      expect(result?.fullName).toBe('John Doe');
    });

    it('should throw error if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(service.getAffiliateDetails('nonexistent')).rejects.toThrow(
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

      const result = await service.getAffiliateDetails('1');

      expect(result?.user?.email).toBe('test@example.com');
    });

    it('should include affiliate codes', async () => {
      const mockAffiliate = testFactories.createAffiliateProfile({ id: '1' });
      const mockCodes = [
        { code: 'CODE1', status: 'ACTIVE' },
        { code: 'CODE2', status: 'USED' },
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

      const result = await service.getAffiliateDetails('1');

      expect(result?.affiliateCodes).toHaveLength(2);
    });
  });
});
