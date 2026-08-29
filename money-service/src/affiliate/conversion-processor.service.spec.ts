/**
 * Affiliate Conversion Processor Service Tests (Session 4A-4, File 4/4)
 *
 * NEW backfill coverage — conversion-processor.ts (the source this service
 * was ported from) had no dedicated test file in the monolith;
 * __tests__/api/affiliate-conversion.test.ts tests a different route
 * (POST /api/checkout/validate-code), not processAffiliateConversion
 * itself (confirmed at CONFIRM). Same zero-coverage-backfill precedent as
 * Session 4A-2.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { AffiliateConfigService } from './affiliate-config.service';
import { ConversionProcessorService } from './conversion-processor.service';

describe('ConversionProcessorService', () => {
  let service: ConversionProcessorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let affiliateConfigMock: { getBasePriceUsd: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    affiliateConfigMock = {
      getBasePriceUsd: jest.fn().mockResolvedValue(29.0),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversionProcessorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AffiliateConfigService, useValue: affiliateConfigMock },
      ],
    }).compile();

    service = moduleRef.get(ConversionProcessorService);
  });

  it('should return CODE_NOT_FOUND when the code does not exist', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

    const result = await service.processAffiliateConversion({
      code: 'MISSING',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(result).toEqual({ processed: false, reason: 'CODE_NOT_FOUND' });
  });

  it('should return ALREADY_USED for a USED code (idempotent on webhook retries)', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue({
      id: 'code-1',
      status: 'USED',
      affiliateProfile: { id: 'aff-1', status: 'ACTIVE' },
    } as never);

    const result = await service.processAffiliateConversion({
      code: 'used-code',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(result).toEqual({ processed: false, reason: 'ALREADY_USED' });
  });

  it('should return CODE_<status> for a non-ACTIVE, non-USED code', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue({
      id: 'code-1',
      status: 'EXPIRED',
      affiliateProfile: { id: 'aff-1', status: 'ACTIVE' },
    } as never);

    const result = await service.processAffiliateConversion({
      code: 'expired-code',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(result).toEqual({ processed: false, reason: 'CODE_EXPIRED' });
  });

  it('should return AFFILIATE_NOT_ACTIVE when the owning affiliate is not ACTIVE', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue({
      id: 'code-1',
      status: 'ACTIVE',
      affiliateProfile: { id: 'aff-1', status: 'SUSPENDED' },
    } as never);

    const result = await service.processAffiliateConversion({
      code: 'code-1',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(result).toEqual({
      processed: false,
      reason: 'AFFILIATE_NOT_ACTIVE',
    });
  });

  it('should normalize the code to uppercase before lookup', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

    await service.processAffiliateConversion({
      code: '  save20  ',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(prismaMock.affiliateCode.findUnique).toHaveBeenCalledWith({
      where: { code: 'SAVE20' },
      include: {
        affiliateProfile: { select: { id: true, status: true, userId: true } },
      },
    });
  });

  it('should use the dynamic base price when grossRevenueUsd is omitted', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue({
      id: 'code-1',
      code: 'CODE-1',
      affiliateProfileId: 'aff-1',
      discountPercent: 20,
      commissionPercent: 20,
      status: 'ACTIVE',
      affiliateProfile: {
        id: 'aff-1',
        status: 'ACTIVE',
        userId: 'affiliate-user-1',
      },
    } as never);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    prismaMock.affiliateCode.update.mockResolvedValue({} as never);
    prismaMock.commission.create.mockResolvedValue({
      id: 'commission-1',
    } as never);
    prismaMock.affiliateProfile.update.mockResolvedValue({
      totalEarnings: 4.64,
    } as never);

    const result = await service.processAffiliateConversion({
      code: 'code-1',
      userId: 'user-1',
      provider: 'DLOCAL',
    });

    expect(affiliateConfigMock.getBasePriceUsd).toHaveBeenCalled();
    expect(result.processed).toBe(true);
    expect(result.commissionId).toBe('commission-1');
    // $29 gross, 20% discount -> $23.20 net, 20% commission -> $4.64
    expect(result.commissionAmount).toBe(4.64);
  });

  it('should flip the code to USED, create the commission, and update profile counters atomically', async () => {
    prismaMock.affiliateCode.findUnique.mockResolvedValue({
      id: 'code-1',
      code: 'CODE-1',
      affiliateProfileId: 'aff-1',
      discountPercent: 10,
      commissionPercent: 30,
      status: 'ACTIVE',
      affiliateProfile: {
        id: 'aff-1',
        status: 'ACTIVE',
        userId: 'affiliate-user-1',
      },
    } as never);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    prismaMock.affiliateCode.update.mockResolvedValue({} as never);
    prismaMock.commission.create.mockResolvedValue({
      id: 'commission-2',
    } as never);
    prismaMock.affiliateProfile.update.mockResolvedValue({
      totalEarnings: 27,
    } as never);

    const result = await service.processAffiliateConversion({
      code: 'code-1',
      userId: 'user-1',
      subscriptionId: 'sub-1',
      grossRevenueUsd: 100,
      provider: 'DLOCAL',
    });

    expect(prismaMock.affiliateCode.update).toHaveBeenCalledWith({
      where: { id: 'code-1' },
      data: {
        status: 'USED',
        usedAt: expect.any(Date),
        usedBy: 'user-1',
        subscriptionId: 'sub-1',
      },
    });
    expect(prismaMock.commission.create).toHaveBeenCalledWith({
      data: {
        affiliateProfileId: 'aff-1',
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
        grossRevenue: 100,
        discountAmount: 10,
        netRevenue: 90,
        commissionAmount: 27,
        status: 'PENDING',
        earnedAt: expect.any(Date),
      },
    });
    expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
      where: { id: 'aff-1' },
      data: {
        totalCodesUsed: { increment: 1 },
        totalEarnings: { increment: 27 },
        pendingCommissions: { increment: 27 },
      },
    });
    expect(result).toEqual({
      processed: true,
      commissionId: 'commission-2',
      commissionAmount: 27,
      affiliateUserId: 'affiliate-user-1',
      code: 'CODE-1',
      totalEarnings: 27,
    });
  });

  describe('reserveAffiliateCode (commission-timing fix)', () => {
    it('returns CODE_NOT_FOUND when the code does not exist', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const result = await service.reserveAffiliateCode({
        code: 'MISSING',
        userId: 'user-1',
      });

      expect(result).toEqual({ reserved: false, reason: 'CODE_NOT_FOUND' });
    });

    it('returns ALREADY_USED for a USED code', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        status: 'USED',
        affiliateProfile: { status: 'ACTIVE' },
      } as never);

      const result = await service.reserveAffiliateCode({
        code: 'used-code',
        userId: 'user-1',
      });

      expect(result).toEqual({ reserved: false, reason: 'ALREADY_USED' });
    });

    it('returns AFFILIATE_NOT_ACTIVE when the owning affiliate is suspended', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        status: 'ACTIVE',
        affiliateProfile: { status: 'SUSPENDED' },
      } as never);

      const result = await service.reserveAffiliateCode({
        code: 'code-1',
        userId: 'user-1',
      });

      expect(result).toEqual({
        reserved: false,
        reason: 'AFFILIATE_NOT_ACTIVE',
      });
    });

    it('marks an active code USED and returns its id -- WITHOUT creating a commission', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        status: 'ACTIVE',
        affiliateProfile: { status: 'ACTIVE' },
      } as never);
      prismaMock.affiliateCode.update.mockResolvedValue({} as never);

      const result = await service.reserveAffiliateCode({
        code: 'aff10',
        userId: 'user-1',
        subscriptionId: 'sub_123',
      });

      expect(prismaMock.affiliateCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: {
          status: 'USED',
          usedAt: expect.any(Date),
          usedBy: 'user-1',
          subscriptionId: 'sub_123',
        },
      });
      expect(result).toEqual({ reserved: true, affiliateCodeId: 'code-1' });
      expect(prismaMock.commission.create).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('creditAffiliateCommission (commission-timing fix)', () => {
    it('returns CODE_NOT_FOUND when the reserved code no longer exists', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'missing-id',
        userId: 'user-1',
        grossRevenueUsd: 29,
      });

      expect(result).toEqual({ processed: false, reason: 'CODE_NOT_FOUND' });
    });

    it('is idempotent: returns ALREADY_CREDITED when a commission already exists for this code', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findFirst.mockResolvedValue({
        id: 'commission-existing',
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
      });

      expect(result).toEqual({
        processed: false,
        reason: 'ALREADY_CREDITED',
      });
      expect(prismaMock.commission.create).not.toHaveBeenCalled();
    });

    it('does NOT re-mark the code USED -- it was already reserved at checkout', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-3',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 5.8,
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        subscriptionId: 'sub_123',
        grossRevenueUsd: 29,
      });

      expect(prismaMock.affiliateCode.update).not.toHaveBeenCalled();
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          affiliateProfileId: 'aff-1',
          affiliateCodeId: 'code-1',
          userId: 'user-1',
          subscriptionId: 'sub_123',
          status: 'PENDING',
        }),
      });
      // $29 gross, 20% discount -> $23.20 net, 20% commission -> $4.64
      expect(result).toEqual({
        processed: true,
        commissionId: 'commission-3',
        commissionAmount: 4.64,
        affiliateUserId: 'affiliate-user-1',
        code: 'AFF10',
        totalEarnings: 5.8,
      });
    });

    it('uses the actual invoice amount as gross revenue, not the dynamic base price', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 0,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-4',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 58,
      } as never);

      await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 290, // yearly renewal amount, not the $29 default
      });

      expect(affiliateConfigMock.getBasePriceUsd).not.toHaveBeenCalled();
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ grossRevenue: 290 }),
      });
    });
  });
});
