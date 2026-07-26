/**
 * Commission Aggregator Service Tests (Session 4A-W6, File 5/8)
 *
 * No test file existed for this service before this session (verified live
 * — same `LESSONS-LEARNED.md` L27-class gap as `payment-orchestrator.service.ts`,
 * `LESSONS-ARCHIVE` note). Scoped to this session's own new method
 * (`getAllPayableAffiliatesForProvider`, design §6.2 step 1) rather than
 * backfilling full coverage of every pre-existing method.
 */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { CommissionAggregatorService } from './commission-aggregator.service';

describe('CommissionAggregatorService.getAllPayableAffiliatesForProvider', () => {
  let service: CommissionAggregatorService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommissionAggregatorService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(CommissionAggregatorService);
  });

  it('a non-WISE provider falls through to the existing getAllPayableAffiliates() behavior unmodified', async () => {
    prismaMock.commission.findMany.mockResolvedValue([]);

    await service.getAllPayableAffiliatesForProvider('MOCK');

    // getAllPayableAffiliates() includes affiliateProfile; the new WISE-only
    // path does not -- this proves the fallback took the OLD query shape.
    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { affiliateProfile: true },
      })
    );
    expect(prismaMock.affiliateWiseRecipient.findMany).not.toHaveBeenCalled();
  });

  it('WISE: zero ACTIVE recipients yields an empty result without querying commissions', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([]);

    const result = await service.getAllPayableAffiliatesForProvider('WISE');

    expect(result).toEqual([]);
    expect(prismaMock.commission.findMany).not.toHaveBeenCalled();
  });

  it('WISE: only aggregates commissions for affiliates with an ACTIVE Wise recipient, at or above the $50 minimum', async () => {
    prismaMock.affiliateWiseRecipient.findMany.mockResolvedValue([
      { affiliateProfileId: 'aff-active' },
    ] as never);
    prismaMock.commission.findMany.mockResolvedValue([
      {
        id: 'comm-1',
        affiliateProfileId: 'aff-active',
        commissionAmount: 60,
        createdAt: new Date('2026-07-01'),
      },
    ] as never);

    const result = await service.getAllPayableAffiliatesForProvider('WISE');

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          affiliateProfileId: { in: ['aff-active'] },
          status: 'APPROVED',
        }),
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        affiliateId: 'aff-active',
        totalAmount: 60,
        canPayout: true,
      }),
    ]);
  });
});
