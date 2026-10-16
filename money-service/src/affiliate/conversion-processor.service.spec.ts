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
    prismaMock.affiliateCode.updateMany.mockResolvedValue({ count: 1 });
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
    prismaMock.affiliateCode.updateMany.mockResolvedValue({ count: 1 });
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

    // Remediation Tier 2 §6.2: the flip is a CONDITIONAL update (still ACTIVE)
    expect(prismaMock.affiliateCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'code-1', status: 'ACTIVE' },
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

  describe('two concurrent deliveries of the same payment (Remediation Tier 2 §6.2)', () => {
    const activeCode = {
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
    };
    const convert = () =>
      service.processAffiliateConversion({
        code: 'code-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
        grossRevenueUsd: 100,
        provider: 'DLOCAL',
      });

    beforeEach(() => {
      // Both deliveries read the code while it is still ACTIVE: the guard above is not a lock.
      prismaMock.affiliateCode.findUnique.mockResolvedValue(
        activeCode as never
      );
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
    });

    it('pays nothing when the conditional claim finds the code already USED (count 0)', async () => {
      prismaMock.affiliateCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(convert()).resolves.toEqual({
        processed: false,
        reason: 'ALREADY_USED',
      });

      expect(prismaMock.commission.create).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    });

    it('lets exactly one of two concurrent deliveries pay, and the other reports ALREADY_USED', async () => {
      prismaMock.affiliateCode.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-win',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 27,
      } as never);

      const [first, second] = await Promise.all([convert(), convert()]);

      expect([first.processed, second.processed].sort()).toEqual([false, true]);
      const loser = first.processed ? second : first;
      expect(loser.reason).toBe('ALREADY_USED');
      expect(prismaMock.commission.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledTimes(1);
    });

    it('claims the code BEFORE it creates the commission', async () => {
      prismaMock.affiliateCode.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-1',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 27,
      } as never);

      await convert();

      const claimOrder =
        prismaMock.affiliateCode.updateMany.mock.invocationCallOrder[0];
      const createOrder = prismaMock.commission.create.mock
        .invocationCallOrder[0] as number;
      expect(claimOrder).toBeLessThan(createOrder);
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

  describe('creditAffiliateCommission (commission-timing fix + recurring-commission follow-up)', () => {
    it('returns CODE_NOT_FOUND when the reserved code no longer exists', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'missing-id',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-1',
        interval: 'month',
      });

      expect(result).toEqual({ processed: false, reason: 'CODE_NOT_FOUND' });
    });

    it('is idempotent: returns ALREADY_CREDITED when a commission already exists for this exact invoice', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findMany.mockResolvedValue([
        { stripeInvoiceId: 'inv-1' },
      ] as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-1',
        interval: 'month',
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
      prismaMock.commission.findMany.mockResolvedValue([]);
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
        stripeInvoiceId: 'inv-1',
        interval: 'month',
      });

      expect(prismaMock.affiliateCode.update).not.toHaveBeenCalled();
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          affiliateProfileId: 'aff-1',
          affiliateCodeId: 'code-1',
          userId: 'user-1',
          subscriptionId: 'sub_123',
          stripeInvoiceId: 'inv-1',
          status: 'PENDING',
        }),
      });
      // $29 gross, 20% discount (cycle 1) -> $23.20 net, 20% commission -> $4.64
      expect(result).toEqual({
        processed: true,
        commissionId: 'commission-3',
        commissionAmount: 4.64,
        affiliateUserId: 'affiliate-user-1',
        code: 'AFF10',
        totalEarnings: 5.8,
        capReached: false,
      });
    });

    describe('dual delivery of one invoice (Remediation Tier 2 §6.1)', () => {
      const codeRow = {
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      };
      const credit = () =>
        service.creditAffiliateCommission({
          affiliateCodeId: 'code-1',
          userId: 'user-1',
          subscriptionId: 'sub_123',
          grossRevenueUsd: 29,
          stripeInvoiceId: 'inv-1',
          interval: 'month',
        });

      beforeEach(() => {
        prismaMock.affiliateCode.findUnique.mockResolvedValue(codeRow as never);
        // Both deliveries read "no commission yet": the check holds no lock.
        prismaMock.commission.findMany.mockResolvedValue([]);
        prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
          (cb as (tx: unknown) => unknown)(prismaMock)
        );
      });

      it('reports ALREADY_CREDITED, and increments no counters, when the database refuses the second insert (unique violation)', async () => {
        prismaMock.commission.create.mockRejectedValue(
          Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
          })
        );

        await expect(credit()).resolves.toEqual({
          processed: false,
          reason: 'ALREADY_CREDITED',
        });

        // The insert is the transaction's first statement; once it throws, the
        // counter update never runs (and a real transaction rolls back anyway).
        expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
      });

      it('lets exactly one of two concurrent deliveries credit the invoice', async () => {
        prismaMock.commission.create
          .mockResolvedValueOnce({ id: 'commission-win' } as never)
          .mockRejectedValueOnce(
            Object.assign(new Error('Unique constraint failed'), {
              code: 'P2002',
            })
          );
        prismaMock.affiliateProfile.update.mockResolvedValue({
          totalEarnings: 4.64,
        } as never);

        const [first, second] = await Promise.all([credit(), credit()]);

        expect([first.processed, second.processed].sort()).toEqual([
          false,
          true,
        ]);
        const loser = first.processed ? second : first;
        expect(loser.reason).toBe('ALREADY_CREDITED');
        expect(prismaMock.affiliateProfile.update).toHaveBeenCalledTimes(1);
      });

      it('does NOT swallow other database errors: the webhook must see them', async () => {
        prismaMock.commission.create.mockRejectedValue(
          Object.assign(new Error('deadlock detected'), { code: 'P2034' })
        );

        await expect(credit()).rejects.toThrow('deadlock detected');
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
      prismaMock.commission.findMany.mockResolvedValue([]);
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
        stripeInvoiceId: 'inv-1',
        interval: 'year',
      });

      expect(affiliateConfigMock.getBasePriceUsd).not.toHaveBeenCalled();
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ grossRevenue: 290 }),
      });
    });

    it('pays a renewal cycle (2+) on the FULL price -- no discount, since the discount is one-time only', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      // One prior cycle already credited -> this invoice is cycle 2.
      prismaMock.commission.findMany.mockResolvedValue([
        { stripeInvoiceId: 'inv-1' },
      ] as never);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-5',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 10.6,
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-2',
        interval: 'month',
      });

      // No discount on a renewal -> full $29 net, 20% commission -> $5.80
      expect(prismaMock.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeInvoiceId: 'inv-2',
          grossRevenue: 29,
          discountAmount: 0,
          netRevenue: 29,
          commissionAmount: 5.8,
        }),
      });
      expect(result.capReached).toBe(false);
    });

    it('reports capReached once the 24th cycle is credited', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      // 23 prior cycles -> this invoice is cycle 24, the cap.
      prismaMock.commission.findMany.mockResolvedValue(
        Array.from({ length: 23 }, (_, i) => ({
          stripeInvoiceId: `inv-prev-${i}`,
        })) as never
      );
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-24',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 100,
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-24',
        interval: 'month',
      });

      expect(result.processed).toBe(true);
      expect(result.capReached).toBe(true);
    });

    it('returns CAP_REACHED without creating a commission when the cap was already hit on a prior cycle', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      // 24 prior cycles already credited -> the cap was already hit.
      prismaMock.commission.findMany.mockResolvedValue(
        Array.from({ length: 24 }, (_, i) => ({
          stripeInvoiceId: `inv-prev-${i}`,
        })) as never
      );

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-25',
        interval: 'month',
      });

      expect(result).toEqual({
        processed: false,
        reason: 'CAP_REACHED',
        capReached: true,
      });
      expect(prismaMock.commission.create).not.toHaveBeenCalled();
    });
    it('keeps crediting a monthly subscription after 2 cycles (24-month cap = 24 monthly invoices)', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findMany.mockResolvedValue([
        { stripeInvoiceId: 'inv-1' },
      ] as never);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-m2',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 10,
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 29,
        stripeInvoiceId: 'inv-2',
        interval: 'month',
      });

      expect(result.processed).toBe(true);
      expect(result.capReached).toBe(false);
    });

    it('reports capReached on the 2nd annual invoice (24-month cap = 2 annual invoices)', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      // 1 prior annual cycle -> this invoice is cycle 2, the annual cap.
      prismaMock.commission.findMany.mockResolvedValue([
        { stripeInvoiceId: 'inv-y1' },
      ] as never);
      prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
        (cb as (tx: unknown) => unknown)(prismaMock)
      );
      prismaMock.commission.create.mockResolvedValue({
        id: 'commission-y2',
      } as never);
      prismaMock.affiliateProfile.update.mockResolvedValue({
        totalEarnings: 100,
      } as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 290,
        stripeInvoiceId: 'inv-y2',
        interval: 'year',
      });

      expect(result.processed).toBe(true);
      expect(result.capReached).toBe(true);
    });

    it('credits nothing on a 3rd annual invoice -- the 24-month cap was reached', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AFF10',
        affiliateProfileId: 'aff-1',
        discountPercent: 20,
        commissionPercent: 20,
        affiliateProfile: { id: 'aff-1', userId: 'affiliate-user-1' },
      } as never);
      prismaMock.commission.findMany.mockResolvedValue([
        { stripeInvoiceId: 'inv-y1' },
        { stripeInvoiceId: 'inv-y2' },
      ] as never);

      const result = await service.creditAffiliateCommission({
        affiliateCodeId: 'code-1',
        userId: 'user-1',
        grossRevenueUsd: 290,
        stripeInvoiceId: 'inv-y3',
        interval: 'year',
      });

      expect(result).toEqual({
        processed: false,
        reason: 'CAP_REACHED',
        capReached: true,
      });
      expect(prismaMock.commission.create).not.toHaveBeenCalled();
    });
  });
});
